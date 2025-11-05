"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import { COLLECTIONS, type InventoryLogDoc } from "@/lib/models";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function toLog(id: string, data: Record<string, unknown>): InventoryLogDoc {
  const now = new Date().toISOString();
  const t = typeof data.type === 'string' && ['adjustment', 'sale', 'purchase', 'return', 'damage'].includes(data.type) ? (data.type as InventoryLogDoc['type']) : 'adjustment';
  return {
    id,
    productId: String(data.productId || ""),
    type: t,
    quantityChange: typeof data.quantityChange === 'number' ? data.quantityChange : Number(data.quantityChange || 0),
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    relatedInvoiceId: typeof data.relatedInvoiceId === 'string' ? data.relatedInvoiceId : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    previousStock: typeof data.previousStock === 'number' ? data.previousStock : undefined,
    newStock: typeof data.newStock === 'number' ? data.newStock : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
  };
}

export default function AuditTrailPage() {
  const { user, role, loading } = useAuth();
  const [logs, setLogs] = useState<InventoryLogDoc[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.inventoryLogs);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (from) constraints.push(where('createdAt', '>=', new Date(from).toISOString()));
    if (to) { const end = new Date(to); end.setHours(23,59,59,999); constraints.push(where('createdAt', '<=', end.toISOString())); }
    if (userId) constraints.push(where('userId', '==', userId));
    if (type) constraints.push(where('type', '==', type));
    if (productId) constraints.push(where('productId', '==', productId));
    // Firestore does not support contains for reason; simple eq filter when provided
    if (reason) constraints.push(where('reason', '==', reason));
    const q = query(col, ...constraints);
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      setLogs(snap.docs.map(d => toLog(d.id, d.data() as Record<string, unknown>)));
    });
    return () => unsub();
  }, [from, to, userId, type, reason, productId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Audit Trail</h1>
        <div />
      </div>
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">User ID</label>
            <Input placeholder="uid" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="damage">Damage</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Reason (exact)</label>
            <Input placeholder="e.g., sale, receive, barcode-print" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Product ID</label>
            <Input placeholder="productId" value={productId} onChange={(e) => setProductId(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <button className="h-9 px-3 rounded-md border text-sm font-medium hover:bg-gray-50" onClick={() => { setFrom(""); setTo(""); setUserId(""); setType(""); setReason(""); setProductId(""); }}>Clear</button>
        </div>
      </Card>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Δ Qty</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Invoice/Receipt</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{l.productId}</td>
                <td className="px-3 py-2">{l.type}</td>
                <td className="px-3 py-2 text-right">{l.quantityChange}</td>
                <td className="px-3 py-2">{l.reason || '-'}</td>
                <td className="px-3 py-2">{l.relatedInvoiceId || '-'}</td>
                <td className="px-3 py-2">{l.userId || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>No audit entries</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
