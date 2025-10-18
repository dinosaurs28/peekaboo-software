"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU } from "@/lib/products";
import { receiveStock } from "@/lib/pos";

type ReceiveLine = { productId: string; sku: string; name: string; qty: number; unitCost?: number };

export default function ReceiveStockPage() {
  const { user, role, loading } = useAuth();
  const [scanValue, setScanValue] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [note, setNote] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const canUse = useMemo(() => !loading && user && role === 'admin', [loading, user, role]);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!canUse) return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const raw = scanValue.trim();
    if (!raw) return;
    setScanValue("");
    const decoded = decodeBarcode(raw);
    const sku = decoded?.sku || raw;
    const prod = await findProductBySKU(sku);
    if (!prod) {
      alert(`SKU not found: ${sku}. Please add the product first in Products, then generate barcode.`);
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
      const rid = await receiveStock({
        createdByUserId: user!.uid,
        supplierName: supplierName || undefined,
        docNo: docNo || undefined,
        docDate: docDate ? new Date(docDate).toISOString() : undefined,
        note: note || undefined,
        lines: lines.map(l => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, unitCost: l.unitCost })),
      });
      alert(`Stock received. Receipt ID: ${rid}`);
      setLines([]);
      setNote("");
      setSupplierName("");
      setDocNo("");
    } catch (e) {
      alert(`Failed to post receipt: ${e instanceof Error ? e.message : String(e)}`);
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
          <Input ref={inputRef} value={scanValue} onChange={e => setScanValue(e.target.value)} placeholder="Scan PB|CAT|SKU or SKU…" />
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
