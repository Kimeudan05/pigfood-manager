// ============================================
// StockSight — Pure-function validators
// ============================================

// ---------- Slug ----------

/**
 * Returns `true` when `slug` satisfies the tenant-slug format rules (Req 1.6, 10.1).
 *
 * Valid: only lowercase letters (a-z), digits (0-9), and hyphens; 3–30 characters;
 * must not start or end with a hyphen.
 */
export function validateSlug(slug: string): boolean {
  if (typeof slug !== "string") return false;
  // Length guard keeps the regex anchors simple
  if (slug.length < 3 || slug.length > 30) return false;
  // No leading or trailing hyphen
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  // Only lowercase letters, digits, and hyphens
  return /^[a-z0-9-]+$/.test(slug);
}

/**
 * Returns a validation result with a human-readable error message suitable
 * for inline form display.
 *
 * On success: `{ valid: true }` (no message field).
 * On failure: `{ valid: false, message: string }`.
 */
export function validateSlugWithMessage(slug: string): {
  valid: boolean;
  message?: string;
} {
  if (!slug || slug.trim() === "") {
    return { valid: false, message: "Workspace name is required." };
  }

  if (slug.length < 3) {
    return {
      valid: false,
      message: "Workspace name must be at least 3 characters.",
    };
  }

  if (slug.length > 30) {
    return {
      valid: false,
      message: "Workspace name must be 30 characters or fewer.",
    };
  }

  if (slug.startsWith("-") || slug.endsWith("-")) {
    return {
      valid: false,
      message: "Workspace name must not start or end with a hyphen.",
    };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      valid: false,
      message:
        "Workspace name may only contain lowercase letters, digits, and hyphens.",
    };
  }

  return { valid: true };
}

// ---------- Password ----------

/**
 * Returns `true` when `password` meets complexity requirements (Req 1.8):
 *  - At least 8 characters
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character
 */
export function validatePassword(password: string): boolean {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

/**
 * Returns `{ valid: true }` when the password passes all complexity rules, or
 * `{ valid: false, message: "<reason>" }` describing the first failing rule.
 *
 * Intended for use in registration forms where an inline error message is required.
 *
 * _Requirements: 1.8_
 */
export function validatePasswordWithMessage(
  password: string
): { valid: boolean; message?: string } {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: "Password is required." };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one digit." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one special character.",
    };
  }
  return { valid: true };
}

// ---------- Product ----------

/**
 * Returns `true` when `product` passes field-level validation (Req 4.1):
 *  - `name`: 1–100 non-whitespace-only characters
 *  - `unit`: 1–50 characters
 *  - `price`: number in [0.01, 999_999_999.99]
 *  - `isActive`: boolean
 */
export function validateProduct(product: unknown): boolean {
  if (typeof product !== "object" || product === null) return false;

  const p = product as Record<string, unknown>;

  // name: 1–100 chars, not whitespace-only
  if (typeof p.name !== "string") return false;
  const trimmedName = p.name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) return false;

  // unit: 1–50 chars
  if (typeof p.unit !== "string") return false;
  if (p.unit.length < 1 || p.unit.length > 50) return false;

  // price: number in [0.01, 999_999_999.99]
  if (typeof p.price !== "number" || !isFinite(p.price)) return false;
  if (p.price < 0.01 || p.price > 999_999_999.99) return false;

  // isActive: boolean
  if (typeof p.isActive !== "boolean") return false;

  return true;
}

// ---------- Logo File ----------

const ACCEPTED_LOGO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_LOGO_BYTES = 2_097_152; // 2 MB exactly

/**
 * Returns `true` when a logo file passes the upload validation rules (Req 7.3, 7.4):
 *  - MIME type must be `image/jpeg`, `image/png`, or `image/webp`
 *  - Size must be ≤ 2,097,152 bytes (2 MiB)
 */
export function validateLogoFile(
  mimeType: string,
  sizeBytes: number
): boolean {
  if (typeof mimeType !== "string") return false;
  if (!ACCEPTED_LOGO_MIME_TYPES.has(mimeType)) return false;
  if (typeof sizeBytes !== "number" || !isFinite(sizeBytes)) return false;
  if (sizeBytes <= 0 || sizeBytes > MAX_LOGO_BYTES) return false;
  return true;
}

// ---------- Net Weight ----------

/**
 * Computes net weight as exact subtraction (no rounding).
 *
 * Rules (Req 11.4):
 *  - Both `weightIn` and `weightOut` must be in (0, 99_999]
 *  - `weightIn` must be strictly greater than `weightOut`
 *
 * @throws {Error} when any constraint is violated
 */
export function computeNetWeight(
  weightIn: number,
  weightOut: number
): number {
  if (
    typeof weightIn !== "number" ||
    typeof weightOut !== "number" ||
    !isFinite(weightIn) ||
    !isFinite(weightOut)
  ) {
    throw new Error("weightIn and weightOut must be finite numbers.");
  }

  if (weightIn <= 0 || weightIn > 99_999) {
    throw new Error("weightIn must be in the range (0, 99999].");
  }

  if (weightOut <= 0 || weightOut > 99_999) {
    throw new Error("weightOut must be in the range (0, 99999].");
  }

  if (weightIn <= weightOut) {
    throw new Error("weightIn must be strictly greater than weightOut.");
  }

  return weightIn - weightOut;
}
