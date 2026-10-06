// ============================================
// Invitation Service
// ============================================
// Handles invite creation, lookup, acceptance, and deletion.
// Invitations are stored in a top-level `invitations/{inviteId}` collection
// for easy lookup by ID. The `tenantId` field in each doc ties it back to
// the correct tenant sub-collection.
// ============================================

import {
  serverTimestamp,
  Timestamp,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invitation, UserRole, TenantMember, TenantDoc } from "@/types";

// ---------- Plan member limits ----------
// Based on Requirement 6.8: basic ≤ 3, standard ≤ 10, pro = unlimited
const PLAN_MEMBER_LIMITS: Record<string, number> = {
  basic: 3,
  standard: 10,
  pro: Infinity,
};

// ---------- Helpers ----------

/**
 * Returns the number of approved members in a tenant.
 */
async function countApprovedMembers(tenantId: string): Promise<number> {
  const membersRef = collection(db, "tenants", tenantId, "users");
  const q = query(membersRef, where("status", "==", "approved"));
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Resolves the plan tier for a tenant by reading its subscription field.
 * Defaults to "basic" if no subscription is present.
 */
async function getTenantPlanTier(tenantId: string): Promise<string> {
  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) return "basic";
  const data = tenantSnap.data() as TenantDoc;
  return data.subscription?.planTier ?? "basic";
}

// ============================================
// createInvitation
// ============================================

/**
 * Creates (or overwrites) an invitation for a given email address within a tenant.
 *
 * - If an unexpired invitation already exists for this email in the tenant,
 *   it is overwritten in-place (same doc ID) with a fresh 48 h expiry.
 * - Otherwise a new document is created via `addDoc`.
 *
 * Invitations are stored in the top-level `invitations` collection so they can
 * be loaded by ID alone (e.g. from an invite link) without knowing `tenantId`.
 *
 * @returns The inviteId of the created/updated invitation document.
 */
export async function createInvitation(
  tenantId: string,
  email: string,
  role: UserRole,
  inviterUid: string
): Promise<string> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 48 * 60 * 60 * 1000);

  const invitationData = {
    email,
    role,
    invitedBy: inviterUid,
    expiresAt,
    tenantId,
  };

  // Check for an existing unexpired invite for this email in this tenant.
  const invitationsRef = collection(db, "invitations");
  const q = query(
    invitationsRef,
    where("tenantId", "==", tenantId),
    where("email", "==", email)
  );
  const existing = await getDocs(q);

  // Find any unexpired document
  let existingDocId: string | null = null;
  existing.forEach((snap) => {
    const data = snap.data();
    const expires = data.expiresAt as Timestamp;
    if (expires && expires.toMillis() > now.toMillis()) {
      existingDocId = snap.id;
    }
  });

  if (existingDocId) {
    // Overwrite in-place with a new expiry (same ID)
    await setDoc(doc(db, "invitations", existingDocId), invitationData);
    return existingDocId;
  }

  // Create a fresh document
  const newDoc = await addDoc(invitationsRef, invitationData);
  return newDoc.id;
}

// ============================================
// getInvitation
// ============================================

/**
 * Reads an invitation document from the top-level `invitations` collection by ID.
 * Returns null if the document does not exist.
 */
export async function getInvitation(inviteId: string): Promise<Invitation | null> {
  const inviteRef = doc(db, "invitations", inviteId);
  const snap = await getDoc(inviteRef);

  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    id: snap.id,
    email: data.email,
    role: data.role as UserRole,
    invitedBy: data.invitedBy,
    expiresAt: data.expiresAt as Timestamp,
    tenantId: data.tenantId,
    tenantSlug: data.tenantSlug ?? "",
  } satisfies Invitation;
}

// ============================================
// acceptInvitation
// ============================================

/**
 * Accepts an invitation and adds the user as a member of the tenant.
 *
 * Checks:
 * 1. Invitation exists and has not expired — throws `{ code: 'EXPIRED' }` if expired.
 * 2. Tenant is not at its plan member limit — throws `{ code: 'MEMBER_LIMIT_REACHED' }` if at limit.
 *
 * Uses a batch write to:
 * - Add the user to `tenants/{tenantId}/users/{uid}` with status `approved`.
 * - Ensure a global `users/{uid}` profile doc exists (merge: true).
 * - Delete `invitations/{inviteId}`.
 *
 * @returns `{ tenantId, tenantSlug }` for post-acceptance redirect.
 */
export async function acceptInvitation(
  inviteId: string,
  uid: string,
  email: string,
  displayName: string
): Promise<{ tenantId: string; tenantSlug: string }> {
  // 1. Load the invitation
  const inviteRef = doc(db, "invitations", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw { code: "EXPIRED" };
  }

  const inviteData = inviteSnap.data();
  const expiresAt = inviteData.expiresAt as Timestamp;
  const now = Timestamp.now();

  if (expiresAt.toMillis() <= now.toMillis()) {
    throw { code: "EXPIRED" };
  }

  const { tenantId, role } = inviteData as { tenantId: string; role: UserRole };

  // 2. Check plan member limit
  const [approvedCount, planTier] = await Promise.all([
    countApprovedMembers(tenantId),
    getTenantPlanTier(tenantId),
  ]);

  const limit = PLAN_MEMBER_LIMITS[planTier] ?? 3;
  if (approvedCount >= limit) {
    throw { code: "MEMBER_LIMIT_REACHED" };
  }

  // 3. Batch write: add member doc + ensure global profile + delete invite
  const batch = writeBatch(db);

  // Add to tenant members sub-collection
  const memberRef = doc(db, "tenants", tenantId, "users", uid);
  const memberData: Omit<TenantMember, "permissions" | "adminMessage" | "adminNote"> = {
    uid,
    email,
    displayName,
    photoURL: "",
    role,
    status: "approved",
    createdAt: serverTimestamp() as unknown as Timestamp,
  };
  batch.set(memberRef, memberData);

  // Ensure global users/{uid} profile exists (merge so existing fields are kept)
  const globalProfileRef = doc(db, "users", uid);
  batch.set(
    globalProfileRef,
    {
      uid,
      email,
      displayName,
      photoURL: "",
    },
    { merge: true }
  );

  // Delete the invitation
  batch.delete(inviteRef);

  await batch.commit();

  // 4. Load the tenant doc to get the slug
  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  const tenantSlug: string =
    tenantSnap.exists() ? (tenantSnap.data() as TenantDoc).slug : "";

  return { tenantId, tenantSlug };
}

// ============================================
// deleteInvitation
// ============================================

/**
 * Deletes an invitation document from the top-level `invitations` collection.
 */
export async function deleteInvitation(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, "invitations", inviteId));
}
