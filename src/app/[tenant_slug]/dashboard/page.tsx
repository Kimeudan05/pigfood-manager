"use client";

import { useTenant } from "@/contexts/TenantContext";

export default function TenantDashboardPage() {
  const {
    tenantId,
    tenantSlug,
    businessName,
    currency,
    memberRole,
  } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {businessName || tenantSlug}
        </h1>

        <p className="text-muted-foreground">
          Tenant dashboard
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-900">
        <h2 className="font-semibold">Workspace</h2>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            <strong>Workspace:</strong> {tenantSlug}
          </p>

          <p>
            <strong>Tenant ID:</strong> {tenantId}
          </p>

          <p>
            <strong>Currency:</strong> {currency}
          </p>

          <p>
            <strong>Your role:</strong> {memberRole}
          </p>
        </div>
      </div>
    </div>
  );
}