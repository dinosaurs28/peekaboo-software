"use client";
import { db } from "@/lib/firebase";
import { collection, serverTimestamp, runTransaction, doc, increment } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { COLLECTIONS, GoodsReceiptDoc, GoodsReceiptLine } from "@/lib/models";

export type CheckoutInput = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number }>;
  billDiscount?: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
  customerId?: string;
  cashierName?: string;
};

export async function checkoutCart(input: CheckoutInput): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  const nowIso = new Date().toISOString();
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.qty - (l.lineDiscount ?? 0), 0);
  const billDisc = input.billDiscount ?? 0;
  const grandTotal = Math.max(0, subtotal - billDisc);
  const method = input.paymentMethod ?? 'cash';
  const refId = input.paymentReferenceId;
  const cashierUserId = input.cashierUserId ?? 'current-user';
  const cashierName = input.cashierName;

  // Transaction: decrement stock for each product and then create invoice
  const invoiceId = await runTransaction(dbx, async (tx) => {
    // Decrement stock
    for (const l of input.lines) {
  const pRef = doc(dbx, COLLECTIONS.products, l.productId);
      // We simply decrement; if we need to enforce non-negative stock, fetch current and check
      tx.update(pRef, { stock: increment(-l.qty), updatedAt: serverTimestamp() });
    }

    // Create invoice document
    const inv: Omit<InvoiceDoc, 'id'> = {
      invoiceNumber: "TEMP-" + Date.now(),
      // customerId omitted unless provided
      items: input.lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.qty, unitPrice: l.unitPrice, discountAmount: l.lineDiscount ?? 0 })),
      subtotal,
      taxTotal: 0,
      discountTotal: billDisc,
      grandTotal,
      payments: [{ method, amount: grandTotal, ...(refId ? { referenceId: refId } : {}) }],
      balanceDue: 0,
      cashierUserId,
      ...(cashierName ? { cashierName } : {}),
      status: 'paid',
      issuedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Create invoice inside the transaction using tx.set
    const invRef = doc(collection(dbx, COLLECTIONS.invoices));
    tx.set(invRef, {
      ...inv,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return invRef.id;
  });

  return invoiceId;
}

// Trivial export to ensure module resolution picks up this file
export const __POS__MODULE = true;

// Inventory: generic stock adjustment with log entry
export type AdjustReason = 'sale' | 'receive' | 'correction' | 'stocktake' | 'return';
export async function adjustStock(params: {
  productId: string;
  delta: number; // + for receive, - for deduction
  reason: AdjustReason;
  userId?: string;
  note?: string;
  unitCost?: number;
  relatedInvoiceId?: string;
  relatedReceiptId?: string;
}): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  await runTransaction(dbx, async (tx) => {
    const pRef = doc(dbx, COLLECTIONS.products, params.productId);
    // Use atomic increment without read for speed; logs will not store from/to in this minimal version
    tx.update(pRef, { stock: increment(params.delta), updatedAt: serverTimestamp() });
    const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
    const logType: 'sale' | 'purchase' | 'return' | 'adjustment' | 'damage' =
      params.reason === 'sale' ? 'sale'
      : params.reason === 'receive' ? 'purchase'
      : params.reason === 'return' ? 'return'
      : 'adjustment';
    tx.set(logRef, {
      productId: params.productId,
      quantityChange: params.delta,
      type: logType,
      reason: params.reason,
      userId: params.userId ?? 'system',
      note: params.note ?? null,
      relatedInvoiceId: params.relatedInvoiceId ?? null,
      relatedReceiptId: params.relatedReceiptId ?? null,
      unitCost: params.unitCost ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// Inventory: receive multiple items (Option E backend) and create a GoodsReceipt document
export async function receiveStock(params: {
  createdByUserId: string;
  supplierName?: string;
  supplierCode?: string;
  docNo?: string;
  docDate?: string; // ISO
  note?: string;
  lines: GoodsReceiptLine[]; // { productId, sku, name, qty, unitCost? }
}): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  const now = new Date().toISOString();
  const receiptId = await runTransaction(dbx, async (tx) => {
    const recRef = doc(collection(dbx, COLLECTIONS.goodsReceipts));
    const receipt: Omit<GoodsReceiptDoc, 'id'> = {
      supplierName: params.supplierName,
      supplierCode: params.supplierCode,
      docNo: params.docNo,
      docDate: params.docDate,
      note: params.note,
      createdByUserId: params.createdByUserId,
      lines: params.lines,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(recRef, { ...receipt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    // Apply increments and logs per line
    for (const line of params.lines) {
      const pRef = doc(dbx, COLLECTIONS.products, line.productId);
      tx.update(pRef, { stock: increment(line.qty), updatedAt: serverTimestamp() });
      const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
      tx.set(logRef, {
        productId: line.productId,
        quantityChange: line.qty,
        type: 'purchase',
        reason: 'receive',
        userId: params.createdByUserId,
        note: params.note ?? null,
        relatedReceiptId: recRef.id,
        unitCost: line.unitCost ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return recRef.id;
  });
  return receiptId;
}
