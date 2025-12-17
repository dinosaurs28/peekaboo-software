"use client";
import React, { useState } from "react";
import { createUserAccount } from "@/lib/auth";
import { UserRole } from "@/lib/models";

const STYLES = {
  container: { padding: 20, fontFamily: "ui-sans-serif, system-ui", maxWidth: 560 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backLink: { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, textDecoration: 'none', color: '#111827' },
  title: { fontSize: 20, fontWeight: 600 },
  subtitle: { marginTop: 6, color: "#6b7280" },
  form: { display: "grid", gap: 12, marginTop: 16 },
  label: { display: "grid", gap: 6 },
  input: { padding: 8, border: "1px solid #d1d5db", borderRadius: 6 },
  button: { padding: "8px 12px", background: "#111827", color: "white", borderRadius: 6, cursor: "pointer" },
  message: { marginTop: 12, padding: 10, borderRadius: 8, background: "#fef3c7", color: "#92400e" },
};

export default function CreateUserDebugPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
  };

  return (
    <div style={STYLES.container}>
      <div style={STYLES.header}>
        <a href="/debug/firebase" style={STYLES.backLink}>← Back</a>
        <h1 style={STYLES.title}>Create User (Debug)</h1>
        <span />
      </div>
      
      <p style={STYLES.subtitle}>
        Dev-only helper to seed an account. Enable Email/Password in Firebase Console → Authentication first. Remove this page before production.
      </p>
      
      <form onSubmit={handleSubmit} style={STYLES.form}>
        <label style={STYLES.label}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={STYLES.input} />
        </label>
        
        <label style={STYLES.label}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={STYLES.input} />
        </label>
        
        <label style={STYLES.label}>
          <span>Display name (optional)</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" style={STYLES.input} />
        </label>
        
        <label style={STYLES.label}>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={STYLES.input}>
            <option value="admin">admin</option>
            <option value="cashier">cashier</option>
          </select>
        </label>
        
        <button disabled={loading} type="submit" style={STYLES.button}>
          {loading ? "Creating..." : "Create user"}
        </button>
      </form>
      
      {msg && <div style={STYLES.message}>{msg}</div>}
    </div>
  );
}
