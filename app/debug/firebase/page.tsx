"use client";
import { firebaseStatus } from "@/lib/firebase";

export default function FirebaseDebugPage() {
  const status = firebaseStatus();
  const { initialized, shouldInit, getAppsCount, missingEnv, env, masked } = status;

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Firebase Debug</h1>
      <p style={{ marginTop: 8 }}>
        Initialized: <strong>{String(initialized)}</strong> | 
        shouldInit: <strong>{String(shouldInit)}</strong> | 
        getAppsCount: <strong>{getAppsCount}</strong>
      </p>
      {missingEnv.length > 0 && (
        <div style={{ marginTop: 8, color: "#b91c1c" }}>
          Missing envs: {missingEnv.join(", ")}
        </div>
      )}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {renderSection("Env presence", env)}
        {renderSection("Masked values", masked)}
        {renderSection("Raw status", status)}
      </div>
      <p style={{ marginTop: 12, color: "#6b7280" }}>
        Tip: If Initialized is false, verify .env.local matches your Firebase Web App config exactly. Restart the dev server after changes.
      </p>
    </div>
  );
}

function renderSection(title: string, data: any) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
      <pre style={{ marginTop: 8, background: "#0b1021", color: "#e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
