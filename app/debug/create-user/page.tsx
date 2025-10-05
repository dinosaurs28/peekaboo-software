"use client";
import React, { useState } from "react";
import { createUserAccount } from "@/lib/auth";
import { UserRole } from "@/lib/models";

export default function CreateUserDebugPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) {
      setMsg("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const user = await createUserAccount({ email, password, displayName, role });
      setMsg(`Created user ${user.email} (uid: ${user.uid}). You are now signed in.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui", maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Create User (Debug)</h1>
      <p style={{ marginTop: 6, color: "#6b7280" }}>
        Dev-only helper to seed an account. Enable Email/Password in Firebase Console → Authentication first. Remove this page before production.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Display name (optional)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} type="text" placeholder="Jane Doe" style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="admin">admin</option>
            <option value="cashier">cashier</option>
          </select>
        </label>
        <button disabled={loading} type="submit" style={{ padding: "8px 12px", background: "#111827", color: "white", borderRadius: 6 }}>
          {loading ? "Creating..." : "Create user"}
        </button>
      </form>
      {msg && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fef3c7", color: "#92400e" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
