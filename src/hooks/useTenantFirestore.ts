"use client";

import { useTenant } from "@/contexts/TenantContext";
import {
  tenantCollection,
  tenantDoc,
  tenantSaleRef,
  tenantSaleLinesCollection,
} from "@/lib/firestore";

export function useTenantFirestore() {
  const { tenantId, tenantSlug } = useTenant();

  return {
    tenantId,
    tenantSlug,

    /**
     * tenants/{tenantId}/{collection}
     */
    getCollectionRef: (name: string) =>
      tenantCollection(tenantId, name),

    /**
     * tenants/{tenantId}/{collection}/{id}
     */
    getDocRef: (
      collectionName: string,
      id: string
    ) =>
      tenantDoc(
        tenantId,
        collectionName,
        id
      ),

    /**
     * tenants/{tenantId}/sales/{saleId}
     */
    getSaleRef: (saleId: string) =>
      tenantSaleRef(
        tenantId,
        saleId
      ),

    /**
     * tenants/{tenantId}/sales/{saleId}/saleLines
     */
    getSaleLinesRef: (saleId: string) =>
      tenantSaleLinesCollection(
        tenantId,
        saleId
      ),
  };
}