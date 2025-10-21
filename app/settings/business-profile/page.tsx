"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { SettingsDoc } from "@/lib/models";

type FormState = Partial<Pick<SettingsDoc,
  | "businessName" | "addressLine1" | "addressLine2" | "city" | "state" | "pinCode"
  | "gstin" | "phone" | "email" | "logoUrl" | "receiptFooterNote" | "invoicePrefix"
>> & { currency?: string; taxInclusive?: boolean };

export default function BusinessProfileSettingsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const ref = doc(db, 'Settings', 'app');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<SettingsDoc>;
        setForm({
          businessName: data.businessName ?? "",
          addressLine1: data.addressLine1 ?? "",
          addressLine2: data.addressLine2 ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          pinCode: data.pinCode ?? "",
          gstin: data.gstin ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          logoUrl: data.logoUrl ?? "",
          receiptFooterNote: data.receiptFooterNote ?? "",
          invoicePrefix: data.invoicePrefix ?? "INV",
          currency: data.currency ?? "INR",
          taxInclusive: data.taxInclusive ?? true,
        });
      } else {
        setForm({ businessName: '', currency: 'INR', taxInclusive: true });
      }
    })();
  }, []);

  const update = (k: keyof FormState, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!db) return;
    if (!isAdmin) return;
    setSaving(true);
    try {
      const ref = doc(db, 'Settings', 'app');
      const payload: Partial<SettingsDoc> = {
        businessName: form.businessName || '',
        currency: form.currency || 'INR',
        taxInclusive: form.taxInclusive ?? true,
        addressLine1: form.addressLine1 || '',
        addressLine2: form.addressLine2 || '',
        city: form.city || '',
        state: form.state || '',
        pinCode: form.pinCode || '',
        gstin: form.gstin || '',
        phone: form.phone || '',
        email: form.email || '',
        logoUrl: form.logoUrl || '',
        receiptFooterNote: form.receiptFooterNote || '',
        invoicePrefix: form.invoicePrefix || 'INV',
        updatedAt: new Date().toISOString(),
      } as any;
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Business Profile</h1>
      {!isAdmin && (
        <div className="text-sm text-red-600">You have read-only access. Ask an admin to update business profile.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span>Business Name</span>
          <input className="border rounded px-2 py-1" value={form.businessName || ''} onChange={e => update('businessName', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>GSTIN</span>
          <input className="border rounded px-2 py-1" value={form.gstin || ''} onChange={e => update('gstin', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Address Line 1</span>
          <input className="border rounded px-2 py-1" value={form.addressLine1 || ''} onChange={e => update('addressLine1', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Address Line 2</span>
          <input className="border rounded px-2 py-1" value={form.addressLine2 || ''} onChange={e => update('addressLine2', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>City</span>
          <input className="border rounded px-2 py-1" value={form.city || ''} onChange={e => update('city', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>State</span>
          <input className="border rounded px-2 py-1" value={form.state || ''} onChange={e => update('state', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>PIN Code</span>
          <input className="border rounded px-2 py-1" value={form.pinCode || ''} onChange={e => update('pinCode', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Phone</span>
          <input className="border rounded px-2 py-1" value={form.phone || ''} onChange={e => update('phone', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Email</span>
          <input className="border rounded px-2 py-1" value={form.email || ''} onChange={e => update('email', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Logo URL (optional)</span>
          <input className="border rounded px-2 py-1" value={form.logoUrl || ''} onChange={e => update('logoUrl', e.target.value)} disabled={!isAdmin} placeholder="https://..." />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Receipt Footer Note (optional)</span>
          <input className="border rounded px-2 py-1" value={form.receiptFooterNote || ''} onChange={e => update('receiptFooterNote', e.target.value)} disabled={!isAdmin} placeholder="Thank you for shopping with us!" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Invoice Prefix</span>
          <input className="border rounded px-2 py-1" value={form.invoicePrefix || 'INV'} onChange={e => update('invoicePrefix', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Currency</span>
          <input className="border rounded px-2 py-1" value={form.currency || 'INR'} onChange={e => update('currency', e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={!!form.taxInclusive} onChange={e => update('taxInclusive', e.target.checked)} disabled={!isAdmin} />
          <span>Prices include tax</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onSave} disabled={!isAdmin || saving}>Save</button>
      </div>
    </div>
  );
}
