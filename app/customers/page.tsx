"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { listCustomers, updateCustomer } from "@/lib/customers";
import type { CustomerDoc } from "@/lib/models";
import Link from "next/link";

interface EditState {
  id: string | null;
  form: { name: string; phone: string; kidsDob: string };
  saving: boolean;
}

const INITIAL_EDIT_STATE: EditState = {
  id: null,
  form: { name: "", phone: "", kidsDob: "" },
  saving: false,
};

export default function CustomersPage() {
  const { user, loading, role } = useAuth();
  const [items, setItems] = useState<CustomerDoc[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditState>(INITIAL_EDIT_STATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setItems).catch(err => {
      console.error("Failed to load customers", err);
      setError("Failed to load customers");
    });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
    );
  }, [q, items]);

  const startEdit = useCallback((c: CustomerDoc) => {
    if (!c.id) return;
    setEdit({
      id: c.id,
      form: { name: c.name, phone: c.phone || "", kidsDob: c.kidsDob || "" },
      saving: false,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEdit(INITIAL_EDIT_STATE);
    setError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!edit.id) return;
    setEdit(prev => ({ ...prev, saving: true }));
    try {
      const payload = {
        name: edit.form.name.trim(),
        phone: edit.form.phone.trim() || undefined,
        kidsDob: edit.form.kidsDob || undefined,
      };
      if (!payload.name) throw new Error("Name is required");
      await updateCustomer(edit.id, payload);
      setItems(prev => prev.map(c => (c.id === edit.id ? { ...c, ...payload } : c)));
      cancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update customer";
      console.error(msg, err);
      setError(msg);
      setEdit(prev => ({ ...prev, saving: false }));
    }
  }, [edit.id, edit.form, cancelEdit]);

  if (loading) return <div className="p-6 text-center">Loading…</div>;
  // if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <div className="flex h-[100%]">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <input
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search name, phone, or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search customers"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Phone</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Kid&apos;s DOB</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Points</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {edit.id === c.id ? (
                          <input
                            className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={edit.form.name}
                            onChange={(e) => setEdit(prev => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{c.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {edit.id === c.id ? (
                          <input
                            className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={edit.form.phone}
                            onChange={(e) => setEdit(prev => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))}
                          />
                        ) : (
                          <span className="text-gray-600">{c.phone || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.email || '-'}</td>
                      <td className="px-4 py-3">
                        {edit.id === c.id ? (
                          <input
                            type="date"
                            className="h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={edit.form.kidsDob}
                            onChange={(e) => setEdit(prev => ({ ...prev, form: { ...prev.form, kidsDob: e.target.value } }))}
                          />
                        ) : (
                          <span className="text-gray-600">{c.kidsDob ? new Date(c.kidsDob).toLocaleDateString() : '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{Math.max(0, Number(c.loyaltyPoints || 0))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Link href={`/customers/${c.id}`} className="text-blue-600 hover:text-blue-700 underline">View</Link>
                          {role === "admin" && (
                            <>
                              {edit.id === c.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="text-emerald-600 hover:text-emerald-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={saveEdit}
                                    disabled={edit.saving}
                                  >
                                    {edit.saving ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-gray-500 hover:text-gray-700 underline"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-700 underline"
                                  onClick={() => startEdit(c)}
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                        {items.length === 0 ? "No customers found" : "No matching customers"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
