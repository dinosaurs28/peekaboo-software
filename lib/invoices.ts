"use client";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot, type QueryConstraint, type FirestoreError, runTransaction, doc, serverTimestamp, increment } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
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
function asArrayOfRecords(v: unknown): v is Array<Record<string, unknown>> { return Array.isArray(v) && v.every(isRecord); }
function asPaymentMethod(v: unknown): InvoiceDoc["paymentMethod"] {
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
  items: asArrayOfRecords(data.items) ? data.items.map((it) => ({
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
    redeemedPoints: data.redeemedPoints != null ? asNumber(data.redeemedPoints) : undefined,
    redeemedValue: data.redeemedValue != null ? asNumber(data.redeemedValue) : undefined,
    loyaltyPointsEarned: data.loyaltyPointsEarned != null ? asNumber(data.loyaltyPointsEarned) : undefined,
    grandTotal: asNumber(data.grandTotal, 0),
    paymentMethod: asPaymentMethod(data.paymentMethod),
    paymentReferenceId: typeof data.paymentReferenceId === "string" ? data.paymentReferenceId : undefined,
    balanceDue: asNumber(data.balanceDue, 0),
    cashierUserId: asString(data.cashierUserId, ""),
    cashierName: typeof data.cashierName === "string" ? data.cashierName : undefined,
    status: asInvoiceStatus(data.status),
    issuedAt: asString(data.issuedAt, now),
    createdAt: asString(data.createdAt, now),
    updatedAt: asString(data.updatedAt, now),
    exchangeOfInvoiceId: typeof data.exchangeOfInvoiceId === 'string' ? data.exchangeOfInvoiceId : undefined,
    exchangeId: typeof data.exchangeId === 'string' ? data.exchangeId : undefined,
  };
}

export type InvoiceFilters = {
  cashierUserId?: string; // legacy: filter by cashier uid (still supported)
  cashierNameEq?: string; // new: filter by cashierName (use email value when captured)
  status?: InvoiceDoc["status"]; // filter by status
  issuedFromIso?: string; // inclusive start
  issuedToIso?: string; // inclusive end
};

export function observeInvoices(cb: (invoices: InvoiceDoc[]) => void, filters?: InvoiceFilters) {
  // Be resilient if Firebase isn't initialized (e.g., missing envs in dev)
  if (!db) {
    try { cb([]); } catch { /* noop */ }
    return () => {};
  }
  const col = collection(db, COLLECTIONS.invoices);

  const constraints: QueryConstraint[] = [];
  if (filters?.status) constraints.push(where("status", "==", filters.status));
  if (filters?.cashierUserId) constraints.push(where("cashierUserId", "==", filters.cashierUserId));
  if (filters?.cashierNameEq) constraints.push(where("cashierName", "==", filters.cashierNameEq));
  if (filters?.issuedFromIso) constraints.push(where("issuedAt", ">=", filters.issuedFromIso));
  if (filters?.issuedToIso) constraints.push(where("issuedAt", "<=", filters.issuedToIso));
  constraints.push(orderBy("issuedAt", "desc"));

  const applyClientFilters = (list: InvoiceDoc[]): InvoiceDoc[] => {
    let out = list;
    if (filters?.status) out = out.filter((i) => i.status === filters.status);
    if (filters?.cashierUserId) out = out.filter((i) => i.cashierUserId === filters.cashierUserId);
    if (filters?.cashierNameEq) out = out.filter((i) => (i.cashierName || "") === filters.cashierNameEq);
    if (filters?.issuedFromIso) out = out.filter((i) => i.issuedAt >= filters.issuedFromIso!);
    if (filters?.issuedToIso) out = out.filter((i) => i.issuedAt <= filters.issuedToIso!);
    return out;
  };

  let activeUnsub: (() => void) | null = null;

  const subscribeMain = () => {
    const q = query(col, ...constraints);
    activeUnsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const list: InvoiceDoc[] = snap.docs.map((d) => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
        cb(list);
      },
      (err: FirestoreError) => {
        if (err.code === "failed-precondition") {
          // Likely missing composite index; fallback to client-side filtering
          console.warn("Missing index for invoices query; falling back to client-side filtering.", err.message);
          if (activeUnsub) { activeUnsub(); activeUnsub = null; }
          const fallbackQ = query(col, orderBy("issuedAt", "desc"));
          activeUnsub = onSnapshot(fallbackQ, (snap2: QuerySnapshot<DocumentData>) => {
            const list: InvoiceDoc[] = snap2.docs.map((d) => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
            cb(applyClientFilters(list));
          });
        } else {
          console.error("Invoices snapshot error:", err);
        }
      }
    );
  };

  subscribeMain();

  return () => {
    if (activeUnsub) activeUnsub();
  };
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;

  await runTransaction(dbx, async (tx) => {
    const invRef = doc(dbx, COLLECTIONS.invoices, invoiceId);
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) throw new Error("Invoice not found");
    const inv = invSnap.data() as any;

    // Parse invoice sequence from invoiceNumber (expected format PREFIX-000123)
    const invNum = String(inv.invoiceNumber || "");
    const dash = invNum.lastIndexOf("-");
    const seq = dash === -1 ? null : Number(invNum.slice(dash + 1));

    const settingsRef = doc(dbx, COLLECTIONS.settings, 'app');
    const settingsSnap = await tx.get(settingsRef);
    const nextSeq = settingsSnap.exists() ? Number(settingsSnap.data()?.nextInvoiceSequence ?? 1) : 1;

    // Read involved product docs and customer (reads must be before writes)
    const items: Array<any> = Array.isArray(inv.items) ? inv.items : [];
    for (const it of items) {
      const pRef = doc(dbx, COLLECTIONS.products, String(it.productId));
      await tx.get(pRef);
    }
    if (inv.customerId) {
      const cRef = doc(dbx, COLLECTIONS.customers, String(inv.customerId));
      await tx.get(cRef);
    }

    // Now perform writes: restore stock, add adjustment logs, adjust customer, delete invoice, update next sequence
    for (const it of items) {
      const pRef = doc(dbx, COLLECTIONS.products, String(it.productId));
      const qty = Number(it.quantity || 0);
      if (qty !== 0) {
        tx.update(pRef, { stock: increment(qty), updatedAt: serverTimestamp() });
      }
      const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
      tx.set(logRef, {
        productId: String(it.productId),
        quantityChange: qty,
        type: 'adjustment',
        reason: 'invoice-delete',
        relatedInvoiceId: invRef.id,
        userId: inv.cashierUserId ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Adjust customer totals/points if present
    if (inv.customerId) {
      const cRef = doc(dbx, COLLECTIONS.customers, String(inv.customerId));
      const redeemedPoints = Number(inv.redeemedPoints ?? 0);
      const earnedPoints = Number(inv.loyaltyPointsEarned ?? 0);
      const loyaltyDelta = earnedPoints - redeemedPoints;
      const grand = Number(inv.grandTotal ?? 0) || 0;
      const customerPayload: any = { updatedAt: serverTimestamp(), totalSpend: increment(-grand) };
      if (loyaltyDelta !== 0) customerPayload.loyaltyPoints = increment(-loyaltyDelta);
      tx.set(cRef, customerPayload, { merge: true });
    }

    // Delete invoice doc
    tx.delete(invRef);

    // If the deleted invoice was the latest issued (nextSeq === seq + 1), roll back nextInvoiceSequence
    if (seq !== null && settingsSnap.exists()) {
      if (nextSeq === seq + 1) {
        tx.set(settingsRef, { nextInvoiceSequence: seq, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  });
}
