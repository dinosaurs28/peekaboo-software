"use client";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, getDocs, getDoc, serverTimestamp, query, where, orderBy, type DocumentData } from "firebase/firestore";
import type { OfferDoc } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

function asString(v: unknown, d = ""): string { return typeof v === 'string' ? v : d; }
function asBool(v: unknown, d = false): boolean { return typeof v === 'boolean' ? v : d; }
function asNum(v: unknown, d = 0): number { const n = Number(v); return Number.isFinite(n) ? n : d; }

export function toOfferDoc(id: string, data: Record<string, unknown>): OfferDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: asString(data.name),
    description: typeof data.description === 'string' ? data.description : undefined,
    active: asBool(data.active, false),
    startsAt: typeof data.startsAt === 'string' ? data.startsAt : undefined,
    endsAt: typeof data.endsAt === 'string' ? data.endsAt : undefined,
    discountType: data.discountType === 'percentage' || data.discountType === 'amount' ? data.discountType : undefined,
    discountValue: data.discountValue != null ? asNum(data.discountValue) : undefined,
    productIds: Array.isArray(data.productIds) ? (data.productIds as unknown[]).filter(x => typeof x === 'string') as string[] : undefined,
    categoryNames: Array.isArray(data.categoryNames) ? (data.categoryNames as unknown[]).filter(x => typeof x === 'string') as string[] : undefined,
    ruleType: data.ruleType === 'flat' || data.ruleType === 'percentage' || data.ruleType === 'bogoSameItem' ? data.ruleType : undefined,
    buyQty: data.buyQty != null ? asNum(data.buyQty) : undefined,
    getQty: data.getQty != null ? asNum(data.getQty) : undefined,
    dobMonthOnly: typeof data.dobMonthOnly === 'boolean' ? data.dobMonthOnly : undefined,
    eventName: typeof data.eventName === 'string' ? data.eventName : undefined,
    priority: data.priority != null ? asNum(data.priority) : undefined,
    exclusive: typeof data.exclusive === 'boolean' ? data.exclusive : undefined,
    createdAt: asString(data.createdAt, now),
    updatedAt: asString(data.updatedAt, now),
  };
}

export async function listOffers(): Promise<OfferDoc[]> {
  if (!db) return [];
  const col = collection(db, COLLECTIONS.offers);
  const qy = query(col, orderBy('name'));
  const snap = await getDocs(qy);
  return snap.docs.map(d => toOfferDoc(d.id, d.data() as DocumentData as Record<string, unknown>));
}

export async function createOffer(input: Partial<OfferDoc>): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');
  const col = collection(db, COLLECTIONS.offers);
  const payload: Record<string, unknown> = { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  Object.keys(payload).forEach(k => (payload as Record<string, unknown>)[k] === undefined && delete (payload as Record<string, unknown>)[k]);
  const res = await addDoc(col, payload);
  return res.id;
}

export async function updateOffer(id: string, input: Partial<OfferDoc>): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  const ref = doc(db, COLLECTIONS.offers, id);
  const payload: Record<string, unknown> = { ...input, updatedAt: serverTimestamp() };
  Object.keys(payload).forEach(k => (payload as Record<string, unknown>)[k] === undefined && delete (payload as Record<string, unknown>)[k]);
  await updateDoc(ref, payload);
}

export async function listActiveOffers(nowIso: string = new Date().toISOString()): Promise<OfferDoc[]> {
  // Try to filter by active flag on server; date windows are checked client-side too
  const all = await listOffers();
  return all.filter(o => {
    if (!o.active) return false;
    if (o.startsAt && nowIso < o.startsAt) return false;
    if (o.endsAt && nowIso > o.endsAt) return false;
    return true;
  });
}
