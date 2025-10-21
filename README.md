## Peekaboo POS – Client Brief

This document summarizes what’s built, what was added recently, and key decision options to discuss before we implement more. It’s written for a quick client review and go/no‑go decisions per item.

### What’s ready today (ship-ready)
- Products & Categories: Add/edit products (SKU, HSN, price, GST), category management, low‑stock alerts.
- Inventory: Real‑time stock adjustments, receiving with Goods Receipts, Inventory Logs and viewer.
- Barcodes: PB|CAT|SKU format, A4 label PDF export, optional “add to stock on export.”
- POS & Billing: Fast scan/search, cart with item/bill discounts, GST calculation (per product slab), single payment (cash/card/UPI/wallet), sequential invoice numbers, A4 and 80mm print.
- Customers & Offers: Customer profiles with history; offers engine (flat/%/BOGO, category/product targeting, DOB‑month, priority/exclusive) with POS apply/clear.
- Reports: Sales (day/week/month), Payment Mode, Accounting CSV/XLSX; Stock Report; Inventory Movement Summary (qty in/out/net by product and range).
- Settings & Branding: Business Profile (logo, name, address, GSTIN, footer), invoice prefix/counter.
- Security & Integrity: Role‑based Firestore rules (admin/cashier), validations to prevent negative values, composite indexes configured.

### Recent additions
- Business Profile branding reflected in A4/80mm prints.
- Inventory Movement Summary report (date range, category filter, CSV/XLSX).
- Barcode Generator option to auto‑receive stock when exporting labels (creates Goods Receipt + logs).

### Decisions to make (pick what matters now)
1) Returns/Void/Exchange
   - Scope: Allow full/partial returns with stock reversal and invoice annotation; write InventoryLogs (type=return/void). Optional: exchange flow that creates a new invoice difference.
   - Impact: Essential for after‑sales corrections and customer service.

2) Stocktake (Cycle Counts)
   - Scope: Count sheet UI → enter actuals per SKU → system posts adjustments (reason=stocktake) with notes.
   - Impact: Improves inventory accuracy over time; recommended monthly/quarterly.

3) Shift Close / Day‑End Reconciliation
   - Scope: Open/close shift, record cash drawer opening/closing, cash‑in/out, and a Z‑report (sales totals by method, refunds, net expected cash).
   - Impact: Operational confidence for cash handling; useful even with UPI/card heavy stores.

4) GST Enhancements (India)
   - Scope: Split CGST/SGST vs IGST based on place of supply; HSN‑wise tax summary on invoices; rounding rules; optional GSTR‑1 friendly export.
   - Impact: Compliance polish; discuss necessity with accountant.

5) Purchase Orders (optional)
   - Scope: Create PO → receive partially/fully into Goods Receipts; close PO on full receipt.
   - Impact: Valuable if you plan supplier ordering inside the system; otherwise defer.

6) PWA / Offline resilience (optional)
   - Scope: Cache POS shell; queue scans/checkout when offline; replay on reconnect with duplicate guards.
   - Impact: Great for unreliable internet; adds complexity—enable only if needed.

7) Loyalty (optional)
   - Scope: Earn points on net spend; redeem at POS; show balance on customer profile.
   - Impact: Marketing lever; implement if you plan ongoing campaigns.

### Our recommendation (start with these)
1) Returns/Void/Exchange
2) Stocktake (Cycle Counts)
3) Shift Close / Day‑End Reconciliation
4) GST Enhancements (limited: HSN summary + CGST/SGST split on invoice header)

These deliver the highest operational and compliance value with focused effort.

### Items to defer unless required
- Full Purchase Orders workflow
- PWA/offline queueing
- Loyalty points program

### Acceptance checklist (quick)
- Invoices: Sequential numbers; prints show correct branding; GST math aligns with product tax rates and bill discounts.
- Inventory: Sales decrement and receiving increment stock with InventoryLogs; Movement Summary matches activity.
- Reports: Sales, Payments, Stock, Accounting CSV/XLSX export the expected fields.
- Access & validation: Cashier/Admin rights respected; no negative qty/discounts allowed; indexes deployed (no runtime prompts).

### Notes for deployment
- Firestore security and indexes are configured. Deploy rules/indexes once connected to your Firebase project.
- Optional email/PDF generation for invoices can be added later; current flow uses the browser print.

If you approve the recommendations, we’ll proceed with Returns/Void, Stocktake, and Shift Close next, followed by targeted GST enhancements.