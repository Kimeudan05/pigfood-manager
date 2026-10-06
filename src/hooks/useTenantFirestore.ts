// ============================================
// useTenantFirestore Hook
// ============================================
// Pulls `tenantId` from TenantContext and returns pre-bound helpers so
// callsites never need to pass `tenantId` explicitly.
//
// The hook is intentionally minimal at this stage. Tenant-scoped service
// functions (customers, sales, products, receivals, etc.) will be bound
// here as they are refactored in Tasks 6.x.

import { collectionRef } from "@/contexts/TenantContext";
import { useTenant } from "@/contexts/TenantContext";
import type { CollectionReference } from "firebase/firestore";

export function useTenantFirestore() {
  const { tenantId } = useTenant();

  /**
   * Returns a CollectionReference scoped to this tenant.
   * Path: `tenants/{tenantId}/{name}`
   *
   * Example:
   *   const salesRef = getCollectionRef("sales");
   */
  function getCollectionRef(name: string): CollectionReference {
    return collectionRef(tenantId, name);
  }

  return {
    tenantId,
    getCollectionRef,
  };
}
