"use client";
import React from "react";

// This global error boundary catches client-side errors in the App Router and prevents
// the opaque "Internal Server Error" page, showing a friendlier UI with a reset option.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  return (
    <html>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 560, width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 24, background: "var(--background)", color: "var(--foreground)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 16 }}>
              The app hit an unexpected error. You can try again or go back to the dashboard.
            </p>
            {process.env.NODE_ENV !== 'production' && (
              <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.04)", padding: 12, borderRadius: 6, overflow: "auto", marginBottom: 16 }}>
                {String(error?.message || "")}
                {error?.digest ? `\n\nDigest: ${error.digest}` : ""}
              </pre>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => reset()} style={{ height: 36, padding: "0 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--muted)", cursor: "pointer" }}>Try again</button>
              <a href="/dashboard" style={{ height: 36, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", textDecoration: "none" }}>Go to Dashboard</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
