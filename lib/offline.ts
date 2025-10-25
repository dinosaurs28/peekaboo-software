"use client";
// Simple IndexedDB-backed offline operation queue
// Keeps operations in order and retries when online.

import { checkoutCart } from "./pos";
import { performExchange } from "./exchange";
import { receiveStock } from "./pos";
import { COLLECTIONS } from "./models";

export type OfflineOpType = "checkout" | "exchange" | "receive";
export type OfflineOp = {
  id: string;
  type: OfflineOpType;
  payload: any;
  createdAt: string;
  attempts?: number;
};

const DB_NAME = "peekaboo_offline_v1";
const STORE_NAME = "ops";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOp(op: OfflineOp): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOps(): Promise<OfflineOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as OfflineOp[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOp(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOp(id: string): Promise<OfflineOp | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as OfflineOp) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function processOpById(id: string): Promise<boolean> {
  const op = await getOp(id);
  if (!op) return false;
  try {
    if (op.type === 'checkout') {
      await checkoutCart(op.payload);
    } else if (op.type === 'exchange') {
      await performExchange(op.payload);
    } else if (op.type === 'receive') {
      await receiveStock(op.payload);
    }
    await removeOp(op.id);
    return true;
  } catch (err) {
    // Increment attempts
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const updated: OfflineOp = { ...op, attempts: (op.attempts || 0) + 1 };
      store.put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.error('processOpById failed', id, err);
    return false;
  }
}

let running = false;
export async function processQueue(onProgress?: (left: number) => void): Promise<void> {
  if (running) return;
  running = true;
  try {
    const ops = (await listOps()).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    for (const op of ops) {
      if (!navigator.onLine) break; // stop if offline again
      try {
        if (onProgress) onProgress(ops.length);
        if (op.type === 'checkout') {
          // payload should match CheckoutInput
          await checkoutCart(op.payload);
        } else if (op.type === 'exchange') {
          await performExchange(op.payload);
        } else if (op.type === 'receive') {
          await receiveStock(op.payload);
        }
        await removeOp(op.id);
      } catch (err) {
        // If a permanent error, skip and leave in queue for manual review. Otherwise retry on next sync.
        console.error('Offline op failed, will retry later', op.id, err);
        // increment attempts count
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const recReq = store.get(op.id);
        recReq.onsuccess = () => {
          const existing = recReq.result as OfflineOp | undefined;
          if (existing) {
            existing.attempts = (existing.attempts || 0) + 1;
            store.put(existing);
          }
        };
        await new Promise((res) => (tx.oncomplete = res));
        // break to avoid hammering
        break;
      }
    }
  } finally {
    running = false;
  }
}

let started = false;
export function ensureSyncStarted() {
  if (started) return;
  started = true;
  function tryProcess() {
    // Only process if online and user is likely authenticated (best-effort: wait a tick to allow Auth init)
    if (!navigator.onLine) return;
    setTimeout(() => processQueue().catch((e) => console.error('processQueue failed', e)), 250);
  }
  window.addEventListener('online', tryProcess);
  // attempt an initial sync when we start if online
  tryProcess();
}
