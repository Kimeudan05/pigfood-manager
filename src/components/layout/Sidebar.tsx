"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalTenant } from "@/contexts/TenantContext";
import { canDo } from "@/lib/rbac";
import { isSubscriptionActive } from "@/lib/billing";

import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  BarChart3,
  PlusCircle,
  ChevronLeft,
  Leaf,
  User,
  ShieldCheck,
  TrendingUp,
  Truck,
  Activity,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { userRole, appUser } = useAuth();
  const tenant = useOptionalTenant();

  const isTenantRoute = !!tenant;

  const isAdmin = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  const subExpired =
    !isOwner && !isSubscriptionActive(appUser?.subscription);

  /**
   * When we are inside /[tenant_slug], every migrated
   * navigation item must remain inside that workspace.
   *
   * For now only Dashboard has been migrated.
   * The remaining modules continue using their existing
   * routes until we migrate them properly.
   */
  const tenantPath = (path: string) => {
    if (!tenant?.tenantSlug) {
      return path;
    }

    return `/${tenant.tenantSlug}${path}`;
  };

  const dashboardHref = isTenantRoute
    ? tenantPath("/dashboard")
    : "/dashboard";

  const allNavItems = [
    {
      href: dashboardHref,
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
    },

    {
      href: isTenantRoute ? tenantPath("/customers") : "/customers",
      label: "Customers",
      icon: Users,
      show: canDo(appUser, "canViewCustomers"),
    },

    {
      href: isTenantRoute ? tenantPath("/sales") : "/sales",
      label: "Sales",
      icon: ShoppingCart,
      show: canDo(appUser, "canViewSales"),
    },

    {
      href: isTenantRoute ? tenantPath("/sales/new") : "/sales/new",
      label: "New Sale",
      icon: PlusCircle,
      show: canDo(appUser, "canAddSale"),
    },

    {
      href: isTenantRoute ? tenantPath("/receivals") : "/receivals",
      label: "Receivals",
      icon: Truck,
      show:
        canDo(appUser, "canViewSales") ||
        canDo(appUser, "canViewReports"),
    },

    {
      href: isTenantRoute
        ? tenantPath("/reports/customer-spending")
        : "/reports/customer-spending",
      label: "Customer Spending",
      icon: TrendingUp,
      show: canDo(appUser, "canViewReports"),
    },

    {
      href: isTenantRoute
        ? tenantPath("/reports/advanced")
        : "/reports/advanced",
      label: "Advanced Analysis",
      icon: Activity,
      show: canDo(appUser, "canViewReports"),
    },

    {
      href: isTenantRoute ? tenantPath("/reports") : "/reports",
      label: "Reports",
      icon: BarChart3,
      show: canDo(appUser, "canViewReports"),
    },

    {
      href: isTenantRoute ? tenantPath("/profile") : "/profile",
      label: "Profile",
      icon: User,
      show: true,
    },

    {
      href: isTenantRoute ? tenantPath("/billing") : "/billing",
      label: "Billing",
      icon: CreditCard,
      show: true,
      badge: subExpired,
    },
  ];

  const navItems = allNavItems.filter((item) => item.show);

  const isActive = (href: string) => {
    if (href === dashboardHref) {
      return pathname === href;
    }

    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          !collapsed
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onMobileClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 text-white transition-all duration-300 ease-in-out flex flex-col
          ${
            collapsed
              ? "-translate-x-full lg:translate-x-0 lg:w-20"
              : "translate-x-0 w-72 lg:w-72"
          }
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-emerald-700/50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/50 backdrop-blur-sm">
            <Leaf className="h-6 w-6 text-emerald-300" />
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              collapsed
                ? "lg:w-0 lg:opacity-0"
                : "w-auto opacity-100"
            }`}
          >
            <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
              {tenant?.businessName || "Takataka"}
            </h1>

            <p className="text-xs text-emerald-300/70 whitespace-nowrap">
              Pigfood Manager
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                title={item.label}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/15 text-white shadow-lg shadow-emerald-900/20"
                    : "text-emerald-100/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    active
                      ? "text-emerald-300"
                      : "text-emerald-400/60 group-hover:text-emerald-300"
                  }`}
                />

                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    collapsed
                      ? "lg:w-0 lg:opacity-0"
                      : "w-auto opacity-100"
                  }`}
                >
                  {item.label}
                </span>

                {(item as any).badge && (
                  <span
                    className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 ${
                      collapsed ? "lg:hidden" : ""
                    }`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-900" />
                  </span>
                )}

                {active && !(item as any).badge && (
                  <div
                    className={`ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 ${
                      collapsed ? "lg:hidden" : ""
                    }`}
                  />
                )}

                {/* Tooltip */}
                <span
                  className={`pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block ${
                    collapsed ? "" : "lg:hidden"
                  }`}
                >
                  {item.label}
                  {(item as any).badge ? " ⚠️" : ""}
                </span>
              </Link>
            );
          })}

          {/* Admin */}
          {isAdmin &&
            (() => {
              const adminHref = isTenantRoute
                ? tenantPath("/admin")
                : "/admin/users";

              const active = pathname.startsWith(adminHref);

              return (
                <Link
                  href={adminHref}
                  onClick={onMobileClose}
                  title="Admin"
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 mt-1 ${
                    active
                      ? "bg-white/15 text-white shadow-lg shadow-emerald-900/20"
                      : "text-emerald-100/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ShieldCheck
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      active
                        ? "text-amber-300"
                        : "text-emerald-400/60 group-hover:text-amber-300"
                    }`}
                  />

                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                      collapsed
                        ? "lg:w-0 lg:opacity-0"
                        : "w-auto opacity-100"
                    }`}
                  >
                    Admin
                  </span>

                  {active && (
                    <div
                      className={`ml-auto h-2 w-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 ${
                        collapsed ? "lg:hidden" : ""
                      }`}
                    />
                  )}

                  <span
                    className={`pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block ${
                      collapsed ? "" : "lg:hidden"
                    }`}
                  >
                    Admin Panel
                  </span>
                </Link>
              );
            })()}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:block border-t border-emerald-700/50 p-3">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-emerald-300/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform duration-300 ${
                collapsed ? "rotate-180" : ""
              }`}
            />

            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                collapsed
                  ? "w-0 opacity-0"
                  : "w-auto opacity-100"
              }`}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}