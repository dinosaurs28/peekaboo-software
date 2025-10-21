## TODO
1. Once auth is confirmed make this change in firebase rules - 
allow read, write: if request.auth != null;

# Scope
🔹 Phase 2: Product & Inventory (Day 4–7)

Deliverables:

Product CRUD (Add/Edit/Delete, SKU, HSN Code, Pricing, GST)

Categories for products (Toys, Clothes, Books, etc.)

Inventory tracking (real-time stock deduction)

Low stock alerts (dashboard + notifications)

Barcode Generator (Admin Only)

Generate barcodes (single + bulk)

Export PDF for label printing

✅ Output: Admin can set up catalog, generate barcodes, and stock system is live.

🔹 Phase 3: POS & Billing (Day 8–12)

Deliverables:

POS UI (fast product search: name/barcode)

Add multiple items to cart

Discounts (item-level + bill-level)

Tax handling (GST slab calculation)

Invoice generation (printable + downloadable PDF, email option)

Multi-payment support (Cash, UPI, Card, Wallet)

Split payment support

✅ Output: Cashiers can complete sales smoothly with invoices generated.

🔹 Phase 4: Customer & Offers (Day 13–16)

Deliverables:

Customer CRUD (name, phone, email, DOB)

Customer purchase history tracking

Personalized Offers Module

Event/Fest-based offers (Diwali, Back-to-School, etc.)

DOB-based offers (Birthday month alerts at POS)

Offer rules engine (% off, flat off, BOGO)

POS auto-alert for active offers

✅ Output: Store can engage customers with special offers & capture loyalty.

🔹 Phase 5: Reports & Accounting (Day 17–19)

Deliverables:

Daily/Weekly/Monthly Sales Reports

Stock Report

Payment Mode Report

Accounting-friendly export (CSV/XLSX) with:

Date, Invoice No., SKU, HSN, Tax, Discounts, Payment Mode, Customer ID

Export filters (date range, category, payment mode)

✅ Output: Store can generate reports that plug directly into accounting software.

🔹 Phase 6: Polish & Integrations (Day 20–21)

Deliverables:

UI refinements (mobile-first POS & dashboard views)

Invoice template customization (store branding)

Final security & role permission check

Seed demo data for testing

✅ Output: Complete app feature-ready for testing cycle.

## Implementation status (Phases 2–5)

What’s done
- Phase 2: Products, Categories, Inventory
	- Product CRUD with SKU/HSN/price/tax; live Categories (list/new/edit); real-time inventory tracking with transactional adjustments; low-stock alerts on dashboard.
	- Barcode Generator (single/bulk) with A4 label PDF; Category code included in PB|CAT|SKU.
	- Inventory Logs written on sales and receiving; admin viewer with filters.
- Phase 3: POS & Billing
	- POS panel: fast scan/search, multi-item cart, item-level and bill-level discounts, keyboard shortcuts.
	- GST calculation per line (taxRatePct) with proportional bill-discount allocation; invoice totals reflect tax.
	- Invoice creation with cashier/customer linkage; invoice list + details; admin print for A4 and 80mm thermal receipt.
	- Single payment (Cash/Card/UPI/Wallet); split payments removed by design.
- Phase 4: Customers & Offers
	- Customer capture in POS (create-if-missing by phone); customers list with search; customer detail with real-time purchase history + metrics (total spend, visits, last purchase, top items).
	- Offers module (admin): create/edit/list with active dates, product/category/bill targeting, flat/%/BOGO(same item), DOB-month-only, event tag, priority/exclusive.
	- POS: Active offers panel, apply/clear; auto-alert suggests best applicable offer based on cart and DOB.
- Phase 5: Reports & Accounting
	- Sales report grouped by day/week/month.
	- Payment Mode report.
	- Accounting CSV export (date range, category, payment mode) with Date, Invoice No., SKU, HSN, Tax, Discounts, Payment Mode, Customer ID.

Known gaps (outside Phase 6)
- Phase 3
	- PDF generation and email-send are optional and not implemented by design (browser print used).
- Phase 5
	- [Done] Stock report page/export (current stock and low-stock CSV + XLSX).
	- [Done] XLSX export option alongside CSV.
- Cross-cutting
	- [Done] Composite Firestore indexes configured (Invoices and InventoryLogs); deploy via CLI when project is connected to Firebase.

## Testing brief (End-to-end checklist)

Setup & auth
- App boots without “Internal Server Error”; env vars loaded.
- Login as Admin and Cashier; routes and visibility match roles.

Products & categories
- Create/edit/delete product; SKU unique in practice; taxRatePct saved.
- Create/edit categories; Product form category dropdown shows live categories.

Inventory & barcodes
- Receive stock via Settings → Receive; stock increments; GoodsReceipt created; logs written per line.
- POS sale decrements stock transactionally; sale logs linked to invoice.
- Dashboard low-stock panel updates in real-time after adjustments.
- Generate A4 PDF labels; scan in POS: PB|CAT|SKU decodes correctly.

POS & billing
- Scan valid/invalid codes: success/error toasts; input focus preserved.
- Search by name/SKU; add/merge lines; +/- and Delete keys work on selected line.
- Item discount: switch ₹/% and verify math per line.
- Bill discount: switch ₹/% and verify totals.
- GST: set product taxRatePct; verify line tax and invoice taxTotal; bill-discount reduces tax base proportionally.
- Payment: choose one method (cash/card/upi/wallet); optional reference; checkout succeeds with a single payment recorded.

Customers
- Enter phone: existing customer auto-fills name/email/DOB; new phone requires name; created on checkout.
- Customer detail: purchase history real-time; metrics (total spend, visits, last purchase, top items) accurate.

Offers
- Create offers: flat/%, BOGO(same), product/category/bill targeting, dates active, DOB-month-only.
- POS shows active offers; suggested offer appears when eligible; apply affects line or bill as configured; clear resets discounts.

Invoices
- Cashier sees own invoices; Admin sees all; filters (date/status/cashier) work; index prompts handled.
- Details page displays lines, discounts, totals; Admin Print A4 and Print 80mm open in new tabs and auto-open print dialog; URL back to list works.
- Verify invoice numbers are sequential (PREFIX-000001, …). Confirm Settings/app { invoicePrefix, nextInvoiceSequence } increments on each checkout.

Reports
- Sales report: choose range and group; table shows periods, invoice counts, totals.
- Payment mode report: range filter; totals per method correct.
- Accounting export: range/category/payment filters; CSV builds; Preview and Download work; discounts and tax columns populated.

Resilience & permissions
- Refresh during POS use doesn’t crash; draft cart persists and can be cleared.
- Auth-protected routes redirect when unauthenticated; admin-only pages hidden for cashiers.

## Next implementations (success-critical roadmap)

1) Invoices & receipts
- Store branding on print templates (logo, address, GSTIN) driven from Settings (Business Profile).
- Optional: PDF generation and email option (if needed later).

2) Stock reports
 - Reports → Stock: Current Stock CSV and Low-Stock CSV (filters by category, reorder only). [Done]
 - XLSX export for Stock and Accounting. [Done]
 - Optional: Inventory movement summary for a date range using logs (qty in/out, net).

3) Data integrity & security [Done]
- Firestore Security Rules v1: role-based read/write per collection; validators (e.g., non-negative stock, price limits); deny role escalation.
- Composite indexes for common queries (customerId+issuedAt desc, issuedAt+status, issuedAt+cashierUserId).

6) Returns/voids & after-sales [Discuss with Client]
- Add returns/void/exchange flow that reverses stock and annotates invoices; write inventory logs accordingly.

7) Loyalty and engagement (optional)
- Basic loyalty points accrual on net spend and redemption at POS; show balance on customer detail and POS.

4) UX polish (Phase 6 alignment)
- Mobile-first POS and dashboard layout tweaks; sticky totals panel; larger touch targets.
- Settings: invoice template customization (logo, address, tax IDs, footer notes).

5) Ops & quality
- Seed demo data script for products/customers/offers.
- Optional: E2E tests (Playwright) for core flows; add CI gates for build/typecheck/lint.
- Optional: Error monitoring (Sentry) and lightweight analytics.

## Firestore composite indexes

Why needed:
- Firestore auto-creates single-field indexes, but multi-field (composite) queries need explicit composite indexes. Phase 5 screens (Invoices & Reports) commonly run queries like:
  - where(customerId == X) orderBy(issuedAt desc)
  - where(cashierUserId == X) orderBy(issuedAt desc)
  - where(status == 'paid') orderBy(issuedAt desc)
  - where(cashierUserId == X, status == 'paid') orderBy(issuedAt desc)
  - Inventory Logs: where(productId == X) orderBy(createdAt desc), where(type == 'sale') orderBy(createdAt desc)

What’s included:
- `firestore.indexes.json` defines composite indexes for the above patterns (Invoices and InventoryLogs).
- `firebase.json` is configured to deploy these indexes and associates `firestore.rules`.

How to deploy (CLI):
1) Install tools and login (Windows PowerShell):
	- npm install -g firebase-tools
	- firebase login
2) Initialize project if needed: firebase init (select Firestore; choose existing project).
3) Deploy indexes and rules:
	- firebase deploy --only firestore:indexes,firestore:rules

Notes:
- If you hit a Firestore error with a link to create an index, you can click it in the console, or add the equivalent entry to `firestore.indexes.json` and redeploy.
- Index creation can take a few minutes. Queries begin working once the specific index is ready.

Acceptance criteria for the above
- PDFs and thermal receipts render correctly and download/print reliably; email sends a valid attachment.
- Stock reports export correct, filtered datasets; low-stock export reflects thresholds.
- Rules block unauthorized writes and invalid data; required indexes exist (no runtime prompts).
- POS remains fast and usable on mobile; invoices show branding.