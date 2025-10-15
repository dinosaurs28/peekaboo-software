"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProductDoc } from "@/lib/models";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU, listProducts } from "@/lib/products";
import { checkoutCart } from "@/lib/pos";
import { useAuth } from "@/components/auth/auth-provider";

export function PosPanel() {
  const [scanValue, setScanValue] = useState("");
  type CartLine = { product: ProductDoc; qty: number; itemDiscount?: number; itemDiscountMode?: 'amount' | 'percent' };
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [allProducts, setAllProducts] = useState<ProductDoc[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billDiscountMode, setBillDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; type: 'error' | 'success'; message: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [paymentRef, setPaymentRef] = useState("");
  const { user } = useAuth();

  // Focus the input to capture scanner entries
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Load catalog for name search/manual add fallback
    listProducts().then(setAllProducts).catch(() => undefined);
  }, []);

  // Draft persistence (load)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos.cart.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.cart)) setCart(parsed.cart);
        if (typeof parsed?.billDiscount === 'number') setBillDiscount(parsed.billDiscount);
        if (parsed?.billDiscountMode === 'amount' || parsed?.billDiscountMode === 'percent') setBillDiscountMode(parsed.billDiscountMode);
        if (parsed?.paymentMethod) setPaymentMethod(parsed.paymentMethod);
        if (typeof parsed?.paymentRef === 'string') setPaymentRef(parsed.paymentRef);
      }
    } catch { /* ignore */ }
  }, []);

  // Draft persistence (save)
  useEffect(() => {
    try {
      localStorage.setItem("pos.cart.v1", JSON.stringify({ cart, billDiscount, billDiscountMode, paymentMethod, paymentRef }));
    } catch { /* ignore */ }
  }, [cart, billDiscount, billDiscountMode, paymentMethod, paymentRef]);

  const lineDiscount = useCallback((l: CartLine) => {
    const base = l.product.unitPrice * l.qty;
    const v = Number(l.itemDiscount ?? 0);
    return (l.itemDiscountMode ?? 'amount') === 'amount' ? v : (base * v) / 100;
  }, []);
  const subTotal = useMemo(() => cart.reduce((sum, l) => sum + l.product.unitPrice * l.qty - lineDiscount(l), 0), [cart, lineDiscount]);
  const billDiscComputed = useMemo(() => (billDiscountMode === 'amount' ? billDiscount : (subTotal * billDiscount) / 100), [billDiscountMode, billDiscount, subTotal]);
  const total = useMemo(() => Math.max(0, subTotal - billDiscComputed), [subTotal, billDiscComputed]);

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
        return copy;
      }
      showToast('success', `${product.name} added`);
      return [...prev, { product, qty: 1 }];
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
    setCart((prev) => prev.filter((l) => l.product.id !== id));
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
        return copy;
      }
      showToast('success', `${p.name} added`);
      return [...prev, { product: p, qty: 1 }];
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

  async function onCheckout() {
    if (cart.length === 0) return;
    try {
      await checkoutCart({
        lines: cart.map((l) => ({
          productId: l.product.id!,
          name: l.product.name,
          qty: l.qty,
          unitPrice: l.product.unitPrice,
          lineDiscount: lineDiscount(l),
        })),
        billDiscount: billDiscComputed,
        paymentMethod,
        paymentReferenceId: paymentRef || undefined,
        cashierUserId: user?.uid,
      });
      showToast('success', 'Checkout complete. Invoice saved.');
      setCart([]);
      setBillDiscount(0);
      setPaymentRef("");
    } catch (e) {
      showToast('error', 'Checkout failed. Try again.');
    }
  }

  // Keyboard shortcuts for speed: + to increment last line, - to decrement, Backspace/Delete to remove
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement | null;
      const tag = (ae?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (cart.length === 0) return;
      const last = cart[cart.length - 1];
      if (!last?.product?.id) return;
      if (e.key === '+') {
        e.preventDefault();
        increment(last.product.id);
      } else if (e.key === '-') {
        e.preventDefault();
        decrement(last.product.id);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        removeLine(last.product.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart]);

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
            <div className="absolute z-10 mt-1 w-full border rounded-md bg-background max-h-64 overflow-auto">
              {filtered.map((p) => (
                <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => { addByProductId(p.id); setSearchTerm(""); setSearchOpen(false); inputRef.current?.focus(); }}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.sku} • ₹{p.unitPrice.toFixed(2)}</div>
                </button>
              ))}
            </div>
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
                cart.map((l) => (
                  <tr key={l.product.id} className="border-t">
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
        <div className="border rounded-md p-4">
          <div className="text-sm text-muted-foreground">Subtotal</div>
          <div className="text-xl font-semibold">₹{subTotal.toFixed(2)}</div>
        </div>
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
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" disabled={cart.length === 0} onClick={() => { setCart([]); setBillDiscount(0); setPaymentRef(""); showToast('success', 'Draft cleared'); }}>Clear Draft</Button>
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
