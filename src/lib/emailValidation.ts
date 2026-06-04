// ============================================
// Email Validation Utility
// ============================================
// Validates email format strictly and blocks
// known disposable / spam email providers.

/** Strict email format regex (RFC 5322 simplified) */
const EMAIL_FORMAT_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Known disposable / temporary email domains that are commonly
 * used for spam registrations.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "tempmail.com",
  "temp-mail.org",
  "throwam.com",
  "throwam.net",
  "yopmail.com",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "spam4.me",
  "trashmail.com",
  "trashmail.at",
  "trashmail.me",
  "dispostable.com",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "discard.email",
  "spamfree24.org",
  "spamfree24.de",
  "spamfree24.eu",
  "spamfree24.info",
  "spamfree24.net",
  "spamfree.eu",
  "spam.la",
  "kasmail.com",
  "spamspot.com",
  "spamevader.com",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minutemail.de",
  "mohmal.com",
  "mytrashmail.com",
  "throwam.com",
  "gawab.com",
  "getonemail.com",
  "getonemail.net",
  "tempr.email",
  "discard.email",
  "cfl.fr",
  "filzmail.com",
  "mintemail.com",
  "easytrashmail.com",
  "fakemail.net",
  "mailzilla.com",
  "mailzilla.org",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "get2mail.fr",
  "hatespam.org",
  "jetable.com",
  "jetable.fr.nf",
  "jetable.net",
  "jetable.org",
  "lol.ovpn.to",
  "nospam.ze.tc",
  "obobbo.com",
  "recursor.net",
  "rklips.com",
  "rmqkr.net",
  "safetymail.info",
  "spam.su",
  "spamfree24.com",
  "tafmail.com",
  "uggsrock.com",
  "wh4f.org",
  "yepmail.net",
  "zippymail.info",
]);

export interface EmailValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Validates an email address for format correctness and checks
 * against a list of known disposable/spam email providers.
 *
 * @param email - The email address to validate
 * @returns `{ valid: boolean, error: string | null }`
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: "Please enter your email address" };
  }

  // Format check
  if (!EMAIL_FORMAT_REGEX.test(trimmed)) {
    return {
      valid: false,
      error:
        "This is not a valid email address, enter a valid email and try again",
    };
  }

  // Extract domain
  const domain = trimmed.split("@")[1];

  // Disposable / spam domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      error:
        "This is not a valid email address, enter a valid email and try again",
    };
  }

  // Must have at least one dot in domain (e.g. gmail.com not just gmail)
  if (!domain.includes(".")) {
    return {
      valid: false,
      error:
        "This is not a valid email address, enter a valid email and try again",
    };
  }

  // TLD must be at least 2 characters
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) {
    return {
      valid: false,
      error:
        "This is not a valid email address, enter a valid email and try again",
    };
  }

  return { valid: true, error: null };
}
