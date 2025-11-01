# Peekaboo POS – Comprehensive Testing Brief

This guide defines end-to-end manual tests for the full app: authentication, POS checkout, products, categories, customers, inventory, barcodes, invoices (and exchanges), reports, offline queue, settings (Business Profile and Receipt Template), and printing (80mm thermal + A4). Each test lists preconditions, steps, and expected results. Record pass/fail and notes for each run.

## 0) Environment, Data, and Access

Preconditions
- Firebase project configured and reachable from the app. Debug via Settings → Debug → Firebase (if available).
- Two test users exist:
  - Admin user (role=admin)
  - Cashier user (role=cashier)
- Printer access:
  - 80mm thermal printer (or print-to-PDF with 80mm custom paper size)
  - A4 printer or PDF

Sanity checks
- App loads without runtime errors.
- Admin can access Settings, Reports, Offers, Barcode Generation.
- Cashier can access POS and Invoices only; admin-only areas are hidden or redirect to login/forbidden.

## 1) Authentication and Authorization

Cases
1. Login success (admin)
  - Steps: Logout (if logged in) → Login with admin credentials
  - Expected: Redirect to dashboard; Settings/Reports visible in sidebar
2. Login success (cashier)
  - Steps: Logout → Login with cashier credentials
  - Expected: POS/Invoices visible; Settings/Reports/Offers hidden
3. Unauthorized navigation (cashier)
  - Steps: Attempt to open Settings or Reports via direct URL
  - Expected: Redirect to login or homescreen; no data leak
4. Session persistence
  - Steps: Refresh browser
  - Expected: Still authenticated; role-based UI intact

## 2) Categories

Preconditions: Admin logged in.

Cases
1. Create Category
  - Steps: Settings → Categories → New; fill Name, Code; Save
  - Expected: Appears in list; Product form dropdown includes it
2. Edit Category
  - Steps: Open a category → change Name/Code → Save
  - Expected: Reflected immediately in Product form
3. Deactivate Category (if supported)
  - Steps: Toggle active off; Save
  - Expected: Hidden from default dropdowns

## 3) Products

Preconditions: Admin logged in; at least one category exists.

Cases
1. Create Product
  - Steps: Products → New; fill Name, SKU, HSN, unitPrice, taxRatePct, category, reorderLevel; Save
  - Expected: Product listed; values persisted
2. Edit Product
  - Steps: Open product → change price/tax/category → Save
  - Expected: Changes saved; POS shows updated price/tax
3. Delete Product (optional)
  - Steps: Delete a product not needed in other tests
  - Expected: Product removed; POS search no longer finds it
4. Low-stock threshold
  - Steps: Set reorderLevel below current stock; reduce stock (via sales) below threshold
  - Expected: Dashboard low-stock alert shows product

## 4) Inventory: Receiving and Logs

Preconditions: Admin logged in. At least one product exists.

Cases
1. Receive Stock
  - Steps: Settings → Stock Receiving → add lines (scan barcode or type SKU), set qty and optional unitCost → Post
  - Expected: Confirmation with receipt reference; product stock increases
2. Inventory Logs after receive
  - Steps: Settings → Inventory Logs
  - Expected: One log per received line with type=purchase and correct qty delta
3. Inventory Logs after sale (see POS tests) also show type=sale, with relatedInvoiceId

## 5) Barcodes

Preconditions: Admin logged in; product exists.

Cases
1. Generate labels
  - Steps: Settings → Barcode Generation → select product and quantity → Export A4
  - Expected: PDF shows product name, barcode, and human-readable code
2. Optional stock increment on export (if enabled)
  - Steps: Toggle "Add to stock on export" → Export
  - Expected: Stock increases accordingly; a Goods Receipt and inventory logs are created
3. Scan test
  - Steps: Print or display barcode; on POS, focus the scan input and scan
  - Expected: Product added to cart; repeated scans increment quantity and merge lines

## 6) POS and Billing

Preconditions: Cashier logged in (admin may also test). Have at least two products with differing taxRatePct.

Cases
1. Add items via scan and search
  - Steps: Scan product A twice; search and add product B once
  - Expected: Cart shows product A qty=2 (single merged line), product B qty=1
2. Item-level discount
  - Steps: Apply a fixed ₹ discount to one line; then a % discount to another line
  - Expected: Line totals reflect discount; cannot go negative; UI prevents invalid inputs
3. Bill-level discount
  - Steps: Apply a ₹ bill discount; then a % bill discount (separately)
  - Expected: Subtotal, tax, and grand total recompute; bill discount proportionally affects tax where applicable
4. GST computation
  - Steps: Use items with different taxRatePct; apply line/bill discounts
  - Expected: Tax total equals sum of per-line tax after discounts; rounding consistent to 2 decimals
5. Payment methods
  - Steps: Checkout using Cash, Card, UPI, Wallet (use a sample reference for non-cash)
  - Expected: Invoice status=paid; payment method and reference saved; change due is 0 for exact payment
6. Inventory decrease
  - Steps: Complete a sale
  - Expected: Product stock decreases; Inventory Logs record type=sale with relatedInvoiceId
7. Input focus and scanner behavior
  - Steps: After checkout, return to POS; focus returns to scan input; rapid double scans merge correctly

Edge/Negative
- Zero/negative qty or discounts are blocked
- Very large cart (30+ lines) maintains performance and accurate totals
- Network hiccup during checkout does not create duplicate invoices (idempotency)

## 7) Customers

Preconditions: Cashier or admin logged in.

Cases
1. New customer via POS
  - Steps: Enter phone; on first-time, enter name; checkout
  - Expected: Customer is created/linked to invoice
2. Customer lookup and metrics
  - Steps: Customers page → find the customer
  - Expected: Shows history, total spend, visits, last purchase

## 8) Offers

Preconditions: Admin logged in; products exist.

Cases
1. Create flat and percentage offers
  - Steps: Settings → Offers → New; target products and/or categories; set dates; Save
  - Expected: Offer listed and active within date range
2. BOGO same-item offer
  - Steps: Create with buyQty and getQty; active window
  - Expected: In POS, qualifying qty applies free item/discount per rule
3. Apply/clear offers in POS
  - Steps: Use Offers panel; apply/clear
  - Expected: Cart totals change accordingly; exclusive offers do not stack when flagged

## 9) Invoices, Exchanges, and Printing

Preconditions: At least one completed sale.

Invoices
1. List filters
  - Steps: Invoices page → filter by date/status/cashier
  - Expected: Results match filters; row click opens detail
2. Invoice detail
  - Steps: Open invoice detail
  - Expected: Shows line items, discounts, tax, payment method, cashier info

Exchanges/Returns
1. Create exchange from invoice (if enabled)
  - Steps: In invoice detail → Exchange → return item(s), mark defect if applicable → add new items → finalize
  - Expected: Exchange totals computed; payment or refund method captured; Inventory Logs reflect returns/new items; defect returns do not increase sellable stock

Printing (A4 and 80mm)
1. Business Profile branding on prints
  - Steps: Settings → Business Profile: set logo, name, address, GSTIN, footer → Save → open any invoice → Print A4 and Print 80mm
  - Expected: Branding renders on both; math matches invoice; print dialog opens automatically
2. Receipt Template settings for 80mm
  - Steps: Settings → Receipt Template: set Paper Width=80; toggle Show GST line on/off; set Review URL and toggle display; Save; open 80mm print
  - Expected: Content width matches setting; GST line visibility toggles; review link shows/hides accordingly
3. Paper width change (e.g., 58mm)
  - Steps: Set Paper Width=58 → open 80mm print
  - Expected: Rendered width matches 58mm; content remains legible without overflow
4. Print-only content
  - Steps: Print preview
  - Expected: Only receipt content prints; no app chrome; margins minimal; scale 100%

Note: Auto-print-after-checkout flag is stored in settings and can be wired to POS later. Current print page auto-invokes print when loaded.

## 10) Reports (Inline tabs)

Preconditions: Admin logged in; some invoices, stock movement present.

Sales
- Steps: Reports → Sales (default tab) → select date range and grouping (day/week/month)
- Expected: Period rows show counts, net totals; numbers reconcile with underlying invoices

Payments
- Steps: Reports → Payments → choose date range
- Expected: Totals by method (cash/card/upi/wallet) match invoices

Accounting Export
- Steps: Reports → Accounting Export → pick range → Export CSV
- Expected: CSV downloads with fields including Date, Invoice No, SKU, HSN, Tax, Discounts, Payment Mode, Customer ID; sums reconcile

Stock
- Steps: Reports → Stock → optional filters
- Expected: Quantities, prices, and low-stock flags match Products

Movement
- Steps: Reports → Movement → choose date range
- Expected: Qty In/Out/Net match Inventory Logs for the period

## 11) Dashboard

Preconditions: Admin logged in; some data exists.

Cases
1. Stat cards
  - Expected: Show revenue and deltas based on selected period
2. Recent invoices
  - Expected: Most recent sales appear with correct amounts
3. Low-stock alerts
  - Expected: Products below threshold appear with accurate quantities

## 12) Offline Queue

Preconditions: App can be put into offline mode (DevTools → Network → Offline).

Cases
1. Queue creation
  - Steps: Go offline → attempt POS checkout
  - Expected: Operation queued locally; user feedback indicates offline queue
2. Queue processing
  - Steps: Go online
  - Expected: Queue processes automatically; invoice created once (no duplicates)
3. Offline Queue page
  - Steps: Settings → Offline Queue
  - Expected: Shows pending/completed items with statuses and retriable actions if needed

## 13) Settings

Business Profile
- Steps: Update fields (name, address, phone, email, GSTIN, logo, invoice prefix, currency, tax inclusive, footer) → Save
- Expected: Persisted in Settings/app; reflected in print templates and invoice numbering

Receipt Template
- Steps: Set Paper Width, Show GST line, Review URL/link toggle, Footer note, Auto-print flag → Save
- Expected: Stored in Settings/app; 80mm receipt respects width and visibility flags

## 14) Security, Validation, and Integrity

Permissions
- Cashier cannot access admin-only pages; server-side rules prevent unauthorized writes

Validation
- Prevent negative prices, stock, discounts, and quantities
- Prevent invalid GST rates outside expected bounds

Integrity
- Subtotal + tax − discounts = grand total (within rounding tolerance)
- Inventory stock after receive − sales ± adjustments equals on-hand
- Exchange: defect returns do not add to sellable stock; references link back to invoices

Indexes
- No Firestore index errors on invoices/reports queries; if prompted, deploy suggested indexes and retest

## 15) Edge Cases and UX

- Empty lists render friendly empty states (Products, Invoices, Reports)
- Long product names and SKUs clip/wrap gracefully in tables and receipts
- Keyboard focus returns to POS scan input after actions; scanning acts like typing
- Mobile viewport: pages remain usable (no critical overflow) where applicable

## 16) Acceptance Criteria

- Invoices print cleanly with correct branding, math, and configurable receipt width
- Inventory movements reconcile with actions; stock views and reports agree
- Reports reflect accurate aggregates and export valid CSVs
- Role-based access is enforced by UI and backend
- No crashed pages or unhandled errors during the above flows

## Appendix: Test Data Suggestions

- Products: one 0% tax, one 5%, one 12%, one 18%; varying prices; one with low reorder level
- Offers: flat ₹50 off on product A, 10% off on category X, BOGO buy2-get1 on product B
- Customers: at least one new via POS checkout, one returning for repeat-purchase tests
- Dates: create invoices across multiple days to test period grouping in Sales report

Tips
- For thermal printers, set custom paper width matching Receipt Template (e.g., 80mm) and use 100% scale; disable browser headers/footers
- If any query shows an index error, deploy via Firebase CLI and retry once the index is active


### Fixes Needed After Testing
1. The Low Stock Items doesnt show all the items low on stock, shows only one. And let the low stock card have Today filter only and doesnt change on date range filters, because it doesnt mattr what is the date range, today the stock is low is what matters. So let that stat card be defaulted permanently to Today.

2. Remove stock receive flow permanently.

3. Remove Add to Stock on export from bar code generation flow.

4. [Fixed] Whenever the qty is added in the billing make sure, that many qty is present in the Inventory and not blindly add the qty. If the inventory stock is less than the added qty in billing then billing checkout shouldnt proceed, and should show toast telling insufficient qty.
  - Implemented: POS caps per-line quantities to current stock with toasts; checkout is blocked if any line exceeds stock; backend transaction re-validates stock atomically to prevent negative inventory.

5. [Fixed] Exchange gives some error, and doesnt confirm exchange.
   - Implemented:
     - Multiple exchanges per product allowed up to original quantity; we track prior returned qty and cap remaining.
     - New items stock validated atomically in a transaction; clear error if insufficient.
     - UI shows remaining returnable qty and blocks inputs when none remain; new items respect current stock with toasts.
     - Money handling: if newSubtotal > returnCredit, a new invoice is created for the difference (paid via selected method); if returnCredit > newSubtotal, a refund record is created.