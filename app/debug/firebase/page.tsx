"use client";
import React from "react";
import { firebaseStatus } from "@/lib/firebase";

export default function FirebaseDebugPage() {
  const status = firebaseStatus();
  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Firebase Debug</h1>
      <p style={{ marginTop: 8 }}>
        Initialized: <strong>{String(status.initialized)}</strong>
        {" "}
        | shouldInit: <strong>{String(status.shouldInit)}</strong>
        {" "}
        | getAppsCount: <strong>{status.getAppsCount}</strong>
      </p>
      {status.missingEnv.length > 0 && (
        <div style={{ marginTop: 8, color: "#b91c1c" }}>
          Missing envs: {status.missingEnv.join(", ")}
        </div>
      )}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Env presence</h2>
          <pre style={{ marginTop: 8, background: "#0b1021", color: "#e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(status.env, null, 2)}
          </pre>
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Masked values</h2>
          <pre style={{ marginTop: 8, background: "#0b1021", color: "#e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(status.masked, null, 2)}
          </pre>
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Raw status</h2>
          <pre style={{ marginTop: 8, background: "#0b1021", color: "#e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>
      </div>
      <p style={{ marginTop: 12, color: "#6b7280" }}>
        Tip: If Initialized is false, verify .env.local matches your Firebase Web App config exactly. Restart the dev server after changes.
      </p>
    </div>
  );
}
