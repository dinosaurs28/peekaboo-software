"use client";
import React, { useEffect, useState } from "react";
import { ensureSyncStarted, listOps, processQueue } from "@/lib/offline";

export function OfflineQueueStarter() {
  const [pending, setPending] = useState<number>(0);
  useEffect(() => {
    ensureSyncStarted();
    // Register service worker only in production or when explicitly enabled
    const enableSw = process.env.NEXT_PUBLIC_ENABLE_SW === '1' || process.env.NODE_ENV === 'production';
    if (enableSw && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { });
    }
    let mounted = true;
    async function poll() {
      try {
        const ops = await listOps();
        if (!mounted) return;
        setPending(ops.length);
      } catch { }
    }
    poll();
    const iv = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  useEffect(() => {
    if (navigator.onLine) processQueue().catch(() => undefined);
  }, []);
  return (
    <div aria-hidden className="fixed bottom-3 left-3 text-xs opacity-70">Offline queue: {pending}</div>
  );
}
