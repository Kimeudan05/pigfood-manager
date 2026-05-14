"use client";
// ============================================
// Client Providers Wrapper
// ============================================
// Wraps the app with all necessary context providers.
// Separated into its own file since providers need "use client".

import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ToastContainer from "@/components/ui/ToastContainer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          {children}
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
