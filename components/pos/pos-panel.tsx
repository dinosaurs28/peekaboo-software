"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProductDoc } from "@/lib/models";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU, listProducts } from "@/lib/products";
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
  const [custFound, setCustFound] = useState<{ id: string; name: string } | null>(null);
  const [custChecking, setCustChecking] = useState(false);

  // Focus the input to capture scanner entries
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Load catalog for name search/manual add fallback
    listProducts().then(setAllProducts).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Load active offers for cashier visibility
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
  const subTotal = useMemo(() => cart.reduce((sum, l) => sum + l.product.unitPrice * l.qty - lineDiscount(l), 0), [cart, lineDiscount]);
  const billDiscComputed = useMemo(() => (billDiscountMode === 'amount' ? billDiscount : (subTotal * billDiscount) / 100), [billDiscountMode, billDiscount, subTotal]);
  const total = useMemo(() => Math.max(0, subTotal - billDiscComputed), [subTotal, billDiscComputed]);

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
    const product = await findProductBySKU(sku);
    if (!product) {
      showToast('error', `No product found for SKU ${sku}`);
      setScanValue("");
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        showToast('success', `${product.name} × ${copy[idx].qty}`);
        setSelectedIndex(idx);
        return copy;
      }
      showToast('success', `${product.name} added`);
      const next = [...prev, { product, qty: 1 }];
      setSelectedIndex(next.length - 1);
      return next;
    });

    setScanValue("");
    inputRef.current?.focus();
  }

  function increment(id?: string) {
    if (!id) return;
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, qty: l.qty + 1 } : l)));
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
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, qty: Math.max(1, Math.floor(qty)) } : l)));
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
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        showToast('success', `${p.name} × ${copy[idx].qty}`);
        setSelectedIndex(idx);
        return copy;
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
      return;
    }
    try {
      setCustChecking(true);
      const c = await findCustomerByPhone(phone);
      if (c) {
        setCustFound({ id: c.id!, name: c.name });
        setCustName(c.name || "");
        setCustEmail(c.email || "");
        setCustKidsDob(c.kidsDob || "");
      } else {
        setCustFound(null);
        // keep entered values (if any), otherwise clear name for clarity
        if (!custName) setCustName("");
        if (!custEmail) setCustEmail("");
        if (!custKidsDob) setCustKidsDob("");
      }
    } catch {
      // ignore lookup errors for now but notify
      showToast('error', 'Failed to lookup customer');
    } finally {
      setCustChecking(false);
    }
  }

  async function onCheckout() {
    if (cart.length === 0) return;
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
      await checkoutCart({
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
      });
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <form onSubmit={handleScanSubmit} className="flex flex-wrap gap-2 items-center relative">
          <Input
            ref={inputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="Scan barcode here..."
            autoComplete="off"
          />
          <Button type="submit">Add</Button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-muted-foreground">Bill discount</label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={billDiscountMode} onChange={(e) => setBillDiscountMode(e.target.value as 'amount' | 'percent')}>
              <option value="amount">₹ Amount</option>
              <option value="percent">% Percentage</option>
            </select>
            <Input type="number" placeholder="0" value={billDiscount === 0 ? "" : billDiscount}
              onChange={(e) => setBillDiscount(Number(e.target.value || 0))} className="w-28" />
          </div>
        </form>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="relative">
          <Input
            placeholder="Search by name or SKU…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
          />
          {searchOpen && filtered.length > 0 && (
            <DropdownPanel className="absolute z-10 mt-1 w-full max-h-64 overflow-auto">
              {filtered.map((p) => (
                <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => { addByProductId(p.id); setSearchTerm(""); setSearchOpen(false); inputRef.current?.focus(); }}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.sku} • ₹{p.unitPrice.toFixed(2)}</div>
                </button>
              ))}
            </DropdownPanel>
          )}
        </div>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Item Disc.</th>
                <th className="px-3 py-2">Line Total</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={6}>Scan or search items to add to the bill</td>
                </tr>
              ) : (
                cart.map((l, idx) => (
                  <tr
                    key={l.product.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onClick={() => setSelectedIndex(idx)}
                    className={`border-t cursor-pointer ${idx === selectedIndex ? 'bg-muted/40 outline-1 outline-primary/50' : ''}`}
                  >
                    <td className="px-3 py-2">{l.product.name}<div className="text-xs text-muted-foreground">{l.product.sku}</div></td>
                    <td className="px-3 py-2">₹{l.product.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <Input type="number" className="w-20" placeholder="1" value={l.qty === 1 ? "" : l.qty}
                        onChange={(e) => setQty(l.product.id, Number(e.target.value || 1))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={l.itemDiscountMode ?? 'amount'} onChange={(e) => setItemDiscountMode(l.product.id, e.target.value as 'amount' | 'percent')}>
                          <option value="amount">₹ Amount</option>
                          <option value="percent">% Percentage</option>
                        </select>
                        <Input type="number" className="w-24" placeholder="0" value={(l.itemDiscount ?? 0) === 0 ? "" : l.itemDiscount}
                          onChange={(e) => setItemDiscount(l.product.id, Number(e.target.value || 0))} />
                      </div>
                    </td>
                    <td className="px-3 py-2">₹{(l.product.unitPrice * l.qty - lineDiscount(l)).toFixed(2)}</td>
                    <td className="px-3 py-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => increment(l.product.id)}>+</Button>
                      <Button size="sm" variant="outline" onClick={() => decrement(l.product.id)}>-</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeLine(l.product.id)}>Remove</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-4">
        <div className="border rounded-md p-4 space-y-3">
          <div className="text-sm font-medium">Customer</div>
          <div className="flex items-center gap-2">
            <Input placeholder="Phone number" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} onBlur={lookupCustomerByPhone} className="flex-1" />
            <Button type="button" variant="outline" onClick={lookupCustomerByPhone} disabled={custChecking}>{custChecking ? 'Checking…' : 'Check'}</Button>
          </div>
          {custFound ? (
            <div className="text-xs text-muted-foreground">Existing customer: <span className="font-medium">{custFound.name}</span></div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Customer name" value={custName} onChange={(e) => setCustName(e.target.value)} />
              <Input placeholder="Email (optional)" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Kid&apos;s DOB</label>
                <Input type="date" value={custKidsDob} onChange={(e) => setCustKidsDob(e.target.value)} className="w-48" />
              </div>
            </div>
          )}
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">Subtotal</div>
          <div className="text-xl font-semibold">₹{subTotal.toFixed(2)}</div>
        </div>
        {offers.length > 0 && (
          <div className="border rounded-md p-4 space-y-2">
            <div className="text-sm font-medium">Active Offers</div>
            <div className="flex flex-wrap gap-2">
              {offers.map(o => (
                <button key={o.id} type="button" onClick={() => applyOffer(o.id!)} className={`px-2 py-1 rounded-md border text-sm ${offerAppliedId === o.id ? 'bg-emerald-600 text-white' : 'bg-background'}`}>{o.name}</button>
              ))}
            </div>
            {bestOffer && <div className="text-xs text-muted-foreground">Suggested: <button className="underline" onClick={() => applyOffer(bestOffer.id!)}>{bestOffer.name}</button></div>}
            <button type="button" className="text-xs underline text-muted-foreground" onClick={clearOfferAdjustments}>Clear offer adjustments</button>
          </div>
        )}
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">Bill discount</div>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={billDiscountMode} onChange={(e) => setBillDiscountMode(e.target.value as 'amount' | 'percent')}>
              <option value="amount">₹ Amount</option>
              <option value="percent">% Percentage</option>
            </select>
            <Input type="number" placeholder="0" value={billDiscount === 0 ? "" : billDiscount}
              onChange={(e) => setBillDiscount(Number(e.target.value || 0))} />
          </div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">Grand Total</div>
          <div className="text-2xl font-semibold">₹{total.toFixed(2)}</div>
        </div>
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Payment</label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi' | 'wallet')}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
            </select>
          </div>
          <Input placeholder="Reference / Txn ID (optional)" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
          {/* Split payments removed */}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" disabled={cart.length === 0} onClick={() => { setCart([]); setBillDiscount(0); setPaymentRef(""); setCustPhone(""); setCustName(""); setCustEmail(""); setCustKidsDob(""); try { localStorage.removeItem(DRAFT_KEY_V2); localStorage.removeItem(DRAFT_KEY_V1); } catch { }; showToast('success', 'Draft cleared'); }}>Clear Draft</Button>
          <Button className="flex-1" disabled={cart.length === 0} onClick={onCheckout}>Confirm Payment & Checkout</Button>
        </div>
        {toast && (
          <div className={`fixed bottom-4 right-4 rounded-md px-4 py-3 shadow-lg border text-sm ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
