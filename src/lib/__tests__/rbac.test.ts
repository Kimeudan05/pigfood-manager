import { describe, it, expect } from "vitest";
import { can, ROLE_LABELS, ROLE_BADGE_CLASSES } from "../rbac";

describe("Role-Based Access Control (RBAC)", () => {
  describe("can helper function", () => {
    it("should allow owners to perform all actions", () => {
      expect(can("owner", "manageUsers")).toBe(true);
      expect(can("owner", "deleteRecords")).toBe(true);
      expect(can("owner", "viewReports")).toBe(true);
      expect(can("owner", "createRecords")).toBe(true);
      expect(can("owner", "editRecords")).toBe(true);
    });

    it("should restrict admin from managing other users, but allow other actions", () => {
      expect(can("admin", "manageUsers")).toBe(false);
      expect(can("admin", "deleteRecords")).toBe(true);
      expect(can("admin", "viewReports")).toBe(true);
      expect(can("admin", "createRecords")).toBe(true);
      expect(can("admin", "editRecords")).toBe(true);
    });

    it("should restrict staff to only creating records", () => {
      expect(can("staff", "manageUsers")).toBe(false);
      expect(can("staff", "deleteRecords")).toBe(false);
      expect(can("staff", "viewReports")).toBe(false);
      expect(can("staff", "createRecords")).toBe(true);
      expect(can("staff", "editRecords")).toBe(false);
    });

    it("should safely deny permissions for null or undefined roles", () => {
      expect(can(null, "createRecords")).toBe(false);
      expect(can(undefined, "viewReports")).toBe(false);
    });
  });

  describe("Role Config maps", () => {
    it("should contain definitions for all user roles", () => {
      const roles = ["owner", "admin", "staff"] as const;

      roles.forEach((role) => {
        expect(ROLE_LABELS[role]).toBeDefined();
        expect(ROLE_BADGE_CLASSES[role]).toBeDefined();
        expect(typeof ROLE_LABELS[role]).toBe("string");
        expect(typeof ROLE_BADGE_CLASSES[role]).toBe("string");
      });
    });
  });
});
