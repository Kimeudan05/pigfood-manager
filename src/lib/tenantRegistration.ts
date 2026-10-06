// ============================================
// StockSight — Tenant Registration Service
// Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9
// ============================================

import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { validateSlug, validatePassword } from "@/lib/validators";

// ---------- Reserved Slugs ----------
// These slugs correspond to top-level routes and must not be used as tenant slugs.
// Task 16.4 will extract this to src/lib/reservedSlugs.ts; for now it lives inline.
const RESERVED_SLUGS = [
  "login",
  "register",
  "workspace-picker",
  "invite",
  "api",
  "admin",
  "billing",
  "magic-link",
  "forgot-password",
  "pending-approval",
  "suspended",
];

/**
 * Returns `true` when `slug` matches one of the platform-reserved route names.
 * Case-insensitive to guard against trivial bypasses.
 */
function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

// ---------- checkSlugAvailable ----------

/**
 * Returns `true` when `slug` is both syntactically valid AND not yet claimed by
 * any existing tenant document.
 *
 * Returns `false` when:
 *  - `isReservedSlug(slug)` is true (platform-reserved name)
 *  - A document already exists in the `tenants` collection with the same `slug`
 *
 * Requirements: 1.3, 10.1
 */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (isReservedSlug(slug)) return false;

  const q = query(collection(db, "tenants"), where("slug", "==", slug));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

// ---------- registerTenant ----------

export interface RegisterTenantPayload {
  businessName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface RegisterTenantResult {
  tenantId: string;
  slug: string;
}

/**
 * Creates a new tenant workspace.
 *
 * Flow:
 *  1. Validate slug (format) — throws `{ code: 'INVALID_SLUG' }` on failure
 *  2. Validate password (complexity) — throws `{ code: 'INVALID_PASSWORD' }` on failure
 *  3. Check slug availability — throws `{ code: 'SLUG_TAKEN' }` if taken
 *  4. Create Firebase Auth account
 *  5. Update Auth profile (displayName = ownerName)
 *  6. Atomically write tenant doc + membership doc + global user profile
 *  7. On batch failure: delete the Auth account and throw `{ code: 'FIRESTORE_FAILED' }`
 *
 * Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9
 */
export async function registerTenant(
  payload: RegisterTenantPayload
): Promise<RegisterTenantResult> {
  const { businessName, slug, ownerName, email, password } = payload;

  // Step 1 — validate slug format
  if (!validateSlug(slug)) {
    throw { code: "INVALID_SLUG" };
  }

  // Step 2 — validate password complexity
  if (!validatePassword(password)) {
    throw { code: "INVALID_PASSWORD" };
  }

  // Step 3 — check slug availability (reserved + Firestore uniqueness)
  const available = await checkSlugAvailable(slug);
  if (!available) {
    throw { code: "SLUG_TAKEN" };
  }

  // Step 4 — create Firebase Auth account
  // Firebase Auth itself will throw with code 'auth/email-already-in-use' if the
  // email is taken — callers handle this upstream (Req 1.7).
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = userCredential;
  const uid = user.uid;

  // Step 5 — update Auth profile
  await updateProfile(user, { displayName: ownerName });

  // Step 6 — atomic Firestore write
  // tenantId is derived from a new doc ref so Firestore generates the ID.
  const tenantRef = doc(collection(db, "tenants"));
  const tenantId = tenantRef.id;
  const memberRef = doc(db, "tenants", tenantId, "users", uid);
  const globalUserRef = doc(db, "users", uid);

  const batch = writeBatch(db);

  // Tenant document (Req 1.4, 3.1)
  batch.set(tenantRef, {
    slug,
    businessName,
    currency: "KES",
    timezone: "Africa/Nairobi",
    createdAt: serverTimestamp(),
    createdBy: uid,
  });

  // Per-tenant membership document (Req 1.4, 6.1)
  batch.set(memberRef, {
    uid,
    email: user.email,
    displayName: ownerName,
    photoURL: "",
    role: "owner",
    status: "approved",
    createdAt: serverTimestamp(),
  });

  // Global user profile (used by workspace-picker collectionGroup query)
  batch.set(globalUserRef, {
    uid,
    email: user.email,
    displayName: ownerName,
    photoURL: "",
    role: "owner",
    status: "approved",
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch {
    // Req 1.9 — roll back by deleting the Auth account, then surface the error
    await deleteUser(user);
    throw {
      code: "FIRESTORE_FAILED",
      message: "Registration failed. Please try again.",
    };
  }

  return { tenantId, slug };
}
