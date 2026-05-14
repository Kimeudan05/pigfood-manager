// ============================================
// Formatting Utilities
// ============================================

import { Timestamp } from "firebase/firestore";
import { format, isToday, isThisWeek, isThisMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

/** Format a Firestore timestamp or Date to readable string */
export function formatDate(date: Timestamp | Date | undefined | null, fmt: string = "MMM dd, yyyy"): string {
  if (!date) return "N/A";
  const d = date instanceof Timestamp ? date.toDate() : date;
  return format(d, fmt);
}

/** Format date with time */
export function formatDateTime(date: Timestamp | Date | undefined | null): string {
  return formatDate(date, "MMM dd, yyyy HH:mm");
}

/** Format currency (KES) */
export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

/** Format number with commas */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-KE");
}

/** Convert Firestore Timestamp to JS Date safely */
export function toDate(date: Timestamp | Date | undefined | null): Date {
  if (!date) return new Date();
  return date instanceof Timestamp ? date.toDate() : date;
}

/** Check if a date is today */
export function checkIsToday(date: Timestamp | Date): boolean {
  return isToday(toDate(date));
}

/** Check if a date is this week */
export function checkIsThisWeek(date: Timestamp | Date): boolean {
  return isThisWeek(toDate(date), { weekStartsOn: 1 });
}

/** Check if a date is this month */
export function checkIsThisMonth(date: Timestamp | Date): boolean {
  return isThisMonth(toDate(date));
}

/** Get start and end of today */
export function getTodayRange(): [Date, Date] {
  const now = new Date();
  return [startOfDay(now), endOfDay(now)];
}

/** Get start and end of this week */
export function getWeekRange(): [Date, Date] {
  const now = new Date();
  return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })];
}

/** Get start and end of this month */
export function getMonthRange(): [Date, Date] {
  const now = new Date();
  return [startOfMonth(now), endOfMonth(now)];
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
