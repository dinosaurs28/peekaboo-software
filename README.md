## TODO
1. Once auth is confirmed make this change in firebase rules - 
allow read, write: if request.auth != null;

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


## Testing Phase 2
 Product CRUD: add/edit/delete and validation (unique SKU, required fields).

 Bulk CSV import: map & dry-run, then import.

 Barcode generation: single + bulk PDF download + correct label layout.

 POS sale transaction: concurrency stress test (simulate 5 parallel sales). Ensure no negative stock.

 Inventory logs: every stock change has a log entry.

 Low-stock triggers: alert created only once when threshold breached; resolved on restock.

 Security rules: admin-only endpoints tested using different auth roles.

 UI: barcode scanned via keyboard-emulating scanner finds product by barcode.