"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategory } from "@/lib/categories";

export default function NewCategoryPage() {
  const { user, role, loading } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;
  async function onSave() {
    if (!name || !code) { alert('Name and Code required'); return; }
    setBusy(true);
    try {
      await createCategory({ name, code, description: description || undefined, active });
      window.location.href = "/settings/categories";
    } catch (e) {
      alert(String(e));
    } finally { setBusy(false); }
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings/categories"; }}>← Back</button>
        <h1 className="text-xl font-semibold">New Category</h1>
        <div />
      </div>
      <div className="border rounded-md p-4 space-y-3 max-w-xl">
        <div>
          <label className="text-sm">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Code</label>
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CLO" />
        </div>
        <div>
          <label className="text-sm">Description (optional)</label>
          <Input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <input id="active" type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="active" className="text-sm">Active</label>
        </div>
        <Button onClick={onSave} disabled={busy}>Save</Button>
      </div>
    </div>
  );
}
