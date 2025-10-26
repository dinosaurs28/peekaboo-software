"use client";
import { db } from "@/lib/firebase";
import { collection, serverTimestamp, runTransaction, doc, increment } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { COLLECTIONS, GoodsReceiptDoc, GoodsReceiptLine } from "@/lib/models";

export type CheckoutInput = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number }>;
  billDiscount?: number;
  // Single payment only
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
  customerId?: string;
  cashierName?: string;
  // Optional idempotency key to prevent duplicate invoices on retries
  opId?: string;
};

export async function checkoutCart(input: CheckoutInput): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  const nowIso = new Date().toISOString();
  // Basic validations: forbid negative qty/price/discounts and ensure sensible totals
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("Cart is empty");
  }
  for (const l of input.lines) {
    if (!l || typeof l.productId !== 'string' || !l.productId) throw new Error("Invalid line: product missing");
    if (!(Number.isFinite(l.qty) && l.qty > 0)) throw new Error("Invalid line: qty must be > 0");
    if (!(Number.isFinite(l.unitPrice) && l.unitPrice >= 0)) throw new Error("Invalid line: unit price must be >= 0");
    if (l.lineDiscount != null) {
      if (!(Number.isFinite(l.lineDiscount) && (l.lineDiscount as number) >= 0)) throw new Error("Invalid line: discount must be >= 0");
      const lineTotal = l.unitPrice * l.qty;
      if ((l.lineDiscount as number) > lineTotal) throw new Error("Invalid line: discount exceeds line total");
    }
  }
  if (input.billDiscount != null) {
    if (!(Number.isFinite(input.billDiscount) && (input.billDiscount as number) >= 0)) {
      throw new Error("Invalid bill discount: must be >= 0");
    }
  }
  // Compute per-line net and proportional bill discount for tax base
  const lineNets = input.lines.map(l => ({
    ...l,
    net: l.unitPrice * l.qty - (l.lineDiscount ?? 0),
  }));
  const subtotal = lineNets.reduce((s, l) => s + l.net, 0);
  const billDisc = input.billDiscount ?? 0;
  if (billDisc > subtotal) {
    throw new Error("Bill discount cannot exceed subtotal");
  }
  // Distribute bill discount proportionally across lines for tax computation
  const totalBase = Math.max(1, subtotal);
  const linesWithBillShare = lineNets.map(l => ({
    ...l,
    billShare: (billDisc * (l.net / totalBase)),
  }));
  // Tax per line (if taxRatePct exists on line source), invoice lines here may not carry taxRatePct; caller should embed it in name or we compute 0
  // Note: We accept optional taxRatePct in a widened shape; we won't change the CheckoutInput type to keep API minimal
  const linesWithTax = linesWithBillShare.map((l: any) => {
    const taxableBase = Math.max(0, l.net - l.billShare);
    const taxRate = typeof l.taxRatePct === 'number' ? l.taxRatePct : 0;
    const tax = taxableBase * (taxRate / 100);
    return { ...l, taxRatePct: taxRate, lineTax: tax };
  });
  const taxTotal = linesWithTax.reduce((s: number, l: any) => s + l.lineTax, 0);
  const grandTotal = Math.max(0, subtotal - billDisc + taxTotal);
  const method = input.paymentMethod ?? 'cash';
  const refId = input.paymentReferenceId;
  const cashierUserId = input.cashierUserId ?? 'current-user';
  const cashierName = input.cashierName;

  // Single payment path only; no split payments

  // Transaction: decrement stock for each product and then create invoice
  const invoiceId = await runTransaction(dbx, async (tx) => {
    // Prepare invoice reference first to use id in logs
    const invRef = doc(collection(dbx, COLLECTIONS.invoices));

    // Sequential invoice number (prefix + zero-padded counter) from Settings/app
    const settingsRef = doc(dbx, COLLECTIONS.settings, 'app');
    const settingsSnap = await tx.get(settingsRef);
    let prefix = 'INV';
    let nextSeq = 1;
    if (settingsSnap.exists()) {
      const s = settingsSnap.data() as any;
      prefix = typeof s.invoicePrefix === 'string' && s.invoicePrefix.trim() ? s.invoicePrefix.trim() : 'INV';
      nextSeq = Number(s.nextInvoiceSequence ?? 1) || 1;
    }
    const seqStr = String(nextSeq).padStart(6, '0');
    const invoiceNumber = `${prefix}-${seqStr}`;
    // Bump counter
    tx.set(settingsRef, { invoicePrefix: prefix, nextInvoiceSequence: nextSeq + 1, updatedAt: serverTimestamp() }, { merge: true });

    // Decrement stock and create inventory logs per line
    for (const l of input.lines) {
      const pRef = doc(dbx, COLLECTIONS.products, l.productId);
      tx.update(pRef, { stock: increment(-l.qty), updatedAt: serverTimestamp() });
      const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
      tx.set(logRef, {
        productId: l.productId,
        quantityChange: -l.qty,
        type: 'sale',
        reason: 'sale',
        userId: input.cashierUserId ?? 'current-user',
        relatedInvoiceId: invRef.id,
        unitCost: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Create invoice document
    const inv: Omit<InvoiceDoc, 'id'> = {
      invoiceNumber,
      // customerId omitted unless provided
      items: linesWithTax.map((l: any) => ({ productId: l.productId, name: l.name, quantity: l.qty, unitPrice: l.unitPrice, taxRatePct: l.taxRatePct || undefined, discountAmount: l.lineDiscount ?? 0 })),
      subtotal,
      taxTotal,
      discountTotal: billDisc,
      grandTotal,
  paymentMethod: method,
  ...(refId ? { paymentReferenceId: refId } : {}),
      balanceDue: 0,
      cashierUserId,
      ...(cashierName ? { cashierName } : {}),
      status: 'paid',
      issuedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // No-op: payments already validated above

    // Create invoice inside the transaction using tx.set
    tx.set(invRef, {
      ...inv,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      // Idempotency: allow external callers to set opId to avoid duplicates on replay
      ...(typeof (input as any).opId === 'string' ? { opId: (input as any).opId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Loyalty: award points to customer if present
    if (input.customerId) {
      const points = Math.floor(grandTotal / 100);
      if (points > 0 || grandTotal > 0) {
        const cRef = doc(dbx, COLLECTIONS.customers, input.customerId);
        tx.set(cRef, { loyaltyPoints: increment(points), totalSpend: increment(grandTotal), updatedAt: serverTimestamp() }, { merge: true });
      }
    }
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
  if (!params || !Array.isArray(params.lines) || params.lines.length === 0) {
    throw new Error("No lines to receive");
  }
  for (const line of params.lines) {
    if (!(Number.isFinite(line.qty) && line.qty > 0)) throw new Error("Receive qty must be > 0");
    if (line.unitCost != null && !(Number.isFinite(line.unitCost) && line.unitCost >= 0)) throw new Error("Unit cost must be >= 0");
  }
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
