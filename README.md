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


## Testing Phase 2
 Product CRUD: add/edit/delete and validation (unique SKU, required fields).

 Bulk CSV import: map & dry-run, then import.

 Barcode generation: single + bulk PDF download + correct label layout.

 POS sale transaction: concurrency stress test (simulate 5 parallel sales). Ensure no negative stock.

 Inventory logs: every stock change has a log entry.

 Low-stock triggers: alert created only once when threshold breached; resolved on restock.

 Security rules: admin-only endpoints tested using different auth roles.

 UI: barcode scanned via keyboard-emulating scanner finds product by barcode.

## Testing Brief (Admin vs Cashier)

Below are quick test flows to validate current features. Use separate users for Admin and Cashier roles.

### Admin
- Auth & Roles
	- Sign in; verify access to Dashboard, Products, Settings, Invoices.
	- Cashier-only POS appears on Dashboard for cashier users; admins see analytics cards and alerts.
- Dashboard
	- Low-stock alerts panel updates in real-time when product stock <= reorder level.
	- Notifications dropdown shows the same items; opaque dropdown surface and click-outside to close.
- Products & Inventory
	- Create/Edit/Delete product with fields: name, SKU, HSN, category, unit price, stock, reorder level, GST.
	- Validate SKU uniqueness and basic required fields.
	- Stock updates reflect immediately in low-stock alerts and POS search.
- Barcode Generator (Settings → Barcodes)
	- Generate Code 128 labels encoding PB|CAT|SKU.
	- Export A4 3×10 PDF; verify aligned text and no overlap; printedCount increments.
- Invoices (Real-time)
	- Visit /invoices. Adjust filters (date range, status, cashier) and verify real-time updates.
	- Click any invoice to open details; verify line items (qty, unit, item-level discount), bill-level discount, totals.
	- Print button is visible and works (window.print) for admin only.
- Security & Indexes
	- Verify only Admin can access Product create/edit/delete and Barcode Generator.
	- If Firestore requests an index on /invoices filters, UI continues via client-side fallback; optionally add suggested composite index for performance.

### Cashier
- Auth & Role Gating
	- Sign in; Dashboard shows POS panel. Hidden admin-only menus/actions.
- POS Scan/Search & Cart
	- Scan barcode (PB|CAT|SKU) or search by name/SKU; item adds to cart or increments quantity.
	- Edit qty inline; remove line; item-level discount with amount/% modes.
	- Bill-level discount with amount/%; totals update correctly.
	- Keyboard: Arrow Up/Down moves focused item; +/− adjust qty; Backspace/Delete removes focused line.
	- Draft persistence: refresh page; cart and payment details restore from localStorage.
- Customer Capture at Checkout
	- Enter phone; click Check.
		- If existing, name/email/DOB auto-fill and additional inputs are hidden.
		- If new, name required; email and kid’s DOB optional; a new customer is created and linked on checkout.
	- Complete checkout; success toast appears; cart clears.
- Invoices (Real-time)
	- Visit /invoices; list shows only this cashier’s invoices with cashier name.
	- Click row to view details. Print button should NOT be visible for cashier.

### General
- Firebase initialization guards: app loads even if env misconfigured (with console warnings).
- Opaque dropdown surfaces are consistent across POS search, topbar menus, and notifications.
- Firestore transactions: checkout atomically decrements stock and saves invoice.
- Undefined field handling: writes never include undefined (avoids Firestore errors).