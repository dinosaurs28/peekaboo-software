"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import type {
  InvoiceDoc,
  InventoryLogDoc,
  UnifiedCsvRow,
} from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts } from "@/lib/products";
import { listCustomers } from "@/lib/customers";
import { db } from "@/lib/firebase";

/* ======================================================
   TYPES
====================================================== */

export type Period = "day" | "week" | "month";

export type MovementRow = {
  productId: string;
  name: string;
  sku: string;
  category?: string;
  qtyIn: number;
  qtyOut: number;
  net: number;
};

/* ======================================================
   CONSTANTS
====================================================== */

const GSTIN_REGEX =
  /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;

const DEFAULT_PLACE_OF_SUPPLY = "29-Karnataka";

/* ======================================================
   HELPERS
====================================================== */

const isValidGstin = (value: string): boolean =>
  GSTIN_REGEX.test(value);

const tsFromIso = (iso: string): Timestamp =>
  Timestamp.fromDate(new Date(iso));

const escapeCSV = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const formatRow = (row: (string | number | undefined)[]) =>
  row.map(String).map(escapeCSV).join(",");

/* ======================================================
   QUERIES
====================================================== */

export async function listInvoicesInRange(
  fromIso: string,
  toIso: string
): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const qy = query(
    collection(db, "Invoices"),
    where("issuedAt", ">=", fromIso),
    where("issuedAt", "<=", toIso),
    orderBy("issuedAt", "asc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) =>
    toInvoiceDoc(d.id, d.data() as Record<string, unknown>)
  );
}

export async function listInventoryLogsInRange(
  fromIso: string,
  toIso: string
) {
  if (!db) return [];
  const qy = query(
    collection(db, "InventoryLogs"),
    where("createdAt", ">=", tsFromIso(fromIso)),
    where("createdAt", "<=", tsFromIso(toIso)),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as InventoryLogDoc & { createdAt: Timestamp },
  }));
}

/* ======================================================
   ACCOUNTING CSV (FIXED & REQUIRED)
====================================================== */

export async function buildAccountingCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);

  const pmap = new Map(products.map((p) => [p.id, p]));

  const header = [
    "Date",
    "Invoice No.",
    "SKU",
    "HSN",
    "Tax",
    "Discounts",
    "Payment Mode",
    "Customer ID",
  ];

  const rows: (string | number | undefined)[][] = [];

  for (const inv of invoices) {
    for (const item of inv.items) {
      const prod = pmap.get(item.productId);
      if (!prod) continue;

      const value = item.unitPrice * item.quantity;
      const rate = (item.taxRatePct || 0) / 100;
      const tax = rate > 0 ? value - value / (1 + rate) : 0;

      rows.push([
        inv.issuedAt.slice(0, 10),
        inv.invoiceNumber,
        prod.sku,
        prod.hsnCode,
        tax.toFixed(2),
        item.discountAmount || 0,
        inv.paymentMethod,
        inv.customerId || "",
      ]);
    }
  }

  return [header, ...rows].map(formatRow).join("\n");
}

/* ======================================================
   GSTR-1 CSV BUILDERS
====================================================== */

export async function buildGstr1B2bCsv(fromIso: string, toIso: string) {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

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
    "Cess Amount",
  ];

  const rows = invoices.flatMap((inv) => {
    const cust = inv.customerId
      ? customerMap.get(inv.customerId)
      : undefined;
    if (!cust?.email || !isValidGstin(cust.email)) return [];

    return inv.items.map((item) => [
      cust.email,
      inv.invoiceNumber, // This is already a string
      inv.issuedAt.slice(0, 10),
      inv.grandTotal.toFixed(2),
      DEFAULT_PLACE_OF_SUPPLY,
      "N",
      item.taxRatePct || "",
      "Regular",
      "",
      item.taxRatePct || "",
      (item.unitPrice * item.quantity).toFixed(2), // This is already a string
      "",
    ]);
  });

  return [header, ...rows].map(formatRow).join("\n");
}

export async function buildGstr1B2clCsv(fromIso: string, toIso: string) {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const header = [
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Cess Amount",
    "GSTIN/UIN of Recipient",
  ];

  const rows = invoices.flatMap((inv) => {
    const cust = inv.customerId
      ? customerMap.get(inv.customerId)
      : undefined;
    if (cust?.email && isValidGstin(cust.email)) return [];

    return inv.items.map((item) => [
      item.taxRatePct,
      item.taxRatePct || "",
      (item.unitPrice * item.quantity).toFixed(2),
      "",
      cust?.phone || "",
    ]);
  });

  return [header, ...rows].map(formatRow).join("\n");
}

export async function buildGstr1HsnCsv(fromIso: string, toIso: string) {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);

  type HsnAgg = {
    description: string;
    totalQty: number;
    totalValue: number;
    taxableValue: number;
    taxAmount: number;
  };

  const productMap = new Map(products.map((p) => [p.id, p]));
  const hsnMap = new Map<string, HsnAgg>();

  for (const inv of invoices) {
    for (const item of inv.items) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;

      const hsn = prod.hsnCode || "N/A";
      const entry =
        hsnMap.get(hsn) || {
          description: prod.name,
          totalQty: 0,
          totalValue: 0,
          taxableValue: 0,
          taxAmount: 0,
        };

      const value = item.unitPrice * item.quantity;
      const rate = (item.taxRatePct || 0) / 100;
      const tax = rate > 0 ? value - value / (1 + rate) : 0;

      entry.totalQty += item.quantity;
      entry.totalValue += value;
      entry.taxableValue += value - tax;
      entry.taxAmount += tax;

      hsnMap.set(hsn, entry);
    }
  }

  const header = [
    "HSN",
    "Description",
    "Total Quantity",
    "Total Value",
    "Taxable Value",
    "Tax Amount",
  ];

  const rows = Array.from(hsnMap.entries()).map(
    ([hsn, d]) => [
      hsn,
      d.description,
      d.totalQty, // This is already a number
      d.totalValue.toFixed(2),
      d.taxableValue.toFixed(2),
      d.taxAmount.toFixed(2),
    ]
  );

  return [header, ...rows].map(formatRow).join("\n");
}

/* ======================================================
   ROW BUILDERS
====================================================== */

export async function buildAccountingRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildAccountingCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [date, inv, sku, hsn, tax, , payment] = l.split(",");
      return {
        reportType: "ACCOUNTING",
        date,
        invoiceNumber: inv,
        sku,
        hsn,
        taxAmount: Number(tax),
        paymentMode: payment,
      };
    });
}

export async function buildGstr1B2bRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildGstr1B2bCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [
        gstin,
        invoiceNumber,
        date,
        invoiceValue,
        ,
        ,
        ,
        ,
        ,
        rate,
        taxableValue,
      ] = l.split(",");
      return {
        reportType: "GSTR1_B2B",
        gstin,
        invoiceNumber,
        date,
        invoiceValue: Number(invoiceValue),
        taxRate: Number(rate),
        taxableValue: Number(taxableValue),
      };
    });
}

export async function buildGstr1B2clRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildGstr1B2clCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [rate, , taxableValue, , gstin] = l.split(",");
      return {
        reportType: "GSTR1_B2CL",
        gstin,
        taxRate: Number(rate),
        taxableValue: Number(taxableValue),
      };
    });
}

export async function buildGstr1HsnRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildGstr1HsnCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [hsn, , , totalValue, taxableValue, taxAmount] =
        l.split(",");
      return {
        reportType: "GSTR1_HSN",
        hsn,
        invoiceValue: Number(totalValue),
        taxableValue: Number(taxableValue),
        taxAmount: Number(taxAmount),
      };
    });
}

/* ======================================================
   🔥 UNIFIED CSV EXPORT
====================================================== */

export async function buildUnifiedExportCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const rows: UnifiedCsvRow[] = [
    ...(await buildAccountingRows(fromIso, toIso)),
    ...(await buildGstr1B2bRows(fromIso, toIso)),
    ...(await buildGstr1B2clRows(fromIso, toIso)),
    ...(await buildGstr1HsnRows(fromIso, toIso)),
  ];

  const header = [
    "Report Type",
    "Date",
    "Invoice Number",
    "GSTIN",
    "SKU",
    "HSN",
    "Taxable Value",
    "Tax Rate",
    "Tax Amount",
    "Invoice Value",
    "Payment Mode",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.reportType,
        r.date ?? "",
        r.invoiceNumber ?? "",
        r.gstin ?? "",
        r.sku ?? "",
        r.hsn ?? "",
        r.taxableValue ?? "",
        r.taxRate ?? "",
        r.taxAmount ?? "",
        r.invoiceValue ?? "",
        r.paymentMode ?? "",
      ].join(",")
    ),
  ];

  return lines.join("\n");
}

/* ======================================================
   INVENTORY MOVEMENT
====================================================== */

export async function aggregateInventoryMovement(
  fromIso: string,
  toIso: string,
  opts?: { category?: string }
): Promise<MovementRow[]> {
  const [logs, products] = await Promise.all([
    listInventoryLogsInRange(fromIso, toIso),
    listProducts(),
  ]);

  const pmap = new Map(products.map((p) => [p.id, p]));
  const rowsMap = new Map<string, MovementRow>();

  for (const entry of logs) {
    const l = entry.data as InventoryLogDoc & {
      productId: string;
      quantityChange: number;
    };
    const prod = pmap.get(l.productId);
    if (!prod) continue;

    const row =
      rowsMap.get(l.productId) || {
        productId: l.productId,
        name: prod.name,
        sku: prod.sku,
        category: prod.category,
        qtyIn: 0,
        qtyOut: 0,
        net: 0,
      };

    const delta = Number(l.quantityChange || 0);
    if (delta >= 0) row.qtyIn += delta;
    else row.qtyOut += Math.abs(delta);
    row.net += delta;

    rowsMap.set(l.productId, row);
  }

  return Array.from(rowsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function aggregateByPeriod(
  invoices: { issuedAt: string; grandTotal: number }[],
  period: Period
) {
  const map = new Map<string, { count: number; total: number }>();

  for (const inv of invoices) {
    const dt = new Date(inv.issuedAt);
    let key = "";

    if (period === "day") {
      key = dt.toISOString().slice(0, 10);
    } else if (period === "month") {
      key = `${dt.getUTCFullYear()}-${String(
        dt.getUTCMonth() + 1
      ).padStart(2, "0")}`;
    } else {
      // ISO week
      const tmp = new Date(
        Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
      );
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(
        ((+tmp - +yearStart) / 86400000 + 1) / 7
      );
      key = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }

    const val = map.get(key) ?? { count: 0, total: 0 };
    val.count += 1;
    val.total += inv.grandTotal;
    map.set(key, val);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      invoices: v.count,
      total: v.total,
    }));
}


export function aggregatePaymentModes(
  invoices: { paymentMethod: string; grandTotal: number }[]
) {
  const map = new Map<string, number>();

  for (const inv of invoices) {
    map.set(
      inv.paymentMethod,
      (map.get(inv.paymentMethod) ?? 0) + inv.grandTotal
    );
  }

  return Array.from(map.entries()).map(([method, amount]) => ({
    method,
    amount,
  }));
}
