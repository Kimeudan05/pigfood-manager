"use client";

import React from "react";
import { TenantProvider } from "@/contexts/TenantContext";
import ProtectedLayout from "../(protected)/layout";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </TenantProvider>
  );
}