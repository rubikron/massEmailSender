// ── Scraper Configuration ──────────────────────────────────────────────────────
// General-purpose web scraping + outreach pipeline configuration.
// ────────────────────────────────────────────────────────────────────────────────

// Optional: restrict to specific email domains (leave empty to accept any).
// Example: ["uw.edu", "stanford.edu"] — only keep contacts from these domains.
export const TARGET_DOMAINS = [];

// Source description — used in auto-generated contact descriptions.
// Customize these to describe where your contacts came from.
export const SOURCE_LABEL      = "web research";
export const SOURCE_DESCRIPTION = "Contact discovered via web scraping and research";

// Default fallback when department/affiliation can't be inferred.
export const DEFAULT_DEPARTMENT = "Unknown";

// ── Email Utilities ────────────────────────────────────────────────────────────

// Returns true if the email is valid and matches target domains (if configured).
export function isValidEmail(email) {
  if (!email || !email.includes("@")) return false;
  if (TARGET_DOMAINS.length === 0) return true;
  return TARGET_DOMAINS.some(domain => email.endsWith(`@${domain}`));
}
