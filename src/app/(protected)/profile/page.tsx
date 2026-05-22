"use client";
// ============================================
// User Profile Page
// ============================================
// Allows users to update their profile info, change passwords (if password-based),
// view their account role/permissions, and manage their authentication connections.

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from "@/lib/rbac";
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Calendar,
  Clock,
  Trash2,
  Lock,
  UserCheck,
  CheckCircle,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner";

export default function ProfilePage() {
  const { user, userRole, updateUserProfile, changePassword } = useAuth();
  const { addToast } = useToast();

  // Profile update form state
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Danger zone confirm
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!user) return null;

  // Determine provider connections
  const providers = user.providerData.map((p) => p.providerId);
  const isGoogleConnected = providers.includes("google.com");
  const isPasswordConnected = providers.includes("password");

  // Get initials for placeholder avatar
  const getInitials = () => {
    if (user.displayName) {
      return user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return user.email ? user.email.slice(0, 2).toUpperCase() : "U";
  };

  // Format dates safely
  const formatAuthDate = (dateStr: string | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      addToast("warning", "Display name cannot be empty");
      return;
    }

    setProfileLoading(true);
    try {
      await updateUserProfile(displayName.trim());
      addToast("success", "Profile updated successfully!");
    } catch {
      addToast("error", "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast("warning", "Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      addToast("error", "New password must be at least 6 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast("success", "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const error = err as { code?: string };
      if (error.code === "auth/wrong-password") {
        addToast("error", "Incorrect current password");
      } else {
        addToast("error", err.message || "Failed to change password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirm !== "DELETE MY ACCOUNT") {
      addToast("warning", "Please type the exact phrase to confirm");
      return;
    }
    addToast("info", "Account deletion is disabled for safety in this version.");
    setDeleteConfirm("");
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your personal details, credentials, and check your security status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Summary Card */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 flex flex-col items-center text-center shadow-sm">
            {/* Avatar */}
            <div className="relative group mb-4">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User Avatar"}
                  className="h-24 w-24 rounded-full object-cover border-4 border-emerald-500/20"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-3xl flex items-center justify-center border-4 border-emerald-500/20 shadow-inner">
                  {getInitials()}
                </div>
              )}
            </div>

            {/* User Meta */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {user.displayName || "Pigfood Manager User"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>

            {/* Role Badge */}
            <div className="mt-4">
              {userRole && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE_CLASSES[userRole]}`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {ROLE_LABELS[userRole]}
                </span>
              )}
            </div>

            {/* Metadata Section */}
            <div className="w-full border-t border-gray-100 dark:border-gray-700/50 mt-6 pt-6 text-left space-y-3.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  Created
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-200">
                  {formatAuthDate(user.metadata.creationTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  Last Login
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-200">
                  {formatAuthDate(user.metadata.lastSignInTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Provider Card */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Connected Accounts</h3>
            <div className="space-y-4">
              {/* Email Provider */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Password / Email</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Log in with credentials</p>
                  </div>
                </div>
                {isPasswordConnected ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Linked
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs font-medium">Unlinked</span>
                )}
              </div>

              {/* Google Provider */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Google OAuth</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">One-tap sign-in</p>
                  </div>
                </div>
                {isGoogleConnected ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Linked
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs font-medium">Unlinked</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns — Action Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Personal Details */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Personal Details
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Update your account displayName.
            </p>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email Address (Read Only)
                </label>
                <input
                  type="email"
                  value={user.email || ""}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 py-2.5 px-4 text-sm text-gray-500 cursor-not-allowed transition-all"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-emerald-700/35 disabled:opacity-50 transition-all"
                >
                  {profileLoading ? <Spinner size="sm" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Security & Password */}
          {isPasswordConnected ? (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Change Password
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Update your login credentials. We recommend a strong, unique password.
              </p>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-600/25 hover:bg-amber-700 hover:shadow-amber-700/35 disabled:opacity-50 transition-all"
                  >
                    {passwordLoading ? <Spinner size="sm" /> : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 shadow-sm flex flex-col items-center text-center">
              <KeyRound className="h-10 w-10 text-emerald-500/80 mb-3" />
              <h3 className="font-bold text-gray-900 dark:text-white">Social Sign-In Account</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                You are currently logged in with a Google account. Standard password management is disabled. You can log in instantly with your Google account.
              </p>
            </div>
          )}

          {/* Card 3: Danger Zone */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-red-200/60 dark:border-red-900/30 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Actions in this section are irreversible. Proceed with extreme caution.
            </p>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border border-red-300 dark:border-red-800 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="space-y-4 animate-fade-in">
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 dark:bg-red-950/20 dark:border-red-900/30">
                  <p className="text-sm text-red-800 dark:text-red-400 font-semibold mb-1">
                    Are you absolutely sure?
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400/85">
                    Deleting your account will delete all associated data. To confirm, please type{" "}
                    <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded font-bold">
                      DELETE MY ACCOUNT
                    </code>{" "}
                    below.
                  </p>
                </div>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type the confirmation phrase"
                  className="w-full rounded-xl border border-red-300 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-red-800 dark:bg-gray-700 dark:text-white transition-all"
                  required
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirm("");
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    Permanently Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
