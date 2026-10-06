// ============================================
// Multi-Tenant Invitation Service
// ============================================

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  Invitation,
  TenantDoc,
  TenantMember,
  UserRole,
} from "@/types";

// ============================================================
// PLAN LIMITS
// ============================================================

const PLAN_MEMBER_LIMITS: Record<string, number> = {
  basic: 3,
  standard: 10,
  pro: Infinity,
};

// ============================================================
// HELPERS
// ============================================================

function invitationsCollection(
  tenantId: string
) {
  return collection(
    db,
    "tenants",
    tenantId,
    "invitations"
  );
}

function invitationDoc(
  tenantId: string,
  inviteId: string
) {
  return doc(
    db,
    "tenants",
    tenantId,
    "invitations",
    inviteId
  );
}

async function countApprovedMembers(
  tenantId: string
): Promise<number> {
  const membersRef = collection(
    db,
    "tenants",
    tenantId,
    "users"
  );

  const q = query(
    membersRef,
    where("status", "==", "approved")
  );

  const snap = await getDocs(q);

  return snap.size;
}

async function getTenantPlanTier(
  tenantId: string
): Promise<string> {
  const snap = await getDoc(
    doc(db, "tenants", tenantId)
  );

  if (!snap.exists()) {
    return "basic";
  }

  const tenant =
    snap.data() as TenantDoc;

  return (
    tenant.subscription?.planTier ??
    "basic"
  );
}

// ============================================================
// CREATE
// ============================================================

export async function createInvitation(
  tenantId: string,
  email: string,
  role: UserRole,
  inviterUid: string
): Promise<string> {
  const normalizedEmail =
    email.trim().toLowerCase();

  const now = Timestamp.now();

  const expiresAt =
    Timestamp.fromMillis(
      now.toMillis() +
        48 * 60 * 60 * 1000
    );

  const invitationsRef =
    invitationsCollection(tenantId);

  // Look for an existing invitation for
  // the same tenant + email.
  const q = query(
    invitationsRef,
    where(
      "email",
      "==",
      normalizedEmail
    )
  );

  const existing =
    await getDocs(q);

  for (const existingDoc of existing.docs) {
    const existingData =
      existingDoc.data();

    const existingExpiry =
      existingData.expiresAt as
        | Timestamp
        | undefined;

    if (
      existingExpiry &&
      existingExpiry.toMillis() >
        now.toMillis()
    ) {
      await setDoc(existingDoc.ref, {
  email: normalizedEmail,
  role,
  invitedBy: inviterUid,
  expiresAt,
  updatedAt: serverTimestamp(),
});

      return existingDoc.id;
    }
  }

  const inviteRef = await addDoc(
    invitationsRef,
    {
      email: normalizedEmail,
      role,
      invitedBy: inviterUid,
      expiresAt,
      createdAt: serverTimestamp(),
    }
  );

  return inviteRef.id;
}

// ============================================================
// GET
// ============================================================

export async function getInvitation(
  tenantId: string,
  inviteId: string
): Promise<Invitation | null> {
  const snap = await getDoc(
    invitationDoc(
      tenantId,
      inviteId
    )
  );

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();

  return {
    id: snap.id,
    email: data.email,
    role: data.role as UserRole,
    invitedBy: data.invitedBy,
    expiresAt:
      data.expiresAt as Timestamp,
    tenantId,
    tenantSlug:
      data.tenantSlug ?? "",
  };
}

// ============================================================
// ACCEPT
// ============================================================

export async function acceptInvitation(
  tenantId: string,
  inviteId: string,
  uid: string,
  email: string,
  displayName: string
): Promise<{
  tenantId: string;
  tenantSlug: string;
}> {
  const inviteRef =
    invitationDoc(
      tenantId,
      inviteId
    );

  const inviteSnap =
    await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw {
      code: "EXPIRED",
    };
  }

  const inviteData =
    inviteSnap.data();

  const expiresAt =
    inviteData.expiresAt as Timestamp;

  if (
    expiresAt.toMillis() <=
    Date.now()
  ) {
    throw {
      code: "EXPIRED",
    };
  }

  const role =
    inviteData.role as UserRole;

  // Check member limit.
  const [
    approvedCount,
    planTier,
  ] = await Promise.all([
    countApprovedMembers(
      tenantId
    ),
    getTenantPlanTier(
      tenantId
    ),
  ]);

  const limit =
    PLAN_MEMBER_LIMITS[
      planTier
    ] ?? 3;

  if (approvedCount >= limit) {
    throw {
      code: "MEMBER_LIMIT_REACHED",
    };
  }

  const tenantRef = doc(
    db,
    "tenants",
    tenantId
  );

  const tenantSnap =
    await getDoc(tenantRef);

  if (!tenantSnap.exists()) {
    throw {
      code: "TENANT_NOT_FOUND",
    };
  }

  const tenant =
    tenantSnap.data() as TenantDoc;

  const memberRef = doc(
    db,
    "tenants",
    tenantId,
    "users",
    uid
  );

  const globalUserRef =
    doc(db, "users", uid);

  const batch =
    writeBatch(db);

  const memberData: Omit<
    TenantMember,
    | "permissions"
    | "adminMessage"
    | "adminNote"
  > = {
    uid,
    email,
    displayName,
    photoURL: "",
    role,
    status: "approved",
    createdAt:
      serverTimestamp() as unknown as Timestamp,
  };

  batch.set(
    memberRef,
    memberData,
    {
      merge: true,
    }
  );

  // Global profile.
  batch.set(
    globalUserRef,
    {
      uid,
      email,
      displayName,
      photoURL: "",
    },
    {
      merge: true,
    }
  );

  // Invitation belongs to this tenant.
  batch.delete(inviteRef);

  await batch.commit();

  return {
    tenantId,
    tenantSlug:
      tenant.slug,
  };
}

// ============================================================
// DELETE
// ============================================================

export async function deleteInvitation(
  tenantId: string,
  inviteId: string
): Promise<void> {
  await deleteDoc(
    invitationDoc(
      tenantId,
      inviteId
    )
  );
}

// ============================================================
// LIST TENANT INVITATIONS
// ============================================================

export async function getTenantInvitations(
  tenantId: string
): Promise<Invitation[]> {
  const snap = await getDocs(
    invitationsCollection(
      tenantId
    )
  );

  return snap.docs.map((d) => {
    const data = d.data();

    return {
      id: d.id,
      email: data.email,
      role: data.role as UserRole,
      invitedBy: data.invitedBy,
      expiresAt:
        data.expiresAt as Timestamp,
      tenantId,
      tenantSlug:
        data.tenantSlug ?? "",
    };
  });
}