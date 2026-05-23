import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatNumber,
  truncate,
  toDate,
  checkIsToday,
  checkIsThisMonth,
  getTodayRange,
  getMonthRange,
} from "../formatters";

describe("Formatters Utility", () => {
  describe("formatCurrency", () => {
    it("should format amounts to KES currency format", () => {
      expect(formatCurrency(1000)).toBe("KES 1,000");
      expect(formatCurrency(0)).toBe("KES 0");
      expect(formatCurrency(1234567.89)).toBe("KES 1,234,567.89");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with commas in Kenyan format style", () => {
      expect(formatNumber(12500)).toBe("12,500");
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("truncate", () => {
    it("should truncate text exceeding maximum length and append ellipsis", () => {
      expect(truncate("Short string", 20)).toBe("Short string");
      expect(truncate("This is a very long string that should be cut off", 10)).toBe("This is a ...");
    });

    it("should use default maxLength of 30 if not provided", () => {
      const longStr = "A".repeat(40);
      expect(truncate(longStr)).toHaveLength(33); // 30 chars + "..."
      expect(truncate("A".repeat(20))).toHaveLength(20);
    });
  });

  describe("toDate", () => {
    it("should convert Timestamp to JS Date", () => {
      const date = new Date(2026, 4, 23, 12, 0, 0);
      const seconds = Math.floor(date.getTime() / 1000);
      const timestamp = new Timestamp(seconds, 0);

      const result = toDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(date.getTime());
    });

    it("should pass through JS Date directly", () => {
      const date = new Date();
      expect(toDate(date)).toBe(date);
    });

    it("should return current date if parameter is empty", () => {
      expect(toDate(undefined)).toBeInstanceOf(Date);
      expect(toDate(null)).toBeInstanceOf(Date);
    });
  });

  describe("formatDate and formatDateTime", () => {
    it("should return N/A for null or undefined dates", () => {
      expect(formatDate(null)).toBe("N/A");
      expect(formatDate(undefined)).toBe("N/A");
    });

    it("should format Date objects using custom format", () => {
      const date = new Date(2026, 4, 23, 15, 30, 0); // May 23, 2026 15:30
      expect(formatDate(date, "yyyy-MM-dd")).toBe("2026-05-23");
    });

    it("should format Timestamps properly", () => {
      const date = new Date(2026, 4, 23, 15, 30, 0);
      const timestamp = Timestamp.fromDate(date);
      expect(formatDate(timestamp, "yyyy-MM-dd")).toBe("2026-05-23");
      expect(formatDateTime(timestamp)).toBe("May 23, 2026 15:30");
    });
  });

  describe("checkIsToday", () => {
    it("should correctly identify today", () => {
      const today = new Date();
      expect(checkIsToday(today)).toBe(true);
    });

    it("should return false for other dates", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(checkIsToday(yesterday)).toBe(false);
    });
  });

  describe("checkIsThisMonth", () => {
    it("should correctly check current month", () => {
      const today = new Date();
      expect(checkIsThisMonth(today)).toBe(true);
    });
  });

  describe("Range generators", () => {
    it("should generate proper range for today", () => {
      const [start, end] = getTodayRange();
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });

    it("should generate proper range for this month", () => {
      const [start, end] = getMonthRange();
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start.getDate()).toBe(1);
    });
  });
});
