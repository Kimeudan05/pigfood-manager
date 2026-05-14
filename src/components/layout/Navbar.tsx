"use client";
// ============================================
// Top Navbar
// ============================================

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Menu,
  Moon,
  Sun,
  LogOut,
  User,
} from "lucide-react";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* User email */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
              {user?.email}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
