"use client";
// ============================================
// Tenant Context
// ============================================
// Resolves the current tenant from the URL slug, loads membership +
// tenant settings, and exposes them to all tenant-scoped pages.
//
// Resolution flow:
//   1. Read `tenant_slug` from useParams() ([tenant_slug] segment)
//   2. Query `tenants` collection where slug == tenant_slug → tenantId
//   3. onSnapshot `tenants/{tenantId}/users/{uid}` — membership + role
//      (real-time so suspension propagates within ~5 s)
//   4. getDoc `tenants/{tenantId}` — settings + subscription (one-time)
//   5. Redirect rules:
//      - tenant not found           → /workspace-picker (toast)
//      - not a member               → /workspace-picker (toast)
//      - status === 'suspended'     → /suspended
//      - status === 'pending'       → /pending-approval

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  CollectionReference,
  DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { canAccessTenantPlan } from "@/lib/billing";
import { PageSpinner } from "@/components/ui/Spinner";
import {
  TenantContextType,
  TenantSubscription,
  UserRole,
  UserStatus,
  GranularPermissions,
  PlanTier,
  TenantDoc,
  TenantMember,
} from "@/types";

// ── Context ───────────────────────────────────────────────────────────────────

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ── Exported path-building utilities ─────────────────────────────────────────

/**
 * Returns a CollectionReference for a sub-collection inside a tenant document.
 * Path: `tenants/{tenantId}/{name}`
 */
export function collectionRef(
  tenantId: string,
  name: string
): CollectionReference {
  return collection(db, "tenants", tenantId, name);
}

/**
 * Returns a DocumentReference for the tenant root document.
 * Path: `tenants/{tenantId}`
 */
export function tenantDocRef(tenantId: string): DocumentReference {
  return doc(db, "tenants", tenantId);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();

  // The slug comes from the [tenant_slug] dynamic segment
  const tenantSlug = (params?.tenant_slug as string) ?? "";

  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<Omit<TenantContextType, "loading" | "canAccess"> | null>(null);

  // Track the active onSnapshot unsubscribe function
  const unsubMemberRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Reset state whenever the slug or user changes
    setLoading(true);
    setCtx(null);

    // Clean up any previous membership listener
    if (unsubMemberRef.current) {
      unsubMemberRef.current();
      unsubMemberRef.current = null;
    }

    if (!tenantSlug || !user) {
      // No slug (shouldn't happen in a [tenant_slug] layout) or not authed
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        // ── Step 1: Resolve tenantId from slug ────────────────────────────
        const tenantsQ = query(
          collection(db, "tenants"),
          where("slug", "==", tenantSlug)
        );
        const tenantSnap = await getDocs(tenantsQ);

        if (cancelled) return;

        if (tenantSnap.empty) {
          addToast("error", `Workspace "${tenantSlug}" not found.`);
          router.replace("/workspace-picker");
          setLoading(false);
          return;
        }

        const tenantDoc = tenantSnap.docs[0];
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data() as TenantDoc;

        // ── Step 2: Attach real-time membership listener ──────────────────
        const memberRef = doc(db, "tenants", tenantId, "users", user!.uid);

        // First-pass: do a one-time read for the tenant doc while the
        // snapshot listener is being set up.
        const tenantFullSnap = await getDoc(tenantDocRef(tenantId));
        if (cancelled) return;

        const tenantFull = tenantFullSnap.exists()
          ? (tenantFullSnap.data() as TenantDoc)
          : tenantData;

        const subscription: TenantSubscription | null =
          tenantFull.subscription ?? null;

        // ── Step 3: Real-time membership listener ─────────────────────────
        unsubMemberRef.current = onSnapshot(memberRef, (snap) => {
          if (cancelled) return;

          if (!snap.exists()) {
            // Not a member of this tenant
            addToast("error", "You do not have access to this workspace.");
            router.replace("/workspace-picker");
            setLoading(false);
            return;
          }

          const member = snap.data() as TenantMember;

          // Status-based redirects
          if (member.status === "suspended") {
            router.replace("/suspended");
            setLoading(false);
            return;
          }

          if (member.status === "pending") {
            router.replace("/pending-approval");
            setLoading(false);
            return;
          }

          if (member.status === "rejected") {
            addToast("error", "Your access to this workspace has been rejected.");
            router.replace("/workspace-picker");
            setLoading(false);
            return;
          }

          // Member is approved — build context value
          setCtx({
            tenantId,
            tenantSlug,
            businessName: tenantFull.businessName ?? tenantData.businessName ?? "",
            logoURL: tenantFull.logoURL ?? null,
            currency: tenantFull.currency ?? "KES",
            timezone: tenantFull.timezone ?? "Africa/Nairobi",
            subscription,
            memberRole: member.role,
            memberStatus: member.status,
            memberPermissions: member.permissions ?? {},
          });

          setLoading(false);
        });
      } catch (err) {
        if (cancelled) return;
        console.error("TenantContext: resolution failed", err);
        addToast("error", "Failed to load workspace. Please try again.");
        router.replace("/workspace-picker");
        setLoading(false);
      }
    }

    resolve();

    return () => {
      cancelled = true;
      if (unsubMemberRef.current) {
        unsubMemberRef.current();
        unsubMemberRef.current = null;
      }
    };
  }, [tenantSlug, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show full-page spinner while resolving
  if (loading) {
    return <PageSpinner />;
  }

  // While redirecting, render nothing to avoid flash of wrong content
  if (!ctx) {
    return null;
  }

  const canAccess = (tier: PlanTier): boolean =>
    canAccessTenantPlan(ctx.subscription, tier);

  const value: TenantContextType = {
    ...ctx,
    loading,
    canAccess,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current tenant context. Must be used within a TenantProvider.
 * Throws if called outside the provider.
 */
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/**
 * Optional tenant hook.
 *
 * Returns the current tenant when the component is rendered
 * inside a TenantProvider, otherwise returns null.
 *
 * This is useful for shared components such as Sidebar/Navbar
 * that are rendered by both legacy protected routes and
 * tenant-scoped routes.
 */
export function useOptionalTenant(): TenantContextType | null {
  return useContext(TenantContext) ?? null;
}
