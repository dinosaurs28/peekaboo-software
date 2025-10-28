"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { SettingsDoc } from "@/lib/models";

type FormState = Partial<Pick<SettingsDoc,
  | "receiptPaperWidthMm"
  | "autoPrintReceipt"
  | "showTaxLine"
  | "googleReviewUrl"
  | "showReviewLink"
  | "receiptFooterNote"
>>;

export default function ReceiptTemplateSettingsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isAdmin = role === "admin";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const ref = doc(db, "Settings", "app");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<SettingsDoc>;
        setForm({
          receiptPaperWidthMm: data.receiptPaperWidthMm ?? 80,
          autoPrintReceipt: data.autoPrintReceipt ?? true,
          showTaxLine: data.showTaxLine ?? true,
          googleReviewUrl: data.googleReviewUrl ?? "",
          showReviewLink: data.showReviewLink ?? false,
          receiptFooterNote: data.receiptFooterNote ?? "",
        });
      } else {
        setForm({ receiptPaperWidthMm: 80, autoPrintReceipt: true, showTaxLine: true, showReviewLink: false });
      }
    })();
  }, []);

  const update = (k: keyof FormState, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!db || !isAdmin) return;
    setSaving(true);
    try {
      const ref = doc(db, "Settings", "app");
      const payload: Partial<SettingsDoc> = {
        receiptPaperWidthMm: Number(form.receiptPaperWidthMm) || 80,
        autoPrintReceipt: !!form.autoPrintReceipt,
        showTaxLine: !!form.showTaxLine,
        googleReviewUrl: form.googleReviewUrl || "",
        showReviewLink: !!form.showReviewLink,
        receiptFooterNote: form.receiptFooterNote || "",
        updatedAt: new Date().toISOString(),
      } as any;
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Receipt Template</h1>
      {!isAdmin && (
        <div className="text-sm text-red-600">You have read-only access. Ask an admin to update receipt settings.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span>Paper Width (mm)</span>
          <input
            type="number"
            className="border rounded px-2 py-1"
            min={40}
            max={120}
            step={1}
            value={form.receiptPaperWidthMm ?? 80}
            onChange={(e) => update("receiptPaperWidthMm", Number(e.target.value))}
            disabled={!isAdmin}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!form.autoPrintReceipt}
            onChange={(e) => update("autoPrintReceipt", e.target.checked)}
            disabled={!isAdmin}
          />
          <span>Auto-print after checkout</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!form.showTaxLine}
            onChange={(e) => update("showTaxLine", e.target.checked)}
            disabled={!isAdmin}
          />
          <span>Show GST line</span>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Receipt Footer Note</span>
          <input
            className="border rounded px-2 py-1"
            value={form.receiptFooterNote || ""}
            onChange={(e) => update("receiptFooterNote", e.target.value)}
            disabled={!isAdmin}
            placeholder="Thank you for shopping with us!"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Google Review URL (optional)</span>
          <input
            className="border rounded px-2 py-1"
            value={form.googleReviewUrl || ""}
            onChange={(e) => update("googleReviewUrl", e.target.value)}
            disabled={!isAdmin}
            placeholder="https://g.page/r/..."
          />
        </label>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={!!form.showReviewLink}
            onChange={(e) => update("showReviewLink", e.target.checked)}
            disabled={!isAdmin}
          />
          <span>Show review link on receipt</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onSave} disabled={!isAdmin || saving}>
          Save
        </button>
      </div>
    </div>
  );
}
