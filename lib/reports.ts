"use client";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where, type DocumentData } from "firebase/firestore";
import type { InvoiceDoc, ProductDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts } from "@/lib/products";

export async function listInvoicesInRange(fromIso: string, toIso: string): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const col = collection(db, 'Invoices');
  const qy = query(col, where('issuedAt', '>=', fromIso), where('issuedAt', '<=', toIso), orderBy('issuedAt', 'asc'));
  const snap = await getDocs(qy);
  return snap.docs.map(d => toInvoiceDoc(d.id, d.data() as DocumentData as Record<string, unknown>));
}

export type Period = 'day' | 'week' | 'month';
export function groupKey(iso: string, period: Period): string {
  const dt = new Date(iso);
  if (period === 'day') return dt.toISOString().slice(0, 10);
  if (period === 'month') return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  // week: YYYY-Www based on ISO week number
  const tmp = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function aggregateByPeriod(invoices: InvoiceDoc[], period: Period) {
  const map = new Map<string, { count: number; total: number }>();
  for (const inv of invoices) {
    const key = groupKey(inv.issuedAt, period);
    const val = map.get(key) || { count: 0, total: 0 };
    val.count += 1;
    val.total += inv.grandTotal;
    map.set(key, val);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ period: k, invoices: v.count, total: v.total }));
}

export function aggregatePaymentModes(invoices: InvoiceDoc[]) {
  const modes: Array<'cash' | 'card' | 'upi' | 'wallet'> = ['cash', 'card', 'upi', 'wallet'];
  const map = new Map<string, number>();
  for (const m of modes) map.set(m, 0);
  for (const inv of invoices) {
    for (const p of inv.payments || []) {
      map.set(p.method, (map.get(p.method) || 0) + p.amount);
    }
  }
  return modes.map(m => ({ method: m, amount: map.get(m) || 0 })).filter(x => x.amount > 0);
}

export type AccountingRow = {
  date: string;
  invoiceNumber: string;
  sku: string;
  hsn: string;
  tax: number;
  discount: number;
  paymentMode: string;
  customerId?: string;
};

export async function buildAccountingCsv(fromIso: string, toIso: string, opts?: { category?: string; paymentMode?: string }) {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);
  const pmap = new Map<string, ProductDoc>();
  for (const p of products) if (p.id) pmap.set(p.id, p);

  const rows: AccountingRow[] = [];
  for (const inv of invoices) {
    // choose a single payment mode to represent the invoice if filter specified or for display; if multiple, prefer first
    const primaryPayment = inv.payments?.[0]?.method || '';
    if (opts?.paymentMode && primaryPayment !== opts.paymentMode) continue;
    for (const it of inv.items) {
      const pd = pmap.get(it.productId);
      if (opts?.category && (!pd || (pd.category || '') !== opts.category)) continue;
      const sku = pd?.sku || '';
      const hsn = pd?.hsnCode || '';
      // Discount: line discount plus proportional share of bill discount (if known via invoice.discountTotal)
      const base = it.unitPrice * it.quantity;
      const lineDisc = Number(it.discountAmount || 0);
      // Heuristic: distribute remaining discount (invoice.discountTotal - sum lineDisc) by base weight
      const remaining = Math.max(0, Number(inv.discountTotal || 0) - inv.items.reduce((s, li) => s + Number(li.discountAmount || 0), 0));
      const totalBase = inv.items.reduce((s, li) => s + li.unitPrice * li.quantity, 0) || 1;
      const proportional = remaining * (base / totalBase);
      const discount = lineDisc + proportional;
      // Tax: if item.taxRatePct exists, compute; else 0
      const tax = it.taxRatePct ? (base - discount) * (it.taxRatePct / 100) : 0;
      rows.push({
        date: inv.issuedAt,
        invoiceNumber: inv.invoiceNumber,
        sku,
        hsn,
        tax: Number(tax.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        paymentMode: primaryPayment || 'mixed',
        customerId: inv.customerId,
      });
    }
  }

  // Convert to CSV
  const headers = ['Date', 'Invoice No.', 'SKU', 'HSN', 'Tax', 'Discounts', 'Payment Mode', 'Customer ID'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const cols = [r.date, r.invoiceNumber, r.sku, r.hsn, r.tax.toString(), r.discount.toString(), r.paymentMode, r.customerId || ''];
    lines.push(cols.map(c => (c.includes(',') ? `"${c.replace(/"/g, '""')}"` : c)).join(','));
  }
  const csv = lines.join('\n');
  return csv;
}
