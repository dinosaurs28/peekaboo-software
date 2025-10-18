"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCategory, updateCategory } from "@/lib/categories";
import { useParams } from "next/navigation";

export default function EditCategoryPage() {
  const { user, role, loading } = useAuth();
  const p = useParams();
  const id = Array.isArray(p?.id) ? p!.id[0] : (p?.id as string);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) { getCategory(id).then(c => { if (c) { setName(c.name); setCode(c.code); setDescription(c.description || ""); setActive(!!c.active); } }); } }, [id]);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;
  async function onSave() {
    if (!name || !code) { alert('Name and Code required'); return; }
    setBusy(true);
    try {
      await updateCategory(id!, { name, code, description: description || undefined, active });
      window.location.href = "/settings/categories";
    } catch (e) {
      alert(String(e));
    } finally { setBusy(false); }
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings/categories"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Edit Category</h1>
        <div />
      </div>
      <div className="border rounded-md p-4 space-y-3 max-w-xl">
        <div>
          <label className="text-sm">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Code</label>
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
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
