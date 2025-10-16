"use client";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import type { InvoiceDoc, PaymentRecord } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

function asString(v: unknown, def = ""): string { return typeof v === "string" ? v : def; }
function asNumber(v: unknown, def = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
}
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function isArrayOfRecords(v: unknown): v is Array<Record<string, unknown>> { return Array.isArray(v) && v.every(isRecord); }
function asPaymentMethod(v: unknown): PaymentRecord["method"] {
  return v === "card" || v === "upi" || v === "wallet" ? v : "cash";
}
function asInvoiceStatus(v: unknown): InvoiceDoc["status"] {
  return v === "partial" || v === "unpaid" || v === "void" ? v : "paid";
}

export function toInvoiceDoc(id: string, data: Record<string, unknown>): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id,
    invoiceNumber: asString(data.invoiceNumber, id),
    customerId: typeof data.customerId === "string" ? data.customerId : undefined,
    items: isArrayOfRecords(data.items) ? data.items.map((it) => ({
      productId: asString(it.productId),
      name: asString(it.name),
      quantity: asNumber(it.quantity, 0),
      unitPrice: asNumber(it.unitPrice, 0),
      taxRatePct: it.taxRatePct != null ? asNumber(it.taxRatePct) : undefined,
      discountAmount: it.discountAmount != null ? asNumber(it.discountAmount) : undefined,
    })) : [],
    subtotal: asNumber(data.subtotal, 0),
    taxTotal: asNumber(data.taxTotal, 0),
    discountTotal: data.discountTotal != null ? asNumber(data.discountTotal) : undefined,
    grandTotal: asNumber(data.grandTotal, 0),
    payments: isArrayOfRecords(data.payments) ? data.payments.map((p) => ({
      method: asPaymentMethod(p.method),
      amount: asNumber(p.amount, 0),
      referenceId: typeof p.referenceId === "string" ? p.referenceId : undefined,
    })) : [],
    balanceDue: asNumber(data.balanceDue, 0),
    cashierUserId: asString(data.cashierUserId, ""),
    status: asInvoiceStatus(data.status),
    issuedAt: asString(data.issuedAt, now),
    createdAt: asString(data.createdAt, now),
    updatedAt: asString(data.updatedAt, now),
  };
}

export type InvoiceFilters = {
  cashierUserId?: string; // when set, filter by cashier
  status?: InvoiceDoc["status"]; // filter by status
  issuedFromIso?: string; // inclusive start
  issuedToIso?: string; // inclusive end
};

export function observeInvoices(cb: (invoices: InvoiceDoc[]) => void, filters?: InvoiceFilters) {
  if (!db) throw new Error("Firestore not initialized");
  const col = collection(db!, COLLECTIONS.invoices);

  const constraints: QueryConstraint[] = [];
  // Status filter
  if (filters?.status) constraints.push(where("status", "==", filters.status));
  // Cashier filter
  if (filters?.cashierUserId) constraints.push(where("cashierUserId", "==", filters.cashierUserId));
  // Date range on issuedAt (stored as ISO string)
  if (filters?.issuedFromIso) constraints.push(where("issuedAt", ">=", filters.issuedFromIso));
  if (filters?.issuedToIso) constraints.push(where("issuedAt", "<=", filters.issuedToIso));

  // Always order by issuedAt desc for browsing recent first
  constraints.push(orderBy("issuedAt", "desc"));

  const q = query(col, ...constraints);
  const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const list: InvoiceDoc[] = snap.docs.map((d) => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
    cb(list);
  });
  return unsub;
}
