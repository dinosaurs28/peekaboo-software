"use client";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where, type DocumentData, Timestamp } from "firebase/firestore";
import type { InvoiceDoc, ProductDoc, InventoryLogDoc } from "@/lib/models";
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
    map.set(inv.paymentMethod, (map.get(inv.paymentMethod) || 0) + inv.grandTotal);
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
  const primaryPayment = inv.paymentMethod || '';
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

// Inventory movement summary (qty in/out/net) based on InventoryLogs
export type MovementRow = {
  productId: string;
  name: string;
  sku: string;
  category?: string;
  qtyIn: number; // sum of positive movements (purchase/return/adjustment+)
  qtyOut: number; // sum of abs(negative movements) (sale/damage/adjustment-)
  net: number; // qtyIn - qtyOut (or sum of quantityChange)
};

function tsFromIso(iso: string): Timestamp {
  const d = new Date(iso);
  return Timestamp.fromDate(d);
}

function toIsoFromCreatedAt(v: unknown): string {
  // Utility if needed elsewhere; not used in aggregation now
  try {
    // Firestore Timestamp
    if (v && typeof v === 'object' && 'toDate' in (v as any)) {
      return (v as any).toDate().toISOString();
    }
  } catch {}
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

export async function listInventoryLogsInRange(fromIso: string, toIso: string): Promise<Array<{ id: string; data: InventoryLogDoc & { createdAt: any } }>> {
  if (!db) return [];
  const col = collection(db, 'InventoryLogs');
  // Query by createdAt range; Firestore stores Timestamps, so use Timestamp bounds
  const qy = query(col, where('createdAt', '>=', tsFromIso(fromIso)), where('createdAt', '<=', tsFromIso(toIso)), orderBy('createdAt', 'asc'));
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, data: d.data() as DocumentData as any }));
}

export async function aggregateInventoryMovement(fromIso: string, toIso: string, opts?: { category?: string }) {
  const [logs, products] = await Promise.all([
    listInventoryLogsInRange(fromIso, toIso),
    listProducts(),
  ]);
  const pmap = new Map<string, ProductDoc>();
  for (const p of products) if (p.id) pmap.set(p.id, p);

  const rowsMap = new Map<string, MovementRow>();
  for (const entry of logs) {
    const l = entry.data as unknown as InventoryLogDoc & { productId: string; quantityChange: number; type: string };
    const prod = pmap.get(l.productId);
    if (!prod) continue;
    if (opts?.category && (prod.category || '') !== opts.category) continue;
    const key = l.productId;
    let row = rowsMap.get(key);
    if (!row) {
      row = { productId: l.productId, name: prod.name, sku: prod.sku, category: prod.category, qtyIn: 0, qtyOut: 0, net: 0 };
      rowsMap.set(key, row);
    }
    const delta = Number(l.quantityChange || 0);
    if (delta >= 0) row.qtyIn += delta; else row.qtyOut += Math.abs(delta);
    row.net += delta;
  }
  return Array.from(rowsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
