'use client';

import { collection, getDocs, orderBy, query, where, type DocumentData, Timestamp } from "firebase/firestore";
import type { InvoiceDoc, ProductDoc, InventoryLogDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts } from "@/lib/products";
import { listCustomers } from "@/lib/customers";
import { db } from "@/lib/firebase";

// Constants
const GSTIN_REGEX = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;
const DEFAULT_PLACE_OF_SUPPLY = "29-Karnataka";

// Types
export type Period = 'day' | 'week' | 'month';

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

export type MovementRow = {
  productId: string;
  name: string;
  sku: string;
  category?: string;
  qtyIn: number;
  qtyOut: number;
  net: number;
};

// Helpers
function isValidGstin(value: string): boolean {
  return GSTIN_REGEX.test(value);
}

function tsFromIso(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso));
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatRow(row: (string | number)[]): string {
  return row.map(String).map(escapeCSV).join(',');
}

// Query functions
export async function listInvoicesInRange(fromIso: string, toIso: string): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const col = collection(db, 'Invoices');
  const qy = query(
    col,
    where('issuedAt', '>=', fromIso),
    where('issuedAt', '<=', toIso),
    orderBy('issuedAt', 'asc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
}

export async function listInventoryLogsInRange(fromIso: string, toIso: string) {
  if (!db) return [];
  const col = collection(db, 'InventoryLogs');
  const qy = query(
    col,
    where('createdAt', '>=', tsFromIso(fromIso)),
    where('createdAt', '<=', tsFromIso(toIso)),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, data: d.data() as InventoryLogDoc & { createdAt: any } }));
}

// Aggregation functions
export function groupKey(iso: string, period: Period): string {
  const dt = new Date(iso);
  
  if (period === 'day') {
    return dt.toISOString().slice(0, 10);
  }
  
  if (period === 'month') {
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  
  // ISO week number
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
    val.count++;
    val.total += inv.grandTotal;
    map.set(key, val);
  }
  
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ period: k, invoices: v.count, total: v.total }));
}

export function aggregatePaymentModes(invoices: InvoiceDoc[]) {
  const modes = ['cash', 'card', 'upi', 'wallet'] as const;
  const map = new Map<string, number>(modes.map(m => [m, 0]));
  
  for (const inv of invoices) {
    map.set(inv.paymentMethod, (map.get(inv.paymentMethod) ?? 0) + inv.grandTotal);
  }
  
  return modes.map(m => ({ method: m, amount: map.get(m) ?? 0 })).filter(x => x.amount > 0);
}

// CSV Export functions b2b
export async function buildGstr1B2bCsv(fromIso: string, toIso: string): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);
  
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const header = [
    "GSTIN/UIN of Recipient",
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Place Of Supply",
    "Reverse Charge",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Rate",
    "Taxable Value",
    "Cess Amount"
  ];
  
  const rows: (string | number)[][] = [];
  
  for (const inv of invoices) {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    if (!cust?.email || !isValidGstin(cust.email)) continue;
    
    for (const item of inv.items) {
      rows.push([
        cust.email,
        inv.invoiceNumber,
        inv.issuedAt.slice(0, 10),
        inv.grandTotal.toFixed(2),
        DEFAULT_PLACE_OF_SUPPLY,
        "N",
        item.taxRatePct || "",
        "Regular",
        "",
        item.taxRatePct || "",
        (item.unitPrice * item.quantity).toFixed(2),
        ""
      ]);
    }
  }
  
  return [header, ...rows].map(r => formatRow(r.map(String))).join('\n');
}

export async function buildAccountingCsv(
  fromIso: string,
  toIso: string,
  opts?: { category?: string; paymentMode?: string }
): Promise<string> {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);
  
  const pmap = new Map(products.filter(p => p.id).map(p => [p.id!, p]));
  const rows: AccountingRow[] = [];
  
  for (const inv of invoices) {
    const primaryPayment = inv.paymentMethod || 'mixed';
    if (opts?.paymentMode && primaryPayment !== opts.paymentMode) continue;
    
    for (const it of inv.items) {
      const pd = pmap.get(it.productId);
      if (opts?.category && (!pd || (pd.category || '') !== opts.category)) continue;
      
      const mrp = it.unitPrice * it.quantity;
      const lineDisc = Number(it.discountAmount || 0);
      const remaining = Math.max(0, Number(inv.discountTotal || 0) - inv.items.reduce((s, li) => s + Number(li.discountAmount || 0), 0));
      const totalMrp = inv.items.reduce((s, li) => s + li.unitPrice * li.quantity, 0) || 1;
      const proportional = remaining * (mrp / totalMrp);
      const discount = lineDisc + proportional;
      
      const taxRate = (Number(it.taxRatePct || 0)) / 100;
      const tax = taxRate > 0 ? (mrp - mrp / (1 + taxRate)) : 0;
      
      rows.push({
        date: inv.issuedAt,
        invoiceNumber: inv.invoiceNumber,
        sku: pd?.sku || '',
        hsn: pd?.hsnCode || '',
        tax: Number(tax.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        paymentMode: primaryPayment,
        customerId: inv.customerId,
      });
    }
  }
  
  const headers = ['Date', 'Invoice No.', 'SKU', 'HSN', 'Tax', 'Discounts', 'Payment Mode', 'Customer ID'];
  const lines = [formatRow(headers)];
  
  for (const r of rows) {
    const cols = [r.date, r.invoiceNumber, r.sku, r.hsn, r.tax, r.discount, r.paymentMode, r.customerId || ''];
    lines.push(formatRow(cols.map(String)));
  }
  
  return lines.join('\n');
}

export async function aggregateInventoryMovement(
  fromIso: string,
  toIso: string,
  opts?: { category?: string }
): Promise<MovementRow[]> {
  const [logs, products] = await Promise.all([
    listInventoryLogsInRange(fromIso, toIso),
    listProducts(),
  ]);
  
  const pmap = new Map(products.filter(p => p.id).map(p => [p.id!, p]));
  const rowsMap = new Map<string, MovementRow>();
  
  for (const entry of logs) {
    const l = entry.data as unknown as InventoryLogDoc & { productId: string; quantityChange: number };
    const prod = pmap.get(l.productId);
    
    if (!prod || (opts?.category && (prod.category || '') !== opts.category)) continue;
    
    let row = rowsMap.get(l.productId);
    if (!row) {
      row = { productId: l.productId, name: prod.name, sku: prod.sku, category: prod.category, qtyIn: 0, qtyOut: 0, net: 0 };
      rowsMap.set(l.productId, row);
    }
    
    const delta = Number(l.quantityChange || 0);
    if (delta >= 0) {
      row.qtyIn += delta;
    } else {
      row.qtyOut += Math.abs(delta);
    }
    row.net += delta;
  }
  
  return Array.from(rowsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
