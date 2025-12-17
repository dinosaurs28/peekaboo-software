'use client';

import { 
  collection, 
  getDocs, 
  orderBy, 
  query, 
  where, 
  Timestamp 
} from "firebase/firestore";
import type { InvoiceDoc, InventoryLogDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts } from "@/lib/products";
import { listCustomers } from "@/lib/customers";
import { db } from "@/lib/firebase";

// Constants
const GSTIN_REGEX = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;
const DEFAULT_PLACE_OF_SUPPLY = "29-Karnataka";
const PAYMENT_MODES = ['cash', 'card', 'upi', 'wallet'] as const;

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
const isValidGstin = (value: string): boolean => GSTIN_REGEX.test(value);

const tsFromIso = (iso: string): Timestamp => 
  Timestamp.fromDate(new Date(iso));

const escapeCSV = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const formatRow = (row: (string | number)[]): string =>
  row.map(String).map(escapeCSV).join(',');

// Query functions
export async function listInvoicesInRange(fromIso: string, toIso: string): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const qy = query(
    collection(db, 'Invoices'),
    where('issuedAt', '>=', fromIso),
    where('issuedAt', '<=', toIso),
    orderBy('issuedAt', 'asc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
}

export async function listInventoryLogsInRange(fromIso: string, toIso: string) {
  if (!db) return [];
  const qy = query(
    collection(db, 'InventoryLogs'),
    where('createdAt', '>=', tsFromIso(fromIso)),
    where('createdAt', '<=', tsFromIso(toIso)),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ 
    id: d.id, 
    data: d.data() as InventoryLogDoc & { createdAt: Timestamp } 
  }));
}

// Aggregation functions
export function groupKey(iso: string, period: Period): string {
  const dt = new Date(iso);
  
  if (period === 'day') return dt.toISOString().slice(0, 10);
  if (period === 'month') return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  
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
    const val = map.get(key) ?? { count: 0, total: 0 };
    val.count++;
    val.total += inv.grandTotal;
    map.set(key, val);
  }
  
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ period: k, invoices: v.count, total: v.total }));
}

export function aggregatePaymentModes(invoices: InvoiceDoc[]) {
  const map = new Map<string, number>(PAYMENT_MODES.map(m => [m, 0]));
  
  for (const inv of invoices) {
    map.set(inv.paymentMethod, (map.get(inv.paymentMethod) ?? 0) + inv.grandTotal);
  }
  
  return PAYMENT_MODES
    .map(m => ({ method: m, amount: map.get(m) ?? 0 }))
    .filter(x => x.amount > 0);
}

// CSV Export functions - B2B
export async function buildGstr1B2bCsv(fromIso: string, toIso: string): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);
  const customerMap = new Map(customers.map(c => [c.id, c]));
  
  const header = [
    "GSTIN/UIN of Recipient", "Invoice Number", "Invoice date", "Invoice Value",
    "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type",
    "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"
  ];
  
  const rows = invoices.flatMap(inv => {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    if (!cust?.email || !isValidGstin(cust.email)) return [];
    
    return inv.items.map(item => [
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
  });
  
  return [header, ...rows].map(r => formatRow(r.map(String))).join('\n');
}

// CSV Export functions - B2CL
export async function buildGstr1B2clCsv(fromIso: string, toIso: string): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);
  const customerMap = new Map(customers.map(c => [c.id, c]));
  
  const header = ["Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "GSTIN/UIN of Recipient"];

  const rows = invoices.flatMap(inv => {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    if (cust?.email && isValidGstin(cust.email)) return [];

    return inv.items.map(item => [
      item.taxRatePct || "",
      item.taxRatePct || "",
      (item.unitPrice * item.quantity).toFixed(2),
      "",
      cust?.phone || ""
    ]);
  });
  
  return [header, ...rows].map(r => formatRow(r.map(String))).join('\n');
}

// CSV Export functions - B2cs
export async function buildGstr1B2csCsv(fromIso: string, toIso: string): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const header = ["Place Of Supply", "Rate", "Taxable Value", "Cess Amount", "Type of Supply", "E-Commerce GSTIN"];
  const rows = invoices.flatMap(inv => {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    if (cust?.email && (isValidGstin(cust.email) || cust.email === 'unregistered')) return [];
    return inv.items.map(item => [
      DEFAULT_PLACE_OF_SUPPLY,
      item.taxRatePct || "",
      (item.unitPrice * item.quantity).toFixed(2),
      "",
      "Inter-State",
      ""
    ]);
  });
  
  return [header, ...rows].map(r => formatRow(r.map(String))).join('\n');
}

// CSV Export functions - hsn
export async function buildGstr1HsnCsv(fromIso: string, toIso: string): Promise<string> {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);
  const productMap = new Map(products.map(p => [p.id, p]));
  const header = ["HSN/SAC", "Description", "UQC", "Total Quantity", "Total Value", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"];
  
  const hsnMap = new Map<string, { description: string; uqc: string; totalQty: number; totalValue: number; taxableValue: number; integratedTax: number; centralTax: number; stateTax: number; cessAmount: number }>()
  
  for (const inv of invoices) {
    for (const item of inv.items) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;
      const hsn = prod.hsnCode || 'N/A';
      const entry = hsnMap.get(hsn) ?? {
        description: prod.name,
        uqc: prod.hsnCode || '', // Using HSN code as UQC for simplicity
        totalQty: 0,
        totalValue: 0,
        taxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cessAmount: 0,
      };
      const qty = item.quantity;
      const value = item.unitPrice * qty;
      const taxRate = (Number(item.taxRatePct || 0)) / 100;
      const taxAmount = taxRate > 0 ? (value - value / (1 + taxRate)) : 0;
      entry.totalQty += qty;
      entry.totalValue += value;
      entry.taxableValue += value - taxAmount;
      // For simplicity, assuming all tax is state tax
      entry.stateTax += taxAmount;
      hsnMap.set(hsn, entry);
    }
  }
  const rows = Array.from(hsnMap.entries()).map(([hsn, data]) => [
    hsn,
    data.description,
    data.uqc,
    data.totalQty,
    data.totalValue.toFixed(2),
    data.taxableValue.toFixed(2),
    data.integratedTax.toFixed(2),
    data.centralTax.toFixed(2),
    data.stateTax.toFixed(2),
    data.cessAmount.toFixed(2),
  ]);
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
  
  const rows = invoices.flatMap(inv => {
    const primaryPayment = inv.paymentMethod || 'mixed';
    if (opts?.paymentMode && primaryPayment !== opts.paymentMode) return [];
    
    const totalMrp = inv.items.reduce((s, li) => s + li.unitPrice * li.quantity, 0) || 1;
    
    return inv.items.map(it => {
      const pd = pmap.get(it.productId);
      if (opts?.category && (!pd || (pd.category || '') !== opts.category)) return null;
      
      const mrp = it.unitPrice * it.quantity;
      const lineDisc = Number(it.discountAmount || 0);
      const remaining = Math.max(0, (Number(inv.discountTotal || 0)) - inv.items.reduce((s, li) => s + Number(li.discountAmount || 0), 0));
      const proportional = remaining * (mrp / totalMrp);
      const discount = lineDisc + proportional;
      
      const taxRate = (Number(it.taxRatePct || 0)) / 100;
      const tax = taxRate > 0 ? (mrp - mrp / (1 + taxRate)) : 0;
      
      return {
        date: inv.issuedAt,
        invoiceNumber: inv.invoiceNumber,
        sku: pd?.sku || '',
        hsn: pd?.hsnCode || '',
        tax: Number(tax.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        paymentMode: primaryPayment,
        customerId: inv.customerId,
      } as AccountingRow;
    }).filter((x): x is AccountingRow => x !== null);
  });
  
  const headers = ['Date', 'Invoice No.', 'SKU', 'HSN', 'Tax', 'Discounts', 'Payment Mode', 'Customer ID'];
  const lines = [formatRow(headers)];
  
  for (const r of rows) {
    lines.push(formatRow([r.date, r.invoiceNumber, r.sku, r.hsn, r.tax, r.discount, r.paymentMode, r.customerId || ''].map(String)));
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
    const l = entry.data as InventoryLogDoc & { productId: string; quantityChange: number };
    const prod = pmap.get(l.productId);
    
    if (!prod || (opts?.category && (prod.category || '') !== opts.category)) continue;
    
    const row = rowsMap.get(l.productId) ?? 
      { productId: l.productId, name: prod.name, sku: prod.sku, category: prod.category, qtyIn: 0, qtyOut: 0, net: 0 };
    
    const delta = Number(l.quantityChange || 0);
    if (delta >= 0) row.qtyIn += delta;
    else row.qtyOut += Math.abs(delta);
    row.net += delta;
    
    rowsMap.set(l.productId, row);
  }
  
  return Array.from(rowsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
