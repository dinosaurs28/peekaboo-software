// Firestore data model TypeScript interfaces
// Keep these in sync with security rules (to be added later)

export type UserRole = 'admin' | 'cashier';

export interface BaseDoc {
  id?: string; // Firestore document ID (set after fetch)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface UserDoc extends BaseDoc {
  authUid: string; // Firebase Auth uid
  email: string;
  displayName?: string;
  role: UserRole;
  active: boolean;
  lastLoginAt?: string;
}

export interface CustomerDoc extends BaseDoc {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  kidsDob?: string; // ISO date for child's DOB (optional)
  loyaltyPoints?: number;
  totalSpend?: number;
}

export interface ProductDoc extends BaseDoc {
  name: string;
  sku: string; // internal SKU
  category?: string;
  hsnCode?: string; // HSN/SAC code for GST
  unitPrice: number; // stored as number in smallest currency unit? (decide) currently decimal number
  costPrice?: number;
  stock: number; // current on-hand quantity
  reorderLevel?: number; // threshold for low-stock alerts
  taxRatePct?: number; // e.g. 5 for 5%
  active: boolean;
  printedCount?: number; // number of barcode labels printed
}

export interface InvoiceLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number; // price at time of sale
  taxRatePct?: number;
  discountAmount?: number; // absolute amount per line
}

export interface PaymentRecord {
  method: 'cash' | 'card' | 'upi' | 'wallet';
  amount: number;
  referenceId?: string; // txn id, last4, etc.
}

export interface InvoiceDoc extends BaseDoc {
  invoiceNumber: string; // sequential human-readable
  customerId?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  grandTotal: number;
  payments: PaymentRecord[];
  balanceDue: number;
  cashierUserId: string;
  cashierName?: string;
  status: 'paid' | 'partial' | 'unpaid' | 'void';
  issuedAt: string; // sale timestamp
}

export interface OfferDoc extends BaseDoc {
  name: string;
  description?: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  discountType?: 'percentage' | 'amount';
  discountValue?: number; // meaning depends on type
  productIds?: string[]; // targeted products
  // Extended targeting and rules
  categoryNames?: string[]; // target by product.category name
  ruleType?: 'flat' | 'percentage' | 'bogoSameItem'; // engine selector; flat/percentage mirror discountType, bogo uses buy/get
  buyQty?: number; // for BOGO same item
  getQty?: number; // for BOGO same item
  dobMonthOnly?: boolean; // apply only if customer's (kid's) DOB month matches current
  eventName?: string; // label like Diwali, Back-to-School
  priority?: number; // lower number = higher priority
  exclusive?: boolean; // if true, do not combine/stack
}

// Category management
export interface CategoryDoc extends BaseDoc {
  name: string;
  code: string; // short uppercase code used in barcodes (e.g., CLO)
  description?: string;
  active: boolean;
}

// Goods receipt (group of received items)
export interface GoodsReceiptLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitCost?: number;
}

export interface GoodsReceiptDoc extends BaseDoc {
  supplierName?: string;
  supplierCode?: string;
  docNo?: string;
  docDate?: string; // ISO date
  note?: string;
  createdByUserId: string;
  lines: GoodsReceiptLine[];
}

export interface InventoryLogDoc extends BaseDoc {
  productId: string;
  type: 'adjustment' | 'sale' | 'purchase' | 'return' | 'damage';
  quantityChange: number; // negative for reduction
  reason?: string;
  relatedInvoiceId?: string;
  userId?: string; // who performed the change
  previousStock?: number;
  newStock?: number;
}

export interface BarcodeDoc extends BaseDoc {
  code: string; // actual barcode / QR string
  productId: string;
  type?: 'ean-13' | 'code-128' | 'qr';
  printedCount?: number;
}

export interface ReportDoc extends BaseDoc {
  type: 'daily-sales' | 'inventory-summary' | 'top-products' | 'low-stock';
  rangeStart?: string;
  rangeEnd?: string;
  // Use unknown to avoid any; callers must narrow.
  payload: unknown; // computed data snapshot
  generatedByUserId?: string;
}

export interface SettingsDoc extends BaseDoc {
  businessName: string;
  currency: string; // e.g. INR, USD
  taxInclusive: boolean; // whether prices include tax
  invoicePrefix?: string;
  nextInvoiceSequence?: number;
  lowStockThresholdDefault?: number;
  theme?: 'light' | 'dark' | 'system';
}

// Collection name constants (helps avoid typos)
export const COLLECTIONS = {
  users: 'Users',
  customers: 'Customers',
  products: 'Products',
  invoices: 'Invoices',
  offers: 'Offers',
  inventoryLogs: 'InventoryLogs',
  categories: 'Categories',
  goodsReceipts: 'GoodsReceipts',
  barcodes: 'Barcodes',
  reports: 'Reports',
  settings: 'Settings'
} as const;

// Common product categories for initial UI; can be extended in Settings later
export const CATEGORY_OPTIONS = [
  'Toys',
  'Clothes',
  'Books',
  'Stationery',
  'Accessories',
  'Electronics',
] as const;

export function categoryCode(cat?: string): string {
  if (!cat) return 'GEN';
  const trimmed = cat.trim();
  if (!trimmed) return 'GEN';
  return trimmed.slice(0, 3).toUpperCase();
}
