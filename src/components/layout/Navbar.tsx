"use client";
// ============================================
// Top Navbar
// ============================================

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import Link from "next/link";
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from "@/lib/rbac";
import {
  Menu,
  Moon,
  Sun,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get initials for placeholder avatar
  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return user?.email ? user.email.slice(0, 2).toUpperCase() : "U";
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left: Menu toggle */}
        <button
          onClick={onMenuToggle}
          className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Center: Page breadcrumb placeholder */}
        <div className="hidden lg:block" />

        {/* Right: User info, theme toggle, logout */}
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User avatar"}
                  className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                  {getInitials()}
                </div>
              )}
              <span className="hidden sm:block text-sm font-medium text-gray-750 dark:text-gray-300 max-w-[120px] truncate">
                {user?.displayName || user?.email?.split("@")[0]}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 focus:outline-none animate-fade-in z-30">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {user?.displayName || "User"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email}
                  </p>
                  {userRole && (
                    <span
                      className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_BADGE_CLASSES[userRole]}`}
                    >
                      {ROLE_LABELS[userRole]}
                    </span>
                  )}
                </div>

                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-450" />
                  My Profile
                </Link>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-655 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4 text-red-400" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
