"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listOps, removeOp, processOpById, processQueue } from "@/lib/offline";
import { useToast } from "@/components/ui/toast";

type ViewOp = { id: string; type: string; createdAt: string; attempts?: number; payload?: any };

export default function OfflineQueuePage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ViewOp[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const ops = await listOps();
      ops.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      setItems(ops as any);
    } catch (e) {
      toast({ title: 'Failed to load queue', description: String(e), variant: 'destructive' });
    }
  }

  useEffect(() => { refresh(); }, []);

  const failed = useMemo(() => items.filter(i => (i.attempts || 0) > 0), [items]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') {
    return (
      <div className="p-6 space-y-3">
        {!user ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Waiting for sign-in — queue processing is paused
          </div>
        ) : null}
        <div className="text-sm text-muted-foreground">Admin access required.</div>
      </div>
    );
  }

  async function onRetry(id: string) {
    setBusy(true);
    try {
      const ok = await processOpById(id);
      if (ok) toast({ title: 'Retried', description: `Operation ${id} applied`, variant: 'success' });
      else toast({ title: 'Retry failed', description: `See console for details`, variant: 'destructive' });
      await refresh();
    } finally { setBusy(false); }
  }
  async function onRemove(id: string) {
    setBusy(true);
    try {
      await removeOp(id);
      toast({ title: 'Removed', description: id, variant: 'success' });
      await refresh();
    } finally { setBusy(false); }
  }
  async function onRetryAll() {
    setBusy(true);
    try {
      await processQueue();
      toast({ title: 'Queue processed', variant: 'success' });
      await refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Offline Queue</h1>
        <div />
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <button className="h-9 px-3 rounded-md border text-sm" onClick={refresh} disabled={busy}>Refresh</button>
        <button className="h-9 px-3 rounded-md border text-sm" onClick={onRetryAll} disabled={busy || items.length === 0}>Process Queue</button>
        {/* Auth badge for clarity */}
        <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Signed in as {user.email || user.uid}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">Pending: {items.length} · Failed: {failed.length}</div>

      <div className="border rounded-md overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Attempts</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>Queue is empty</td></tr>
            ) : items.map((op) => (
              <tr key={op.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{op.id}</td>
                <td className="px-3 py-2">{op.type}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(op.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{op.attempts || 0}</td>
                <td className="px-3 py-2 flex gap-2">
                  <button className="h-8 px-3 rounded-md border text-sm" onClick={() => onRetry(op.id)} disabled={busy}>Retry</button>
                  <button className="h-8 px-3 rounded-md border text-sm" onClick={() => onRemove(op.id)} disabled={busy}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        Notes: “Failed” means the op has been attempted at least once and will be retried automatically when online. Use Retry to attempt immediately, or Remove to discard.
      </div>
    </div>
  );
}
