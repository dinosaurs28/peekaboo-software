"use client";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { COLLECTIONS, ProductDoc } from "./models";

function assertDb() {
  if (!db) throw new Error("Firestore not initialized");
}

function toProductDoc(id: string, data: any): ProductDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: data.name || "",
    sku: data.sku || "",
    barcode: data.barcode,
    category: data.category,
    hsnCode: data.hsnCode,
    unitPrice: Number(data.unitPrice ?? 0),
    costPrice: data.costPrice != null ? Number(data.costPrice) : undefined,
    stock: Number(data.stock ?? 0),
    reorderLevel: data.reorderLevel != null ? Number(data.reorderLevel) : undefined,
    taxRatePct: data.taxRatePct != null ? Number(data.taxRatePct) : undefined,
    active: Boolean(data.active ?? true),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : now,
  };
}

export async function listProducts(): Promise<ProductDoc[]> {
  assertDb();
  const col = collection(db!, COLLECTIONS.products);
  const q = query(col, orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProductDoc(d.id, d.data()));
}

export async function getProduct(id: string): Promise<ProductDoc | null> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toProductDoc(snap.id, snap.data());
}

// Low stock helpers
export async function listLowStockProducts(): Promise<ProductDoc[]> {
  const all = await listProducts();
  return all.filter((p) => p.active && (p.reorderLevel ?? 0) > 0 && p.stock <= (p.reorderLevel ?? 0));
}

export function observeLowStockProducts(cb: (items: ProductDoc[]) => void) {
  assertDb();
  const colRef = collection(db!, COLLECTIONS.products);
  const q = query(colRef, orderBy("name"));
  // Use onSnapshot to reflect changes in real time
  const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const list: ProductDoc[] = snap.docs.map((d) => toProductDoc(d.id, d.data()));
    cb(list.filter((p: ProductDoc) => p.active && (p.reorderLevel ?? 0) > 0 && p.stock <= (p.reorderLevel ?? 0)));
  });
  return unsub;
}

export type UpsertProductInput = {
  name: string;
  sku: string;
  unitPrice: number;
  stock: number;
  active: boolean;
  category?: string;
  barcode?: string;
  hsnCode?: string;
  costPrice?: number;
  reorderLevel?: number;
  taxRatePct?: number;
};

export async function createProduct(input: UpsertProductInput): Promise<string> {
  assertDb();
  const col = collection(db!, COLLECTIONS.products);
  const payload: Record<string, any> = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Remove undefined fields to please Firestore
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  const res = await addDoc(col, payload);
  return res.id;
}

export async function updateProduct(id: string, input: Partial<UpsertProductInput>): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  const payload: Record<string, any> = {
    ...input,
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  await updateDoc(ref, payload);
}

export async function deleteProduct(id: string): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  await deleteDoc(ref);
}
