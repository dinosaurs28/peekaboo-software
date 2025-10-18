"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";

export default function CategoriesPage() {
  const { user, role, loading } = useAuth();
  const [items, setItems] = useState<CategoryDoc[]>([]);
  useEffect(() => { listCategories().then(setItems).catch(() => undefined); }, []);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Categories</h1>
        <Link href="/settings/categories/new"><Button size="sm">New</Button></Link>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.code}</td>
                <td className="px-3 py-2">{c.active ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2"><Link href={`/settings/categories/${c.id}`}><Button variant="outline" size="sm">Edit</Button></Link></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>No categories</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
