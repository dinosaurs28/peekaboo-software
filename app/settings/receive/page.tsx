"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU } from "@/lib/products";
import { findCachedBySKU } from "@/lib/catalog-cache";
import { enqueueOp } from "@/lib/offline";
import { receiveStock } from "@/lib/pos";
import { useToast } from "@/components/ui/toast";

type ReceiveLine = { productId: string; sku: string; name: string; qty: number; unitCost?: number };

export default function ReceiveStockPage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [scanValue, setScanValue] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [note, setNote] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bufferRef = useRef<string>("");
  const lastKeyTsRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);
  const SCAN_IDLE_MS = 120; // finalize scan after this idle
  const SCAN_BURST_GAP_MS = 35; // distinguish fast scanner from slow typing

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Keep the input focused (some browsers shift focus on print dialogs or clicks)
  function ensureFocus() {
    const el = inputRef.current;
    if (el && document.activeElement !== el) el.focus();
  }

  useEffect(() => {
    function finalizeBuffer() {
      const value = bufferRef.current.trim();
      if (value) {
        setScanValue(value);
        // Trigger the same flow as submit
        processScanValue(value);
      }
      bufferRef.current = "";
    }

    function onKeyDown(e: KeyboardEvent) {
      // Only process visible page
      if (document.hidden) return;

      const now = performance.now();
      const gap = now - lastKeyTsRef.current;
      lastKeyTsRef.current = now;

      // Printable character
      if (e.key.length === 1) {
        // If long gap, treat as new scan
        if (gap > 300) bufferRef.current = "";
        bufferRef.current += e.key;
        // Mirror into input for visibility
        setScanValue(bufferRef.current);
        // Restart idle timer
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(finalizeBuffer, SCAN_IDLE_MS);
        return;
      }
      // Submit on Enter or Tab (many scanners use these as suffix)
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        finalizeBuffer();
        ensureFocus();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    const id = window.setInterval(ensureFocus, 1000);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearInterval(id);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const canUse = useMemo(() => !loading && user && role === 'admin', [loading, user, role]);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!canUse) return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const raw = scanValue.trim();
    if (!raw) return;
    await processScanValue(raw);
    setScanValue("");
  }

  async function processScanValue(raw: string) {
    const decoded = decodeBarcode(raw);
    const sku = decoded?.sku || raw;
    let prod = await findProductBySKU(sku);
    if (!prod && !navigator.onLine) {
      const cached = await findCachedBySKU(sku);
      if (cached) {
        prod = { id: cached.id, name: cached.name, sku: cached.sku, unitPrice: cached.unitPrice, active: true, stock: 0, createdAt: '', updatedAt: '' } as any;
      }
    }
    if (!prod) {
      toast({ title: 'Scan failed', description: `SKU not found: ${sku}`, variant: 'destructive' });
      return;
    }
    setLines(prev => {
      const idx = prev.findIndex(l => l.productId === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { productId: prod.id!, sku: prod.sku, name: prod.name, qty: 1 }];
    });
    toast({ title: 'Item added', description: `${prod.name}`, variant: 'success', duration: 1500 });
  }

  function setQty(id: string, qty: number) {
    setLines(prev => prev.map(l => l.productId === id ? { ...l, qty: Math.max(1, Math.floor(qty || 1)) } : l));
  }
  function setUnitCost(id: string, cost?: number) {
    setLines(prev => prev.map(l => l.productId === id ? { ...l, unitCost: cost && cost > 0 ? cost : undefined } : l));
  }
  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.productId !== id));
  }

  async function postReceipt() {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const payload = {
        createdByUserId: user!.uid,
        supplierName: supplierName || undefined,
        docNo: docNo || undefined,
        docDate: docDate ? new Date(docDate).toISOString() : undefined,
        note: note || undefined,
        lines: lines.map(l => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, unitCost: l.unitCost })),
      };
      if (!navigator.onLine) {
        const id = `op-rec-${Date.now()}`;
        await enqueueOp({ id, type: 'receive', payload, createdAt: new Date().toISOString(), attempts: 0 });
        toast({ title: 'Queued offline', description: 'Receipt will sync when connected', variant: 'success' });
      } else {
        const rid = await receiveStock(payload);
        toast({ title: 'Stock received', description: `Receipt ${rid}`, variant: 'success' });
      }
      setLines([]);
      setNote("");
      setSupplierName("");
      setDocNo("");
    } catch (e) {
      toast({ title: 'Receive failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Receive Stock (Scan)</h1>
        <div />
      </div>
      <Card className="p-4 space-y-3">
        <form onSubmit={handleScan} className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={scanValue}
            onChange={e => setScanValue(e.target.value)}
            placeholder="Scan PB|CAT|SKU or SKU…"
            onBlur={ensureFocus}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          <Button type="submit">Add</Button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Supplier (optional)" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
          <Input placeholder="Doc No (optional)" value={docNo} onChange={e => setDocNo(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Date</label>
            <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
          </div>
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </Card>
      <Card className="p-0">
        <div className="px-4 pt-4 pb-2 text-sm text-muted-foreground">{lines.length} item(s)</div>
        <div className="px-4 pb-4 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit Cost (₹)</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>Scan items to receive</td></tr>
              ) : (
                lines.map(l => (
                  <tr key={l.productId} className="border-t">
                    <td className="px-3 py-2 font-medium">{l.name}</td>
                    <td className="px-3 py-2">{l.sku}</td>
                    <td className="px-3 py-2"><Input type="number" className="w-24" value={l.qty} onChange={e => setQty(l.productId, Number(e.target.value || 1))} /></td>
                    <td className="px-3 py-2"><Input type="number" className="w-32" placeholder="Optional" value={l.unitCost ?? ''} onChange={e => setUnitCost(l.productId, Number(e.target.value || 0))} /></td>
                    <td className="px-3 py-2"><Button size="sm" variant="destructive" onClick={() => removeLine(l.productId)}>Remove</Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setLines([])} disabled={busy || lines.length === 0}>Clear</Button>
        <Button onClick={postReceipt} disabled={busy || lines.length === 0}>Post Receipt</Button>
      </div>
      <div className="text-xs text-muted-foreground">
        Note: If a scan is not found, register the product in Products and generate its barcode first.
      </div>
    </div>
  );
}
