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

## Yet To Implement
Here’s a concise gap analysis against your README scope, plus a suggested enhancement list and a fresh testing brief you can use for a sprint.

What’s left to do (by scope)

Phase 2: Product & Inventory
Inventory tracking
Inventory adjustment UI (manual increase/decrease) and transactional helper.
Inventory logs (who/when/why) for audit.
Category management page (optional; categories are used but not managed separately).

Phase 3: POS & Billing
Tax handling (GST slab calculation in cart lines and invoice totals).
Invoice outputs
Printable/PDF invoice template (admin): dedicated layout vs window.print.
Email invoice to customer.
Payments
Multi-payment (pay with cash+UPI split).
Split payments UX and persistence.
Extras (optional but useful)
Receipt template for thermal printers (80mm).

Phase 4: Customer & Offers
Customer CRUD (full list, view, edit).
Customer purchase history view.
Offers module
Offer rules engine (%, flat, BOGO, item/category/date rules).
POS auto-alert for active offers and application.

Phase 5: Reports & Accounting
Sales reports (daily/weekly/monthly).
Stock report (current, movements, low-stock export).
Payment mode report.
Accounting CSV/XLSX export with required columns and filters.

Phase 6: Polish & Integrations
Mobile-first refinements (dashboard and POS).
Invoice template customization (branding).
Final security & role permissions (Firestore Rules hardened).
Seed demo data script.
Cross-cutting left to finish
Firestore Security Rules: enforce role-based access (admin-only mutations, cashier scope, deny role escalation).
Composite indexes for invoices queries (remove fallback).
Error monitoring/analytics (optional).

## Robustness upgrades worth considering

Data integrity and security
Comprehensive Firestore Rules: per-collection constraints, write validators, role checks; unit tests for rules.
Server-signed barcode checksum (HMAC) if tamper resistance matters later.
Returns/voids/exchanges flow that reverses stock and annotates invoices.
Inventory operations
Purchase Orders and Goods Receipt to increase stock with cost tracking.
Stocktake (cycle counts) with variance reconciliation.
POS quality of life
Offline queue for scans and deferred checkout when network blips.
Shift/session tracking: opening float, cash drawer totals, Z reports.
Price overrides with reason and admin PIN.
Performance/UX
Lazy-load heavy libs (jsPDF) and defer until used.
Skeleton loaders for live sections.
Global toasts/announcements channel and rate-limited log capture.
Ops/DevEx
E2E tests with Playwright for core flows.
CI build/typecheck/lint gates and environment checks.

## New testing brief (sprint checklist)

Setup and roles
Verify env vars load, app boots without “Internal Server Error”.
Login as Admin and as Cashier; role gating works; sidebar routes correct.
Products & inventory
Create/edit/delete product; SKU uniqueness enforced in practice.
Update stock/reorder level; low-stock panel and bell dropdown react in real-time.
Barcode generator
Export A4 3×10 PDF; scan a label in POS; title/code/MRP alignment consistent across columns.
Printed count increments for admin view only.
POS (cashier)
Scan PB|CAT|SKU and plain SKU; adds/merges line; success toast.
Error scans show bottom-right toasts (invalid/NOREAD/SKU not found); focus returns to scan.
Manual search (name/SKU) via opaque dropdown; add merges correctly.
Item discount: select ₹/% and apply; math correct.
Bill discount: select ₹/% and apply; math correct.
Qty edit inline; remove line; keyboard: Arrow Up/Down selects row; +/- changes qty; Delete removes selected.
Draft persistence: add lines, set discounts, payment method; refresh; draft restores; Clear Draft resets.
Customer capture at checkout
Enter phone → existing customer auto-detected (no extra fields).
New phone → name required; email/kid’s DOB optional; customer created and linked on checkout.
Checkout and stock
Confirm payment & checkout writes invoice, decrements stock transactionally.
No undefined writes; success toast; draft cleared.
Invoices (real-time)
Cashier: /invoices shows only own invoices; live update on new checkout; details page visible; no print button.
Admin: /invoices shows all; filters
Date range (from/to), status, cashier; results real-time.
Click row → details page; Print button visible and works.
If index warning appears, UI still functions (fallback); consider adding suggested indexes.
Dashboard (admin)
From/To date filter (default today) affects only stat cards.
Revenue and Expenses (COGS) and New Customers reflect chosen range.
Below stats: 2-column layout—Recent Invoices (real-time) and Low Stock items.
Notifications and menus
Bell dropdown opaque; shows “Low Stock” with item names only (no counts); badge for admin only.
Profile menu opaque; sign-out works; authenticated routes protected.
Error and resilience
Refresh after edits/HMR: no generic “Internal Server Error”; global error boundary shows friendly UI if anything unexpected happens.