"use client";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, runTransaction, doc, increment } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

export type CheckoutInput = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number }>;
  billDiscount?: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
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
      customerId: undefined,
      items: input.lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.qty, unitPrice: l.unitPrice, discountAmount: l.lineDiscount ?? 0 })),
      subtotal,
      taxTotal: 0,
      discountTotal: billDisc,
      grandTotal,
      payments: [{ method, amount: grandTotal, referenceId: refId }],
      balanceDue: 0,
      cashierUserId,
      status: 'paid',
      issuedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const invRef = await addDoc(collection(dbx, COLLECTIONS.invoices), {
      ...inv,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return invRef.id;
  });

  return invoiceId;
}

// Trivial export to ensure module resolution picks up this file
export const __POS__MODULE = true;
