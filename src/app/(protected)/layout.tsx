"use client";
// ============================================
// Protected Layout
// ============================================
// Wraps all authenticated routes with sidebar + navbar.
// Redirects to login if user is not authenticated.
// Redirects to /pending-approval if account is not yet approved.

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { PageSpinner } from "@/components/ui/Spinner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, userStatus, loading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // collapsed on mobile by default

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Redirect to pending-approval if account not yet approved
  useEffect(() => {
    if (!loading && user && userStatus === "pending") {
      router.replace("/pending-approval");
    }
  }, [user, userStatus, loading, router]);

  // Show spinner while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageSpinner />
      </div>
    );
  }

  // Don't render protected content if not authenticated or pending
  if (!user || userStatus === "pending") return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileClose={() => setSidebarCollapsed(true)}
      />

      {/* Main content area - shifts right based on sidebar */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
        }`}
      >
        {/* Top navbar */}
        <Navbar onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

