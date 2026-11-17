import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import type { Firestore } from "firebase/firestore";

const environment = import.meta.env ?? {};
const requiredConfig = {
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(requiredConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

// Demo values let local builds render without network calls. Cloud actions are
// only enabled when every required VITE_FIREBASE_* value is configured.
const firebaseConfig = isFirebaseConfigured
  ? {
      ...requiredConfig,
      firestoreDatabaseId: environment.VITE_FIREBASE_DATABASE_ID || undefined,
    }
  : {
      apiKey: "demo-api-key",
      authDomain: "demo.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:demo",
    };

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
let database: Promise<Firestore> | undefined;
export function getDatabase(): Promise<Firestore> {
  return (database ??= import("firebase/firestore").then(({ getFirestore }) =>
    getFirestore(app, environment.VITE_FIREBASE_DATABASE_ID || "(default)"),
  ));
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function observeAuth(callback: (user: User | null) => void) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured)
    throw new Error(
      "Firebase is not configured. Add the VITE_FIREBASE_* values to .env.",
    );
  const result = await signInWithPopup(auth, googleProvider);
  const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
  await setDoc(
    doc(await getDatabase(), "users", result.user.uid),
    {
      uid: result.user.uid,
      email: result.user.email ?? "",
      displayName: result.user.displayName ?? "",
      photoURL: result.user.photoURL ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return result.user;
}

export function signOutUser() {
  return signOut(auth);
}

export type { User };
