"use client";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { COLLECTIONS, UserDoc, UserRole } from "./models";

// Sign in existing user
export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Create user (admin-only operation should be guarded in UI and security rules)
export interface CreateUserAccountParams {
  email: string;
  password: string;
  displayName?: string;
  role?: UserRole;
}

export async function createUserAccount(params: CreateUserAccountParams) {
  const { email, password, displayName, role = "cashier" } = params;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await ensureUserDocument(cred.user, role);
  return cred.user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export function listenToAuthState(cb: (user: FirebaseUser | null) => void) {
  const unsub = onAuthStateChanged(auth, (u) => cb(u));
  return unsub;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const ref = doc(db, COLLECTIONS.users, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UserDoc> & Record<string, unknown>;
  return {
    id: snap.id,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    authUid: snap.id,
    email: data.email ?? '',
    displayName: data.displayName as string | undefined,
    role: (data.role as UserRole | undefined) ?? 'cashier',
    active: data.active ?? true,
    lastLoginAt: data.lastLoginAt as string | undefined,
  } satisfies UserDoc;
}

export async function ensureUserDocument(user: FirebaseUser, role: UserRole = "cashier") {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const now = new Date().toISOString();
    const docData: Omit<UserDoc, "id"> = {
      authUid: user.uid,
      email: user.email || "",
      displayName: user.displayName || undefined,
      role,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    await setDoc(ref, { ...docData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastLoginAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const docData = await getUserDoc(uid);
  return docData?.role || null;
}
