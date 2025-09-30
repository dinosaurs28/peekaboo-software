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

### License

Private / Proprietary – All rights reserved.