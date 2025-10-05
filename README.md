## Peekaboo Billing Software

Full-stack billing web app for kids toys & accessories business built with:

- Next.js 15 (App Router, React 19)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (New York style)
- Firebase (Auth, Firestore, Storage)

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Getting Started

1. Install dependencies:
	```bash
	npm install
	```
2. Copy env example and fill values from your Firebase project settings (Project Settings > General > Your apps):
	```bash
	copy .env.local.example .env.local # (Windows Powershell: Copy-Item .env.local.example .env.local)
	```
3. Run the dev server:
	```bash
	npm run dev
	```
4. Open http://localhost:3000

### Firebase Environment Variables

| Variable | Description |
| -------- | ----------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain (project-id.firebaseapp.com) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

### Project Structure (key parts)

```
app/             # App router pages/layouts
components/      # UI components (shadcn)
lib/             # Utilities (firebase init, cn helper)
public/          # Static assets
tailwind.config.ts
components.json  # shadcn config
```

### Adding More shadcn Components

Use the CLI (already installed):
```bash
npx shadcn-ui add alert-dialog
```

### Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run built app |
| `npm run lint` | Run ESLint |

### Coding Guidelines

- Use `cn()` helper from `lib/utils` to merge class names.
- Prefer server components; use `"use client"` only when needed (e.g., interactivity, hooks).
- Keep Firestore access in server actions or API routes when possible to safeguard logic.

### Next Steps (Roadmap)

1. Auth flows (sign-in, role-based access: admin vs cashier)
2. Data models: Products, Inventory, Customers, Orders, Invoices, Payments
3. Product SKU & barcode support (generate & scan)
4. Invoice generation (PDF export + share)
5. Dashboard analytics (daily sales, top items, low stock alerts)
6. Role-based permissions
7. Offline-friendly cart (IndexedDB) & optimistic updates

### Authentication

Implemented basic email/password authentication using Firebase Auth.

Roles:
- `admin` – Full access, can manage users, products, settings.
- `cashier` – Restricted to POS, invoices, customers, product lookup.

Role Storage:
- Stored in Firestore under `Users/{uid}` document field `role`.
- On first login, `ensureUserDocument` creates a user record with a default `cashier` role (adjust later via admin UI or security rules).

Provider:
- `AuthProvider` (in `components/auth/auth-provider.tsx`) wraps the app in `app/layout.tsx`.
- Hook `useAuth()` exposes `{ user, role, loading }`.

Login Flow:
- Visit `/login` (path: `app/(auth)/login/page.tsx`).
- On success redirects to `/dashboard`.

Protected Pages:
- `/dashboard` (canonical dashboard). Root `/` redirects to `/dashboard`.
- Unauthenticated access to `/dashboard` redirects to `/login`.

Sign Out:
- Topbar avatar menu → Sign out.

### Data Models

Defined in `lib/models.ts` with TypeScript interfaces:

Collections:
- `Users` (UserDoc) – authUid, email, role, active, timestamps.
- `Customers` (CustomerDoc) – name, contact info, loyalty, spend.
- `Products` (ProductDoc) – sku, stock, pricing, tax, reorder level.
- `Invoices` (InvoiceDoc) – line items, payments, totals, status.
- `Offers` (OfferDoc) – discounts, active window, targeting products.
- `InventoryLogs` (InventoryLogDoc) – stock movement audit trail.
- `Barcodes` (BarcodeDoc) – code mapping to product.
- `Reports` (ReportDoc) – cached generated analytics snapshots.
- `Settings` (SettingsDoc) – business-wide configuration.

Constants:
- `COLLECTIONS` object ensures consistent naming.

Timestamps:
- Stored as ISO strings in interfaces; Firestore writes use `serverTimestamp()` where applicable (conversion layer can be added later).

### Security & Rules (Planned)

To be added: Firestore security rules enforcing role-based access (admin vs cashier) for write operations on sensitive collections (Products, Offers, Settings, Users) and limiting cashier rights to creating invoices, updating customer basics, reading products.

### Testing Guide

This project currently emphasizes manual verification (no automated tests yet). Use the following checklist after pulling new changes or configuring a new environment.

#### 1. Environment Setup
1. Copy env file: `cp .env.local.example .env.local` (PowerShell: `Copy-Item .env.local.example .env.local`).
2. Fill Firebase values (Web App config). Ensure API key is valid.
3. Run `npm install`.
4. Start dev server: `npm run dev`.
5. Confirm no startup errors in terminal.

#### 2. Lint & Build
| Task | Command | Expected |
|------|---------|----------|
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Build | `npm run build` | Successful build, static pages generated |

#### 3. Authentication Flow
| Step | Expectation |
|------|-------------|
| Visit `/` | Redirects to `/dashboard` |
| Visit `/dashboard` unauthenticated | Redirects to `/login` |
| Open `/login` | Login form renders (email, password, sign-in button) |
| Sign in with valid user | Redirects to `/dashboard` |
| Sign out (Topbar menu) | Returns to `/login` |

If first user doc missing: After first successful login, Firestore should contain `Users/{uid}` with default role `cashier`.

#### 4. Dashboard UI Verification
| Element | Check |
|---------|-------|
| Sidebar | Contains nav: Dashboard, Customers, Invoices, Payments, Reports, Settings |
| Topbar | Search input, bell icon, avatar with sign-out menu |
| Stat Cards | Exactly 4 cards with metrics & icons (revenue, pending payments, new customers, overdue invoices) |
| Recent Invoices Table | 3 sample rows with correct status badge colors (green Paid, amber Pending) |

#### 5. Role Placeholder
Currently roles (`admin` vs `cashier`) do not change UI significantly. Confirm `role` field is set in Firestore; manual change to `admin` should show placeholder "Admin Action" button on `/dashboard` page (from earlier page variant). If not visible, that feature may have been superseded by new dashboard root rendering — future enhancement.

#### 6. Firebase Initialization Guard
| Scenario | Expected |
|----------|----------|
| Missing env vars & run `npm run build` | Build still succeeds (firebase guarded) |
| With env vars populated | Firebase initializes, auth works |

#### 7. Data Models Sanity
Open `lib/models.ts` and confirm all collection constants match intended Firestore collections. Adding a document manually in Firestore (e.g., Products) should reflect expected fields.

#### 8. Basic Smoke Script (Optional)
In the browser console after login, you can verify auth object:
```js
// Should show current user UID
firebase?.auth?.currentUser?.uid
```
(If using modular imports only, rely on the application UI; we have not exposed firebase globally.)

#### 9. Accessibility Quick Checks
| Check | Expectation |
|-------|-------------|
| Tab navigation | Can reach buttons & links |
| Contrast | Text readable on light/dark (toggle dark by adding `class="dark"` on `<html>`) |

#### 10. Future Automated Testing (Planned)
- Add Jest/Vitest + React Testing Library for component & auth-mocking.
- Cypress/Playwright for login & dashboard flows.

### Troubleshooting
| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| auth/invalid-api-key | Missing/incorrect env vars | Update `.env.local` values from Firebase console |
| Build fails on firebase import | Guard not applied or edited | Ensure `lib/firebase.ts` still checks `shouldInit` before initializeApp |
| Dashboard blank after login | Auth provider not mounting | Check `app/layout.tsx` wraps children in `<AuthProvider>` |
| Styling missing | Tailwind not picking up content | Confirm `tailwind.config.ts` content globs include `components`, `app`, `lib` |

### License

Private / Proprietary – All rights reserved.

## TODO
1. Once auth is confirmed make this change in firebase rules - 
allow read, write: if request.auth != null;
Phase 2: Product & Inventory (Day 4–7)

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