"use client";
// ============================================
// Toast Notification Display
// ============================================

import React from "react";
import { useToast } from "@/contexts/ToastContext";
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from "lucide-react";

const icons = {
  success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  error: <AlertCircle className="h-5 w-5 text-red-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  info: <Info className="h-5 w-5 text-blue-400" />,
};

const bgColors = {
  success: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800",
  error: "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800",
  warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800",
  info: "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${bgColors[toast.type]} animate-in slide-in-from-right duration-300`}
        >
          {icons[toast.type]}
          <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
