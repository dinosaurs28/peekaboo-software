# Peekaboo POS – Test Checklist

A concise, step-by-step list to validate all implemented features. Use Admin unless noted. Record pass/fail and notes.

## 0) Environment & Access
- App loads without errors; Firebase envs present (see Debug → Firebase page if available).
- Login:
  - Admin can access Settings, Reports, Offers, Barcode Generator.
  - Cashier can access POS, Invoices; admin-only pages are hidden.

## 1) Products & Categories
- Create a new Category (e.g., Toys) and verify it appears in Product form dropdown.
- Create Product: name, SKU, HSN, price, taxRatePct, category, reorder level, active=true.
- Edit Product: change price/tax/category; confirm updates save.
- Delete Product: optional (ensure it’s not used in recent tests if deleting).
- Low-stock threshold: set reorderLevel; verify dashboard low-stock reflects it.

## 2) Inventory: Receive & Logs
- Settings → Receive:
  - Scan PB|CAT|SKU or type SKU; add lines; set qty and optional unitCost.
  - Post Receipt: confirm success message (Receipt ID).
  - Verify product stock increased accordingly.
  - Check Inventory Logs: entries exist per line with type=purchase, reason=receive.

## 3) Barcode Labels
- Barcode Generator:
  - Select product and quantity.
  - Export A4 PDF: preview shows correct name, barcode, and code text.
  - Optional: enable "Add to stock on export" then export; confirm stock increased and Goods Receipt + logs created.
  - Scan printed barcode in POS: item is found.

## 4) POS & Billing
- Add items via scan and search; item merges when scanned twice.
- Apply item-level discount (₹ and %) and verify line totals.
- Apply bill-level discount (₹ and %); totals update correctly.
- GST: set product taxRatePct; verify invoice tax reflects per-line slabs with proportional bill-discount.
- Checkout with: Cash, Card, UPI, Wallet; optional reference for non-cash.
- Verify invoice number increments sequentially (PREFIX-000001, ...).
- Stock decreases as per sale; Inventory Logs show type=sale linked to invoice.

## 5) Customers
- In POS: enter phone; if new, provide name; checkout creates/links customer.
- Customers page: find the customer; detail shows purchase history and metrics (total spend, visits, last purchase).

## 6) Offers
- Create offers (admin): flat, percentage, BOGO same item; with product and category targeting; set dates.
- POS: active offers panel lists applicable offers; apply/clear changes cart totals as expected.

## 7) Invoices & Prints
- Invoices list: filter by date/status/cashier; open a detail page.
- Print A4: branding (logo/name/address/GSTIN/footer) appears; totals correct; window print auto-opens.
- Print 80mm: same validation for thermal; amounts and formats are legible.

## 8) Reports
- Sales: pick range and group (day/week/month); table shows periods, invoice counts, totals.
- Payment Mode: totals by method match invoices in date range.
- Accounting Export: range/category/payment filters; CSV and XLSX download; fields include Date, Invoice No., SKU, HSN, Tax, Discounts, Payment Mode, Customer ID.
- Stock Report: filter by category and low-stock; export CSV/XLSX; values match products.
- Movement Summary: choose date range and category; Qty In/Out/Net match InventoryLogs; export CSV/XLSX.

## 9) Settings & Branding
- Business Profile: update logo URL, name, address, GSTIN, footer; Save.
- Print pages reflect updates (A4 and 80mm templates).
- Invoice prefix and counter update correctly on checkout.

## 10) Security & Integrity
- Firestore Rules: as cashier, ensure admin-only pages redirect; writes blocked for restricted fields.
- Negative values are blocked: product prices/stock, invoice discounts/qty.
- Composite indexes deployed: no index error prompts during report/invoice queries.

## 11) Edge Cases & Resilience
- Refresh POS during cart: app remains stable; input focus restored.
- Scanner double-scan check: quick successive scans merge correctly (where supported by UI).
- Network hiccup: UI shows friendly messages; no duplicate invoices on retry.

## 12) Acceptance
- Invoices print cleanly with correct branding and math.
- Inventory movement and stock values reconcile with actions taken.
- Reports export correct, filtered datasets.
- Permissions behave as expected; no unauthorized data changes.

Notes:
- For label printers (4"): set the printer’s paper size to match your label and print at 100% with headers/footers off.
- If any query requests an index, deploy indexes using Firebase CLI and retry after build completes.
