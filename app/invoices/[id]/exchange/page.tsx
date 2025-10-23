"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { InvoiceDoc, ProductDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts, findProductBySKU } from "@/lib/products";
import { decodeBarcode } from "@/lib/barcodes";
import { performExchange } from "@/lib/exchange";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast";

type ReturnLineUI = { productId: string; name: string; maxQty: number; qty: number; defect: boolean };
type NewLineUI = { productId: string; name: string; sku: string; qty: number; unitPrice: number };

export default function ExchangePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [returns, setReturns] = useState<ReturnLineUI[]>([]);
  const [newLines, setNewLines] = useState<NewLineUI[]>([]);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [blockedProductIds, setBlockedProductIds] = useState<Set<string>>(new Set());
  const [scanValue, setScanValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const [invSnap, prodsSnap] = await Promise.all([
        getDoc(doc(db, 'Invoices', id)),
        listProducts(),
      ]);
      if (invSnap.exists()) {
        const invoice = toInvoiceDoc(invSnap.id, invSnap.data() as any);
        setInv(invoice);
        // Build return lines from original invoice items
        const merged = new Map<string, ReturnLineUI>();
        for (const it of invoice.items) {
          const cur = merged.get(it.productId);
          if (cur) { cur.maxQty += it.quantity; } else {
            merged.set(it.productId, { productId: it.productId, name: it.name, maxQty: it.quantity, qty: 0, defect: false });
          }
        }
        setReturns(Array.from(merged.values()));
      }
      setProducts(prodsSnap);
      // Fetch prior exchanges to enforce one exchange per product per invoice
      const exQs = query(collection(db, 'Exchanges'), where('originalInvoiceId', '==', id));
      const exSnap = await getDocs(exQs);
      const blocked = new Set<string>();
      exSnap.forEach(d => {
        const data = d.data() as any;
        const ret: any[] = Array.isArray(data.returned) ? data.returned : [];
        for (const r of ret) if (r?.productId) blocked.add(r.productId);
      });
      setBlockedProductIds(blocked);
    })();
  }, [id]);

  function setReturnQty(pid: string, qty: number) {
    setReturns(prev => prev.map(r => r.productId === pid ? { ...r, qty: Math.max(0, Math.min(r.maxQty, Math.floor(qty || 0))) } : r));
  }
  function setReturnDefect(pid: string, defect: boolean) {
    setReturns(prev => prev.map(r => r.productId === pid ? { ...r, defect } : r));
  }

  async function addNewByScan() {
    const raw = scanValue.trim();
    if (!raw) return;
    setScanValue("");
    const dec = decodeBarcode(raw);
    const sku = dec?.sku || raw;
    const prod = await findProductBySKU(sku);
    if (!prod) { toast({ title: 'Not found', description: `SKU ${sku}`, variant: 'destructive' }); return; }
    setNewLines(prev => {
      const idx = prev.findIndex(n => n.productId === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { productId: prod.id!, name: prod.name, sku: prod.sku, qty: 1, unitPrice: prod.unitPrice }];
    });
    toast({ title: 'Added', description: `${prod.name}`, variant: 'success', duration: 1200 });
  }

  function setNewQty(pid: string, qty: number) {
    setNewLines(prev => prev.map(n => n.productId === pid ? { ...n, qty: Math.max(1, Math.floor(qty || 1)) } : n));
  }
  function removeNew(pid: string) { setNewLines(prev => prev.filter(n => n.productId !== pid)); }

  const returnCredit = useMemo(() => 0 /* computed server-side precisely */, []);
  const newSubtotal = useMemo(() => newLines.reduce((s, n) => s + n.unitPrice * n.qty, 0), [newLines]);

  async function submitExchange() {
    if (!inv || !user) return;
    const returned = returns.filter(r => r.qty > 0 && !blockedProductIds.has(r.productId)).map(r => ({ productId: r.productId, qty: r.qty, defect: r.defect }));
    if (returned.length === 0 && newLines.length === 0) { toast({ title: 'Nothing to exchange', variant: 'warning' }); return; }
    setBusy(true);
    try {
      // Choose methods based on rough difference sign from client subtotal; server will compute exact
      const diffRough = newSubtotal - 0; // return credit unknown here
      const res = await performExchange({
        originalInvoiceId: inv.id!,
        returned,
        newItems: newLines.map(n => ({ productId: n.productId, qty: n.qty })),
        cashierUserId: user.uid,
        cashierName: user.displayName || undefined,
        paymentMethod: diffRough > 0 ? 'cash' : undefined,
        refundMethod: diffRough < 0 ? 'cash' : undefined,
      });
      toast({ title: 'Exchange completed', description: res.newInvoiceId ? `Invoice ${res.newInvoiceId}` : (res.refundId ? `Refund ${res.refundId}` : ''), variant: 'success' });
      router.push(`/invoices/${res.newInvoiceId || inv.id}`);
    } catch (e) {
      toast({ title: 'Exchange failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  }

  if (!inv) return <div className="p-6">Preparing…</div>;
  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold">Exchange Items — Invoice {inv.invoiceNumber}</h1>

      <div className="border rounded-md overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 text-sm font-medium">Return from original</div>
        <div className="p-4 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Max Qty</th>
                <th className="px-2 py-2">Return Qty</th>
                <th className="px-2 py-2">Defect?</th>
              </tr>
            </thead>
            <tbody>
              {returns.map(r => (
                <tr key={r.productId} className="border-t">
                  <td className="px-2 py-2">{r.name} {blockedProductIds.has(r.productId) && <span className="text-xs text-red-600 ml-2">(already exchanged)</span>}</td>
                  <td className="px-2 py-2">{r.maxQty}</td>
                  <td className="px-2 py-2">
                    <input type="number" className="h-8 w-24 border rounded px-2" value={r.qty} onChange={e => setReturnQty(r.productId, Number(e.target.value || 0))} disabled={blockedProductIds.has(r.productId)} />
                  </td>
                  <td className="px-2 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={r.defect} onChange={e => setReturnDefect(r.productId, e.target.checked)} disabled={blockedProductIds.has(r.productId)} />
                      <span>Mark as defect</span>
                    </label>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr><td className="px-2 py-4 text-center text-muted-foreground" colSpan={4}>No items on original invoice</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 text-sm font-medium">Add new items</div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <input ref={inputRef} value={scanValue} onChange={e => setScanValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewByScan(); } }} className="h-9 border rounded px-2 w-72" placeholder="Scan or enter SKU…" />
            <button className="h-9 px-3 rounded border" onClick={addNewByScan}>Add</button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Unit Price</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {newLines.map(n => (
                  <tr key={n.productId} className="border-t">
                    <td className="px-2 py-2">{n.name}</td>
                    <td className="px-2 py-2">{n.sku}</td>
                    <td className="px-2 py-2"><input type="number" className="h-8 w-24 border rounded px-2" value={n.qty} onChange={e => setNewQty(n.productId, Number(e.target.value || 1))} /></td>
                    <td className="px-2 py-2">₹{n.unitPrice.toFixed(2)}</td>
                    <td className="px-2 py-2"><button className="h-8 px-3 rounded border" onClick={() => removeNew(n.productId)}>Remove</button></td>
                  </tr>
                ))}
                {newLines.length === 0 && (
                  <tr><td className="px-2 py-4 text-center text-muted-foreground" colSpan={5}>No new items added</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border rounded-md p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">New items subtotal: ₹{newSubtotal.toFixed(2)}. Return credit is computed at confirm.</div>
        <div className="flex gap-2">
          <button className="h-9 px-3 rounded border" onClick={() => router.back()} disabled={busy}>Cancel</button>
          <button className="h-9 px-4 rounded bg-blue-600 text-white disabled:opacity-50" onClick={submitExchange} disabled={busy}>Confirm Exchange</button>
        </div>
      </div>
    </div>
  );
}
