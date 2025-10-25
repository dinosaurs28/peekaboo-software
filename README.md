## Peekaboo POS – Launch Checklist and Roadmap

This file lists the final quick polishes to complete before build/launch, plus a roadmap of future additions that can follow without blocking go‑live.

---

## Final pre‑launch polish checklist

Essentials to complete and verify before shipping:

1) Firebase project configuration
- Fill `.env.local` with `NEXT_PUBLIC_FIREBASE_*` required by `lib/firebase.ts` (prod project).
- Verify app boots without “Firebase not initialized” warnings in the browser console.

2) Firestore security rules and indexes
- Deploy rules and composite indexes:
  - Firestore Rules: admin/cashier RBAC, validations, and new Exchanges/Refunds collections.
  - Composite Indexes: Invoices and InventoryLogs used by reports and listings.
- Validate read/write access from a Cashier user for POS/Receive only.

3) Business Profile & numbering
- Set business name, address, GSTIN, phone/email, logo URL, receipt footer in Settings.
- Configure invoice prefix and ensure sequence increments on every sale/exchange invoice.

4) Prints and hardware
- Print A4 and 80mm invoices from an actual invoice:
  - Check logo, address, GSTIN, totals, and date/time formatting.
- Label printing (A4 labels): verify sizing and scanability with your barcode scanner.
- Scanner config: HID keyboard mode with Enter/Tab suffix; test on POS and Receive pages.

5) Offline resilience (quick flight)
- Go offline →
  - POS: scan from cached catalog and perform checkout (should queue).
  - Receive: scan and “Post Receipt” (should queue).
  - Exchange: return + new items (should queue).
- Reconnect → queued items should sync exactly once; stock and logs must reconcile.
  - Note: catalog cache warms when POS loads online once. Open Dashboard/POS online before attempting offline scans.

6) PWA polish
- Service worker is registered; add app icons (192/512) to make it installable.
- Link the manifest if not yet linked (via `app/manifest.ts` or metadata `manifest` in `app/layout.tsx`).
- Optional: pin a SW version bump (`CACHE_VERSION` in `public/sw.js`) for controlled updates.

7) QA and reports
- Run through Testing.md items (sales, payments, stock, movement, accounting CSV/XLSX).
- Spot‑check Inventory Logs for sale/receive/return/exchange/defect paths.

8) Data hygiene & backups
- Export Products and Settings to CSV/JSON as a seed backup before launch.
- Confirm currency symbol (₹) and number formats across the app.

9) Build & deploy (summary)
- Install dependencies and build, then deploy hosting + Firestore config.
- Verify envs and public URLs (logo, manifest) resolve over HTTPS.

---

## Optional pre‑launch niceties (non‑blocking)

- Idempotency guard: write a dedicated `Ops/{opId}` document inside the same transaction for checkout/exchange to make replays strictly duplicate‑proof.
- Queue screen: minimal UI to view/retry/remove failed offline ops.
- Auth‑aware queue start: wait for Firebase Auth ready before running `processQueue()`; show a paused state if not signed in.
- PWA icons and theme meta: add platform icons and verify install banner.
- Basic monitoring: Sentry or error toast bundling for unexpected failures.

---

## Post‑launch roadmap (future additions)

Operations & Inventory
- Shift open/close with Z‑report (cash expected vs counted, refunds, net).
- Stocktake / cycle counts with variance posting (reason=stocktake), CSV import/export.
- Purchase Orders: Suppliers, PO→partial/complete receive into Goods Receipts.
- Multi‑store readiness: store/location field, per‑store stock and reports.

Compliance (India)
- GST split (CGST/SGST vs IGST) based on place of supply.
- HSN summary on invoices and a GSTR‑1/returns‑friendly export.
- Rounding and invoice footer compliance notes.

Sales, Offers, Loyalty
- Loyalty redemption rules (points→discount), configurable earn/redeem rates and caps.
- Offers engine enhancements: cross‑SKU BOGO, stacking/priority policies, event‑based promos.
- Customer comms: birthday/event nudges; export segments.

Printing & UX
- Dedicated 4" label printer mode (CSS @page, density tuning, print dialog presets) beyond A4 PDF.
- Email/PDF invoice delivery; WhatsApp share link.
- Accessibility polish (focus order, ARIA landmarks) and keyboard shortcuts help.

Resilience & DX
- Workbox/next‑pwa strategies (stale‑while‑revalidate for static, background sync for queue).
- Firestore offline persistence (if desired) in addition to the explicit queue.
- Dead‑letter queue with thresholds and audit trail for ops.
- Telemetry & logs: Sentry, performance marks, Cloud logs.

Data & Integrations
- Bulk import/export for Products/Customers (CSV/XLSX), with validation preview.
- Payment integrations (UPI intent, card gateways) for reference capture automation.
- Accounting integrations (Tally/Zoho) via CSV/Bridge API.

---

## Build & deploy quick start

1) Install and build

```powershell
npm install
npm run build
```

2) Deploy config (example)
- Firestore rules/indexes:
```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

3) Host the app (Vercel/Cloud Run/Firebase Hosting). Ensure `.env` is present in the runtime environment.

---

Questions or changes? Open an issue with the checklist item and desired outcome; we’ll scope it as a polish or a roadmap feature.