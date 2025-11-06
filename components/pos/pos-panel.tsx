"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProductDoc } from "@/lib/models";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU, listProducts } from "@/lib/products";
import { saveProductsToCache, getCachedProducts, findCachedBySKU } from "@/lib/catalog-cache";
import { checkoutCart } from "@/lib/pos";
import { listActiveOffers } from "@/lib/offers";
import type { OfferDoc, ProductDoc as P } from "@/lib/models";
import { findCustomerByPhone, createCustomer } from "@/lib/customers";
import { DropdownPanel } from "@/components/ui/dropdown-panel";
import { useAuth } from "@/components/auth/auth-provider";

export function PosPanel() {
  const [scanValue, setScanValue] = useState("");
  type CartLine = { product: ProductDoc; qty: number; itemDiscount?: number; itemDiscountMode?: 'amount' | 'percent' };
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const [allProducts, setAllProducts] = useState<ProductDoc[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billDiscountMode, setBillDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; type: 'error' | 'success'; message: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [paymentRef, setPaymentRef] = useState("");
  const { user } = useAuth();
  // Offers
  const [offers, setOffers] = useState<OfferDoc[]>([]);
  const [offerAppliedId, setOfferAppliedId] = useState<string | null>(null);
  // Customer capture state
  const [custPhone, setCustPhone] = useState("");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custKidsDob, setCustKidsDob] = useState("");
  const [custFound, setCustFound] = useState<{ id: string; name: string; points?: number } | null>(null);
  const [custChecking, setCustChecking] = useState(false);
  const phoneLookupSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  // UI-only: GST fields (no backend changes)
  const [gstin, setGstin] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");

  // Focus the input to capture scanner entries
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        if (navigator.onLine) {
          const list = await listProducts();
          setAllProducts(list);
          // Save to offline cache
          saveProductsToCache(list).catch(() => undefined);
        } else {
          const cached = await getCachedProducts();
          setAllProducts(cached as any);
        }
      } catch {
        // fallback to cache if network failed
        try { const cached = await getCachedProducts(); setAllProducts(cached as any); } catch { }
      }
    }
    load();
  }, []);

  // Load active offers for cashier visibility
  useEffect(() => {
    listActiveOffers().then(setOffers).catch(() => undefined);
  }, []);

  // Draft persistence (v2) — save minimal productId-based lines and rehydrate from catalog
  type CartDraftLine = { productId: string; qty: number; itemDiscount?: number; itemDiscountMode?: 'amount' | 'percent' };
  type PosDraftV2 = {
    version: 2;
    cashierUserId?: string;
    cart: CartDraftLine[];
    billDiscount: number;
    billDiscountMode: 'amount' | 'percent';
    paymentMethod: 'cash' | 'card' | 'upi' | 'wallet';
    paymentRef: string;
    custPhone: string;
    custName: string;
    custEmail: string;
    custKidsDob: string;
    updatedAt: string; // ISO
  };

  const DRAFT_KEY_V1 = "pos.cart.v1";
  const DRAFT_KEY_V2 = "pos.cart.v2";
  const loadedRef = useRef(false);

  function loadDraftOnce(products: ProductDoc[], uid?: string | null) {
    if (loadedRef.current) return;
    try {
      // Prefer v2
      const rawV2 = localStorage.getItem(DRAFT_KEY_V2);
      if (rawV2) {
        const d = JSON.parse(rawV2) as Partial<PosDraftV2>;
        // If draft is tied to another cashier, ignore
        if (d && (!d.cashierUserId || !uid || d.cashierUserId === uid)) {
          if (Array.isArray(d.cart)) {
            const lines: CartLine[] = d.cart
              .map((cl) => {
                const p = products.find((x) => x.id === cl.productId);
                if (!p) return null;
                return { product: p, qty: Math.max(1, Number(cl.qty || 1)), itemDiscount: cl.itemDiscount, itemDiscountMode: cl.itemDiscountMode } as CartLine;
              })
              .filter(Boolean) as CartLine[];
            if (lines.length) setCart(lines);
          }
          if (d.billDiscount != null) setBillDiscount(Number(d.billDiscount) || 0);
          if (d.billDiscountMode === 'amount' || d.billDiscountMode === 'percent') setBillDiscountMode(d.billDiscountMode);
          if (d.paymentMethod === 'cash' || d.paymentMethod === 'card' || d.paymentMethod === 'upi' || d.paymentMethod === 'wallet') setPaymentMethod(d.paymentMethod);
          if (typeof d.paymentRef === 'string') setPaymentRef(d.paymentRef);
          if (typeof d.custPhone === 'string') setCustPhone(d.custPhone);
          if (typeof d.custName === 'string') setCustName(d.custName);
          if (typeof d.custEmail === 'string') setCustEmail(d.custEmail);
          if (typeof d.custKidsDob === 'string') setCustKidsDob(d.custKidsDob);
          loadedRef.current = true;
          return;
        }
      }
      // Migrate from v1 (stored full product objects)
      const rawV1 = localStorage.getItem(DRAFT_KEY_V1);
      if (rawV1) {
        type V1CartLine = { product?: Partial<ProductDoc> & { id?: string }; qty?: number; itemDiscount?: number; itemDiscountMode?: 'amount' | 'percent' };
        type V1Draft = { cart?: V1CartLine[]; billDiscount?: number; billDiscountMode?: 'amount' | 'percent'; paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet'; paymentRef?: string; custPhone?: string; custName?: string; custEmail?: string; custKidsDob?: string };
        const d = JSON.parse(rawV1) as V1Draft;
        if (d) {
          // cart may contain full product objects
          if (Array.isArray(d.cart)) {
            const lines: CartLine[] = d.cart
              .map((l) => {
                const pid = l?.product?.id as string | undefined;
                const p = pid ? products.find((x) => x.id === pid) : undefined;
                if (!p) return null;
                const qty = Math.max(1, Number(l?.qty || 1));
                const itemDiscount = typeof l?.itemDiscount === 'number' ? l.itemDiscount : undefined;
                const itemDiscountMode: 'amount' | 'percent' = l?.itemDiscountMode === 'percent' ? 'percent' : 'amount';
                return { product: p, qty, itemDiscount, itemDiscountMode } as CartLine;
              })
              .filter((x): x is CartLine => Boolean(x));
            if (lines.length) setCart(lines);
          }
          if (typeof d.billDiscount === 'number') setBillDiscount(d.billDiscount);
          if (d.billDiscountMode === 'amount' || d.billDiscountMode === 'percent') setBillDiscountMode(d.billDiscountMode);
          if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
          if (typeof d.paymentRef === 'string') setPaymentRef(d.paymentRef);
          if (typeof d.custPhone === 'string') setCustPhone(d.custPhone);
          if (typeof d.custName === 'string') setCustName(d.custName);
          if (typeof d.custEmail === 'string') setCustEmail(d.custEmail);
          if (typeof d.custKidsDob === 'string') setCustKidsDob(d.custKidsDob);
          // Do not mark loaded to allow a later v2 to override if present, but avoid loops
          loadedRef.current = true;
          return;
        }
      }
    } catch {
      // ignore
    }
    loadedRef.current = true;
  }

  // Load draft when products and user are available (rehydration needs products list)
  useEffect(() => {
    loadDraftOnce(allProducts, user?.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts.length, user?.uid]);

  // Draft persistence (save as v2). Avoid saving until initial load finished to prevent overwriting.
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      const draft: PosDraftV2 = {
        version: 2,
        cashierUserId: user?.uid,
        cart: cart.map((l) => ({ productId: l.product.id!, qty: l.qty, itemDiscount: l.itemDiscount, itemDiscountMode: l.itemDiscountMode })),
        billDiscount,
        billDiscountMode,
        paymentMethod,
        paymentRef,
        custPhone,
        custName,
        custEmail,
        custKidsDob,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY_V2, JSON.stringify(draft));
      // Clean up old v1 to avoid confusion
      localStorage.removeItem(DRAFT_KEY_V1);
    } catch { /* ignore */ }
  }, [cart, billDiscount, billDiscountMode, paymentMethod, paymentRef, custPhone, custName, custEmail, custKidsDob, user?.uid]);

  const lineDiscount = useCallback((l: CartLine) => {
    const base = l.product.unitPrice * l.qty;
    const v = Number(l.itemDiscount ?? 0);
    return (l.itemDiscountMode ?? 'amount') === 'amount' ? v : (base * v) / 100;
  }, []);
  // Subtotal (post per-line discounts)
  const subTotal = useMemo(() => cart.reduce((sum, l) => sum + (l.product.unitPrice * l.qty - lineDiscount(l)), 0), [cart, lineDiscount]);
  // Bill-level discount
  const billDiscComputed = useMemo(() => (billDiscountMode === 'amount' ? billDiscount : (subTotal * billDiscount) / 100), [billDiscountMode, billDiscount, subTotal]);
  // Estimate GST using same math as backend (proportional bill discount per line)
  const taxTotal = useMemo(() => {
    if (subTotal <= 0) return 0;
    const totalBase = Math.max(1, subTotal);
    let sum = 0;
    for (const l of cart) {
      const net = l.product.unitPrice * l.qty - lineDiscount(l);
      const billShare = billDiscComputed * (net / totalBase);
      const taxableBase = Math.max(0, net - billShare);
      const taxRate = typeof l.product.taxRatePct === 'number' ? l.product.taxRatePct : 0;
      sum += taxableBase * (taxRate / 100);
    }
    return sum;
  }, [cart, lineDiscount, billDiscComputed, subTotal]);
  // Grand total including GST (matches server)
  const total = useMemo(() => Math.max(0, subTotal - billDiscComputed + taxTotal), [subTotal, billDiscComputed, taxTotal]);

  function isDobMonthMatch(): boolean {
    if (!custKidsDob) return false;
    try {
      const month = new Date(custKidsDob).getMonth();
      const nowM = new Date().getMonth();
      return month === nowM;
    } catch { return false; }
  }

  function offerMatchesCart(o: OfferDoc): boolean {
    // DOB-only gate
    if (o.dobMonthOnly && !isDobMonthMatch()) return false;
    // Product/category targeting gate
    const ids = new Set(o.productIds || []);
    const cats = new Set((o.categoryNames || []).map(s => s.toLowerCase()));
    const anyMatch = cart.some(l => ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase())));
    // If neither productIds nor categories specified, consider bill-level true
    return ids.size === 0 && cats.size === 0 ? true : anyMatch;
  }

  function computeOfferSavings(o: OfferDoc): number {
    // Estimate savings for ranking suggestions
    if (!offerMatchesCart(o)) return 0;
    // BOGO same item: free getQty for every buyQty in matching lines
    if (o.ruleType === 'bogoSameItem' && (o.buyQty || 0) > 0 && (o.getQty || 0) > 0) {
      const buy = o.buyQty!; const get = o.getQty!;
      let saved = 0;
      const ids = new Set(o.productIds || []);
      const cats = new Set((o.categoryNames || []).map(s => s.toLowerCase()));
      for (const l of cart) {
        const targeted = ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase()));
        if (!targeted) continue;
        const groups = Math.floor(l.qty / (buy + get));
        const freeQty = groups * get;
        saved += freeQty * l.product.unitPrice;
      }
      return saved;
    }
    // Flat/percentage: apply to matching lines or entire bill if untargeted
    if ((o.ruleType || (o.discountType === 'amount' ? 'flat' : o.discountType === 'percentage' ? 'percentage' : undefined)) === 'flat') {
      if ((o.productIds?.length || 0) + (o.categoryNames?.length || 0) === 0) {
        return Number(o.discountValue || 0);
      }
      const ids = new Set(o.productIds || []);
      const cats = new Set((o.categoryNames || []).map(s => s.toLowerCase()));
      const matchedLines = cart.filter(l => ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase())));
      return matchedLines.reduce((s, l) => s + Number(o.discountValue || 0), 0);
    }
    if ((o.ruleType || (o.discountType === 'amount' ? 'flat' : o.discountType === 'percentage' ? 'percentage' : undefined)) === 'percentage') {
      const pct = Number(o.discountValue || 0) / 100;
      if ((o.productIds?.length || 0) + (o.categoryNames?.length || 0) === 0) {
        return subTotal * pct;
      }
      const ids = new Set(o.productIds || []);
      const cats = new Set((o.categoryNames || []).map(s => s.toLowerCase()));
      const matchedLines = cart.filter(l => ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase())));
      const sum = matchedLines.reduce((s, l) => s + l.product.unitPrice * l.qty, 0);
      return sum * pct;
    }
    return 0;
  }

  function applyOffer(id: string) {
    const offer = offers.find(o => o.id === id);
    if (!offer) return;
    // Reset any previously applied selection marker
    setOfferAppliedId(offer.id!);
    // If offer targets specific products, apply item-level discounts; else apply bill-level discount
    const ids = new Set(offer.productIds || []);
    const cats = new Set((offer.categoryNames || []).map(s => s.toLowerCase()));
    const targeted = (ids.size + cats.size) > 0;
    if (offer.ruleType === 'bogoSameItem' && targeted && (offer.buyQty || 0) > 0 && (offer.getQty || 0) > 0) {
      const buy = offer.buyQty!; const get = offer.getQty!;
      setCart(prev => prev.map(l => {
        const match = ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase()));
        if (!match) return l;
        // BOGO: convert to an equivalent per-line discount based on free units
        const groups = Math.floor(l.qty / (buy + get));
        const freeQty = groups * get;
        const freeValue = freeQty * l.product.unitPrice;
        // Apply as amount discount
        return { ...l, itemDiscountMode: 'amount', itemDiscount: (freeValue / Math.max(1, l.qty)) };
      }));
    } else if (targeted) {
      setCart((prev) => prev.map((l) => {
        const match = ids.has(l.product.id!) || (l.product.category && cats.has(l.product.category.toLowerCase()));
        if (!match) return l;
        if (offer.discountType === 'amount') {
          return { ...l, itemDiscountMode: 'amount', itemDiscount: Number(offer.discountValue || 0) };
        } else if (offer.discountType === 'percentage') {
          return { ...l, itemDiscountMode: 'percent', itemDiscount: Number(offer.discountValue || 0) };
        }
        return l;
      }));
    } else {
      // Bill level
      if (offer.discountType === 'amount') {
        setBillDiscountMode('amount');
        setBillDiscount(Number(offer.discountValue || 0));
      } else if (offer.discountType === 'percentage') {
        setBillDiscountMode('percent');
        setBillDiscount(Number(offer.discountValue || 0));
      }
    }
    showToast('success', `Offer applied: ${offer.name}`);
  }

  function clearOfferAdjustments() {
    setOfferAppliedId(null);
    // Reset discounts
    setBillDiscount(0);
    setBillDiscountMode('amount');
    setCart((prev) => prev.map((l) => ({ ...l, itemDiscount: undefined, itemDiscountMode: undefined })));
  }

  function parseScanError(raw: string): string | null {
    if (!raw) return "Empty scan. Please try again.";
    const s = raw.trim();
    if (s.length < 3) return "Scan too short. Please rescan.";
    const upper = s.toUpperCase();
    if (upper.includes("NOREAD")) return "Scanner couldn't read the code (NOREAD). Please rescan.";
    if (upper.includes("ERROR")) return `Scanner error: ${s}`;
    // Detect non-printable ASCII
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 32 || c > 126) return "Unexpected characters in scan. Check scanner keyboard mode.";
    }
    // If spaces present and not PB format, flag
    if (s.includes(" ") && !s.startsWith("PB|")) return "Unexpected spaces in scan. Please rescan.";
    return null;
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setError(null);
    const scanErr = parseScanError(code);
    if (scanErr) {
      showToast('error', scanErr);
      setScanValue("");
      inputRef.current?.focus();
      return;
    }
    const decoded = decodeBarcode(code);
    if (!decoded) {
      showToast('error', 'Invalid barcode scan.');
      setScanValue("");
      return;
    }

    const sku = decoded.sku;
    let product = await findProductBySKU(sku);
    if (!product && !navigator.onLine) {
      const cached = await findCachedBySKU(sku);
      if (cached) {
        product = { id: cached.id, name: cached.name, sku: cached.sku, unitPrice: cached.unitPrice, category: cached.category, taxRatePct: cached.taxRatePct, active: true, stock: 0, createdAt: '', updatedAt: '' } as any;
      }
    }
    if (!product) {
      showToast('error', `No product found for SKU ${sku}`);
      setScanValue("");
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product!.id);
      const max = Math.max(0, Number(product!.stock ?? 0));
      if (idx >= 0) {
        const copy = [...prev];
        if (copy[idx].qty >= max) {
          showToast('error', `Only ${max} in stock`);
          setSelectedIndex(idx);
          return copy;
        }
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        showToast('success', `${product!.name} × ${copy[idx].qty}`);
        setSelectedIndex(idx);
        return copy;
      }
      if (max <= 0) {
        showToast('error', `${product!.name} is out of stock`);
        return prev;
      }
      showToast('success', `${product!.name} added`);
      const next = [...prev, { product: product!, qty: 1 }];
      setSelectedIndex(next.length - 1);
      return next;
    });

    setScanValue("");
    inputRef.current?.focus();
  }

  function increment(id?: string) {
    if (!id) return;
    setCart((prev) => prev.map((l) => {
      if (l.product.id !== id) return l;
      const max = Math.max(0, Number(l.product.stock ?? 0));
      if (l.qty >= max) {
        showToast('error', `Only ${max} in stock`);
        return l;
      }
      return { ...l, qty: l.qty + 1 };
    }));
  }

  function decrement(id?: string) {
    if (!id) return;
    setCart((prev) => prev
      .map((l) => (l.product.id === id ? { ...l, qty: Math.max(1, l.qty - 1) } : l))
      .filter((l) => l.qty > 0)
    );
  }

  function removeLine(id?: string) {
    if (!id) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === id);
      const next = prev.filter((l) => l.product.id !== id);
      // Adjust selection
      if (next.length === 0) {
        setSelectedIndex(-1);
      } else if (idx >= 0) {
        const newIndex = Math.min(idx, next.length - 1);
        setSelectedIndex(newIndex);
      }
      return next;
    });
  }

  function setQty(id?: string, qty?: number) {
    if (!id || qty == null) return;
    setCart((prev) => prev.map((l) => {
      if (l.product.id !== id) return l;
      const raw = Math.max(1, Math.floor(qty));
      const max = Math.max(0, Number(l.product.stock ?? 0));
      const next = Math.min(raw, Math.max(0, max));
      if (next !== raw) {
        showToast('error', `Only ${max} in stock`);
      }
      // If max is 0, keep qty at 1 visually but it won't pass checkout; we cap to 0->prevent line?
      return { ...l, qty: Math.max(1, next) };
    }));
  }

  function setItemDiscount(id?: string, disc?: number) {
    if (!id || disc == null) return;
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, itemDiscount: Math.max(0, Number(disc)) } : l)));
  }

  function setItemDiscountMode(id?: string, mode?: 'amount' | 'percent') {
    if (!id || !mode) return;
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, itemDiscountMode: mode } : l)));
  }

  function addByProductId(id?: string) {
    if (!id) return;
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const max = Math.max(0, Number(p.stock ?? 0));
        if (copy[idx].qty >= max) {
          showToast('error', `Only ${max} in stock`);
          setSelectedIndex(idx);
          return copy;
        }
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        showToast('success', `${p.name} × ${copy[idx].qty}`);
        setSelectedIndex(idx);
        return copy;
      }
      const max = Math.max(0, Number(p.stock ?? 0));
      if (max <= 0) {
        showToast('error', `${p.name} is out of stock`);
        return prev;
      }
      showToast('success', `${p.name} added`);
      const next = [...prev, { product: p, qty: 1 }];
      setSelectedIndex(next.length - 1);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [] as ProductDoc[];
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 8);
  }, [searchTerm, allProducts]);

  function showToast(type: 'error' | 'success', message: string) {
    const id = Date.now();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 3000);
  }

  async function lookupCustomerByPhone() {
    const phone = custPhone.trim();
    if (!phone) {
      setCustFound(null);
      // Ensure new customer fields are blank when no phone is provided
      setCustName("");
      setCustEmail("");
      setCustKidsDob("");
      return;
    }
    try {
      setCustChecking(true);
      const c = await findCustomerByPhone(phone);
      if (c) {
        setCustFound({ id: c.id!, name: c.name, points: Math.max(0, Number(c.loyaltyPoints || 0)) });
        setCustName(c.name || "");
        setCustEmail(c.email || "");
        setCustKidsDob(c.kidsDob || "");
      } else {
        // Not found: treat as new customer — always start with blank fields
        setCustFound(null);
        setCustName("");
        setCustEmail("");
        setCustKidsDob("");
      }
    } catch {
      // ignore lookup errors for now but notify
      showToast('error', 'Failed to lookup customer');
    } finally {
      setCustChecking(false);
    }
  }

  // Auto-lookup on phone change with debounce and optimistic clear
  useEffect(() => {
    const phone = custPhone.trim();
    // Optimistically clear fields so old data isn't shown for a new phone
    setCustFound(null);
    setCustName("");
    setCustEmail("");
    setCustKidsDob("");
    if (!phone) return;
    const seq = ++phoneLookupSeq.current;
    const t = setTimeout(async () => {
      try {
        setCustChecking(true);
        const c = await findCustomerByPhone(phone);
        // Ignore if a newer lookup started
        if (phoneLookupSeq.current !== seq) return;
        if (c) {
          setCustFound({ id: c.id!, name: c.name, points: Math.max(0, Number(c.loyaltyPoints || 0)) });
          setCustName(c.name || "");
          setCustEmail(c.email || "");
          setCustKidsDob(c.kidsDob || "");
        } else {
          setCustFound(null);
          setCustName("");
          setCustEmail("");
          setCustKidsDob("");
        }
      } catch {
        // ignore errors; keep fields blank for new customer
      } finally {
        if (phoneLookupSeq.current === seq) setCustChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [custPhone]);

  async function onCheckout() {
    if (cart.length === 0) return;
    // Client-side guard against overselling. Final enforcement happens in backend transaction.
    const over = cart.find(l => Math.max(0, Number(l.product.stock ?? 0)) < l.qty);
    if (over) {
      showToast('error', `Insufficient stock for ${over.product.name}. Available: ${Math.max(0, Number(over.product.stock ?? 0))}`);
      return;
    }
    setBusy(true);
    try {
      // Resolve customerId by phone
      let customerId: string | undefined = undefined;
      const phone = custPhone.trim();
      if (phone) {
        const existing = await findCustomerByPhone(phone);
        if (existing) {
          customerId = existing.id!;
        } else {
          const name = custName.trim();
          if (!name) {
            showToast('error', 'Enter customer name');
            return;
          }
          const newId = await createCustomer({ name, phone, email: custEmail.trim() || undefined, kidsDob: custKidsDob || undefined });
          customerId = newId;
        }
      }
      if (!navigator.onLine) {
        // enqueue the checkout for later sync
        try {
          const id = `op-${Date.now()}`;
          const payload = {
            lines: cart.map((l) => ({ productId: l.product.id!, name: l.product.name, qty: l.qty, unitPrice: l.product.unitPrice, lineDiscount: lineDiscount(l), taxRatePct: l.product.taxRatePct })),
            billDiscount: billDiscComputed,
            paymentMethod,
            paymentReferenceId: paymentRef || undefined,
            cashierUserId: user?.uid,
            cashierName: user?.displayName || user?.email || 'Cashier',
            customerId,
            opId: id,
          };
          await (await import("@/lib/offline")).enqueueOp({ id, type: 'checkout', payload, createdAt: new Date().toISOString(), attempts: 0 });
          showToast('success', 'Offline: checkout queued. It will sync when connection is restored.');
        } catch (e) {
          showToast('error', 'Failed to queue checkout for offline use');
          console.error(e);
          return;
        }
      } else {
        const newInvoiceId = await checkoutCart({
          lines: cart.map((l) => ({
            productId: l.product.id!,
            name: l.product.name,
            qty: l.qty,
            unitPrice: l.product.unitPrice,
            lineDiscount: lineDiscount(l),
            // pass tax rate if present for GST calc
            taxRatePct: l.product.taxRatePct,
          }) as any),
          billDiscount: billDiscComputed,
          paymentMethod,
          paymentReferenceId: paymentRef || undefined,
          cashierUserId: user?.uid,
          cashierName: user?.displayName || user?.email || 'Cashier',
          customerId,
          opId: `op-${Date.now()}`,
        });
        // Auto-open receipt print in a new tab and close it after printing
        try {
          const url = `/invoices/receipt/${newInvoiceId}?autoclose=1&confirm=1`;
          window.open(url, '_blank');
        } catch { }
      }
      showToast('success', 'Checkout complete. Invoice saved.');
      setCart([]);
      setSelectedIndex(-1);
      setBillDiscount(0);
      setPaymentRef("");
      // split payments removed
      setCustPhone("");
      setCustName("");
      setCustEmail("");
      setCustKidsDob("");
      setCustFound(null);
      try { localStorage.removeItem(DRAFT_KEY_V2); localStorage.removeItem(DRAFT_KEY_V1); } catch { }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('error', `Checkout failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  // Keyboard shortcuts for speed:
  // ArrowUp/ArrowDown to move selection; + increment, - decrement, Backspace/Delete remove on selected line
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement | null;
      const tag = (ae?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (cart.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((idx) => {
          if (idx < 0) return 0;
          return Math.min(cart.length - 1, idx + 1);
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((idx) => {
          if (idx < 0) return cart.length - 1;
          return Math.max(0, idx - 1);
        });
        return;
      }
      const target = selectedIndex >= 0 ? cart[selectedIndex] : cart[cart.length - 1];
      if (!target?.product?.id) return;
      if (e.key === '+') {
        e.preventDefault();
        increment(target.product.id);
      } else if (e.key === '-') {
        e.preventDefault();
        decrement(target.product.id);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        removeLine(target.product.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, selectedIndex]);

  // Ensure selected row is visible
  useEffect(() => {
    if (selectedIndex >= 0) {
      const row = rowRefs.current[selectedIndex];
      row?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, cart.length]);

  // Auto-alert best applicable offer when cart or customer DOB changes
  const bestOffer = useMemo(() => {
    if (!offers.length || cart.length === 0) return null as OfferDoc | null;
    const candidates = offers.filter(offerMatchesCart);
    if (!candidates.length) return null;
    // Sort by priority then savings desc
    const scored = candidates.map(o => ({ o, saved: computeOfferSavings(o), prio: o.priority ?? 100 }));
    scored.sort((a, b) => (a.prio - b.prio) || (b.saved - a.saved));
    return scored[0].o;
  }, [offers, cart, custKidsDob, subTotal]);

  useEffect(() => {
    if (bestOffer) {
      showToast('success', `Offer available: ${bestOffer.name}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestOffer?.id]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-lg p-1 shadow-sm">
          <form onSubmit={handleScanSubmit} className="relative">
            <div className="flex items-center gap-2 px-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                ref={inputRef}
                value={scanValue}
                onChange={(e) => {
                  setScanValue(e.target.value);
                  setSearchTerm(e.target.value);
                  setSearchOpen(e.target.value.trim().length > 0);
                }}
                placeholder="Search for products"
                autoComplete="off"
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-600 placeholder:text-gray-400"
              />
            </div>
            {/* Dropdown for search results */}
            {searchOpen && filtered.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    onClick={() => { addByProductId(p.id); setScanValue(""); setSearchTerm(""); setSearchOpen(false); inputRef.current?.focus(); }}
                  >
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">SKU: {p.sku} • ₹{p.unitPrice.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Cart Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Product Name</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Quantity</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Price</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-500">Discount</th>
                <th className="px-4 py-4 text-right text-sm font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cart.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-gray-400" colSpan={5}>
                    <div className="text-base">Cart is empty. Search or scan products to add</div>
                  </td>
                </tr>
              ) : (
                cart.map((l, idx) => (
                  <tr
                    key={l.product.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onClick={() => setSelectedIndex(idx)}
                    className={`cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{l.product.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">SKU: {l.product.sku}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 font-medium text-lg"
                          onClick={(e) => { e.stopPropagation(); decrement(l.product.id); }}
                        >−</button>
                        <span className="text-blue-600 font-semibold w-8 text-center">{l.qty}</span>
                        <button
                          className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 font-medium text-lg"
                          onClick={(e) => { e.stopPropagation(); increment(l.product.id); }}
                        >+</button>
                        <button
                          className="ml-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200"
                          onClick={(e) => { e.stopPropagation(); removeLine(l.product.id); }}
                        >Remove</button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-blue-600 font-medium">₹{l.product.unitPrice.toFixed(2)}</td>
                    {/* New Discount column */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 rounded border border-gray-300 bg-white px-2 text-xs"
                          value={l.itemDiscountMode ?? 'amount'}
                          onChange={(e) => setItemDiscountMode(l.product.id, e.target.value as 'amount' | 'percent')}
                        >
                          <option value="amount">₹</option>
                          <option value="percent">%</option>
                        </select>
                        <Input
                          type="number"
                          className="w-20 h-8"
                          placeholder="0"
                          value={(l.itemDiscount ?? 0) === 0 ? "" : l.itemDiscount}
                          onChange={(e) => setItemDiscount(l.product.id, Number(e.target.value || 0))}
                        />
                        {/* Removed inline deducted amount display per request */}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-blue-600 font-semibold">₹{(l.product.unitPrice * l.qty - lineDiscount(l)).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Advanced Options - Collapsible */}
        {cart.length > 0 && (
          <details className="bg-white rounded-lg shadow-sm p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700 select-none">
              Advanced Options (Bill Discount, GST, Customer, Offers)
            </summary>
            <div className="mt-4 space-y-4 border-t pt-4">
              {/* Bill Discount */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Bill-Level Discount</h3>
                <div className="flex items-center gap-3">
                  <select
                    className="h-9 rounded border border-gray-300 bg-white px-3 text-sm"
                    value={billDiscountMode}
                    onChange={(e) => setBillDiscountMode(e.target.value as 'amount' | 'percent')}
                  >
                    <option value="amount">₹ Amount</option>
                    <option value="percent">% Percentage</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0"
                    value={billDiscount === 0 ? "" : billDiscount}
                    onChange={(e) => setBillDiscount(Number(e.target.value || 0))}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* GST Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">GST Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Customer GSTIN (optional)"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                  />
                  <Input
                    placeholder="Place of Supply (e.g., TN)"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                  />
                </div>
              </div>

              {/* Customer */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Customer Details</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Phone number"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      onBlur={lookupCustomerByPhone}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={lookupCustomerByPhone}
                      disabled={custChecking}
                      className="h-9"
                    >
                      {custChecking ? 'Checking…' : 'Lookup'}
                    </Button>
                  </div>
                  {custFound ? (
                    <div className="text-xs text-gray-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                      <div className="font-medium text-gray-900">{custFound.name}</div>
                      {typeof custFound.points === 'number' && (
                        <div className="mt-1">Loyalty Points: <span className="font-semibold text-emerald-700">{custFound.points}</span></div>
                      )}
                    </div>
                  ) : custPhone ? (
                    <div className="space-y-2">
                      <Input placeholder="Customer name" value={custName} onChange={(e) => setCustName(e.target.value)} />
                      <Input placeholder="Email (optional)" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
                      <Input type="date" placeholder="Kid's DOB" value={custKidsDob} onChange={(e) => setCustKidsDob(e.target.value)} />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Offers */}
              {offers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Active Offers</h3>
                  <div className="flex flex-wrap gap-2">
                    {offers.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => applyOffer(o.id!)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${offerAppliedId === o.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                          }`}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                  {bestOffer && (
                    <div className="text-xs text-gray-600 mt-2">
                      Suggested:{' '}
                      <button className="underline text-blue-600" onClick={() => applyOffer(bestOffer.id!)}>
                        {bestOffer.name}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-xs underline text-gray-500 hover:text-gray-700 mt-2"
                    onClick={clearOfferAdjustments}
                  >
                    Clear all adjustments
                  </button>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Grand Total Summary (tax-included total; GST line hidden for now) */}
        {cart.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 text-sm text-gray-600">
                <div>Subtotal</div>
                <div>Bill Discount</div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-sm font-medium text-gray-900">₹{subTotal.toFixed(2)}</div>
                <div className="text-sm font-medium text-gray-900">−₹{billDiscComputed.toFixed(2)}</div>
              </div>
            </div>
            <div className="border-t mt-4 pt-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Grand Total</div>
              <div className="text-2xl font-bold text-gray-900">₹{total.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Payment Options */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Options</h2>
          <div className="flex gap-3 mb-4">
            {(['cash', 'card', 'upi'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${paymentMethod === method
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {method.charAt(0).toUpperCase() + method.slice(1)}
              </button>
            ))}
          </div>
          {(paymentMethod === 'card' || paymentMethod === 'upi') && (
            <Input
              placeholder="Payment Reference / Transaction ID (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="mb-6"
            />
          )}

          {/* Complete Sale Button */}
          <button
            onClick={onCheckout}
            disabled={cart.length === 0 || busy}
            className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-semibold rounded-lg text-lg transition-colors"
          >
            {busy ? 'Processing...' : 'Complete Sale'}
          </button>

          {/* Clear Draft */}
          <button
            onClick={() => {
              setCart([]);
              setBillDiscount(0);
              setPaymentRef('');
              setCustPhone('');
              setCustName('');
              setCustEmail('');
              setCustKidsDob('');
              try {
                localStorage.removeItem(DRAFT_KEY_V2);
                localStorage.removeItem(DRAFT_KEY_V1);
              } catch { }
              showToast('success', 'Cart cleared');
            }}
            disabled={cart.length === 0}
            className="w-full mt-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
          >
            Clear Cart
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 shadow-xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
              }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
