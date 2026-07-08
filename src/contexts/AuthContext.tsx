"use client";
// ============================================
// Authentication Context
// ============================================
// Provides auth state, sign-in methods, and role-based access.
// Supports: email/password, Google OAuth, magic link, password reset.
// Auto-logout after 30 minutes of inactivity.
// On first sign-in, creates a Firestore user document (role = 'owner'
// if they are the very first user, otherwise 'staff').

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { UserRole, AppUser, UserStatus } from "@/types";
import { sendNewUserNotification } from "@/lib/emailjs";

// ── Magic link redirect URL ──────────────────────────────────────────────────
// Must be whitelisted in Firebase Console → Authentication → Authorized domains
export const MAGIC_LINK_REDIRECT_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/magic-link`
    : "http://localhost:3000/magic-link";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  userRole: UserRole | null;
  userStatus: UserStatus | null;
  loading: boolean;
  // Email / password
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Google
  signInWithGoogle: () => Promise<void>;
  // Magic link
  sendMagicLink: (email: string) => Promise<void>;
  completeMagicLinkSignIn: (email: string) => Promise<void>;
  // Password
  sendPasswordReset: (email: string) => Promise<void>;
  // Profile
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 30 minutes inactivity timeout
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

// ── Firestore helpers ────────────────────────────────────────────────────────

const usersRef = collection(db, "users");

/** Load or create the Firestore user document and return the full AppUser. */
async function ensureUserDoc(user: User): Promise<AppUser> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    // Back-fill status for legacy accounts that pre-date the approval flow
    if (!data.status) {
      const ref2 = doc(db, "users", user.uid);
      try { await import("firebase/firestore").then(({ updateDoc }) => updateDoc(ref2, { status: "approved" })); } catch { /* best-effort */ }
      return { uid: snap.id, ...data, status: "approved" } as AppUser;
    }
    return { uid: snap.id, ...data } as AppUser;
  }

  // Determine role: first user ever gets 'owner', everyone else gets 'viewer'
  let role: UserRole = "viewer";
  let status: UserStatus = "pending";
  try {
    const allUsers = await getDocs(usersRef);
    if (allUsers.empty) { role = "owner"; status = "approved"; }
  } catch {
    role = "viewer";
    status = "pending";
  }

  const newUser: Omit<AppUser, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? "",
    role,
    status,
    createdAt: serverTimestamp() as never,
  };

  await setDoc(ref, newUser);

  // Notify admin of new registration (fire-and-forget)
  if (status === "pending") {
    sendNewUserNotification(user.email ?? "unknown").catch(() => {});
  }

  return { ...newUser, createdAt: new Date() as never } as unknown as AppUser;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Session tracking refs
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastSessionUpdateAtRef = useRef<number>(0);

  // ── Inactivity auto-logout ──────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await signOut(auth);
      router.push("/login");
    }, INACTIVITY_TIMEOUT);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    const handle = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handle));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handle));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetInactivityTimer]);

  // ── Session update heartbeat ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      if (sessionIdRef.current && sessionStartTimeRef.current) {
        // Only update if there has been activity since the last update
        if (lastActivityAtRef.current > lastSessionUpdateAtRef.current) {
          try {
            const { updateUserSession } = await import("@/lib/firestore");
            await updateUserSession(sessionIdRef.current, sessionStartTimeRef.current);
            lastSessionUpdateAtRef.current = Date.now();
          } catch (err) {
            console.error("Failed to update user session", err);
          }
        }
      }
    }, 60 * 1000); // 1 minute
    return () => clearInterval(interval);
  }, [user]);

  // ── Auth state listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const au = await ensureUserDoc(firebaseUser);
        setUser(firebaseUser);
        setAppUser(au);
        setUserRole(au.role);
        setUserStatus(au.status ?? "approved");

        // Start session if not started
        if (!sessionIdRef.current) {
          try {
            const { startUserSession } = await import("@/lib/firestore");
            const sid = await startUserSession(
              firebaseUser.uid,
              firebaseUser.email,
              firebaseUser.displayName,
              firebaseUser.photoURL
            );
            sessionIdRef.current = sid;
            sessionStartTimeRef.current = Date.now();
            lastSessionUpdateAtRef.current = Date.now();
          } catch (err) {
            console.error("Failed to start user session", err);
          }
        }
      } else {
        setUser(null);
        setAppUser(null);
        setUserRole(null);
        setUserStatus(null);
        sessionIdRef.current = null;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Real-time listener for own user doc (picks up role/permission changes) ─
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const updated = { uid: snap.id, ...snap.data() } as AppUser;
        setAppUser(updated);
        setUserRole(updated.role);
        setUserStatus(updated.status ?? "approved");
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // ── Auth methods ────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    router.push("/login");
  };

  // Google OAuth
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  // Magic link — step 1: send the email
  const sendMagicLink = async (email: string) => {
    const actionCodeSettings = {
      url: MAGIC_LINK_REDIRECT_URL,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Save email so the handler page can retrieve it without asking again
    window.localStorage.setItem("emailForSignIn", email);
  };

  // Magic link — step 2: complete sign-in on the redirect page
  const completeMagicLinkSignIn = async (email: string) => {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      throw new Error("Invalid magic link");
    }
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem("emailForSignIn");
  };

  // Forgot password
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Profile update
  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await updateProfile(auth.currentUser, {
      displayName,
      ...(photoURL !== undefined ? { photoURL } : {}),
    });
    // Sync to Firestore
    const ref = doc(db, "users", auth.currentUser.uid);
    await setDoc(
      ref,
      { displayName, ...(photoURL !== undefined ? { photoURL } : {}) },
      { merge: true }
    );
    // Force re-render by refreshing current user
    setUser({ ...auth.currentUser });
  };

  // Change password (requires re-authentication)
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser?.email) throw new Error("Not authenticated");
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        userRole,
        userStatus,
        loading,
        login,
        register,
        logout,
        signInWithGoogle,
        sendMagicLink,
        completeMagicLinkSignIn,
        sendPasswordReset,
        updateUserProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access auth context */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
