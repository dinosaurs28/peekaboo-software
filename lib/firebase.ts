// Firebase initialization
// Fill the env vars in .env.local (see .env.local.example)
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const shouldInit = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let app: FirebaseApp | undefined;
if (shouldInit) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  } as const;
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
}

export const auth = app ? getAuth(app) : (undefined as any);
export const db = app ? getFirestore(app) : (undefined as any);
export const storage = app ? getStorage(app) : (undefined as any);
