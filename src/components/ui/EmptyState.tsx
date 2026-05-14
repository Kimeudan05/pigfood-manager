"use client";

import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 rounded-full bg-emerald-50 p-4 dark:bg-emerald-900/30">
        {icon || <Inbox className="h-10 w-10 text-emerald-400" />}
      </div>
      <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {action}
    </div>
  );
}
