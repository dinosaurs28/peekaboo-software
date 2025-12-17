"use client";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import type { CustomerDoc } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

function assertDb() {
  if (!db) throw new Error("Firestore not initialized");
}

function toCustomerDoc(id: string, data: Record<string, unknown>): CustomerDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    phone: typeof data.phone === "string" ? data.phone : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    kidsDob: typeof data.kidsDob === "string" ? data.kidsDob : undefined,
    active: typeof data.active === "boolean" ? data.active : true,

    gstin:
      typeof data.gstin === "string" ? data.gstin.toUpperCase() : undefined,

    loyaltyPoints:
      typeof data.loyaltyPoints === "number" ? data.loyaltyPoints : undefined,
    totalSpend:
      typeof data.totalSpend === "number" ? data.totalSpend : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : now,
  };
}

export async function findCustomerByPhone(
  phone: string
): Promise<CustomerDoc | null> {
  if (!db) return null;
  const col = collection(db, COLLECTIONS.customers);
  const qy = query(col, where("phone", "==", phone), limit(1));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toCustomerDoc(d.id, d.data() as Record<string, unknown>);
}

export async function listCustomers(): Promise<CustomerDoc[]> {
  if (!db) return [];
  const col = collection(db, COLLECTIONS.customers);
  const qy = query(col, orderBy("name"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) =>
    toCustomerDoc(d.id, d.data() as Record<string, unknown>)
  );
}

export type UpsertCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  kidsDob?: string;
  active?: boolean;
  gstin?: string;
  loyaltyPoints?: number;
  totalSpend?: number;
};

export async function createCustomer(
  input: UpsertCustomerInput
): Promise<string> {
  assertDb();
  const col = collection(db!, COLLECTIONS.customers);
  const payload: Record<string, unknown> = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach(
    (k) => payload[k] === undefined && delete payload[k]
  );
  const res = await addDoc(col, payload);
  return res.id;
}

export async function updateCustomer(
  id: string,
  input: Partial<UpsertCustomerInput>
): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.customers, id);
  const payload: Record<string, unknown> = {
    ...input,
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach(
    (k) => payload[k] === undefined && delete payload[k]
  );
  await updateDoc(ref, payload);
}

export async function getCustomer(id: string): Promise<CustomerDoc | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTIONS.customers, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toCustomerDoc(snap.id, snap.data() as Record<string, unknown>);
}
