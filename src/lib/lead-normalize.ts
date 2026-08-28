/**
 * Normalization + dedupe helpers for phone/email values collected from
 * Meta lead answers and CRM contact records.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const plus = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.replace(/^00/, "");
  if (digits.length < 6) return null;
  return plus ? `+${digits}` : digits;
}

export function formatPhone(normalized: string): string {
  if (!normalized.startsWith("+")) return normalized;
  const d = normalized.slice(1);
  if (d.length <= 6) return normalized;
  return `+${d.slice(0, d.length - 9 > 0 ? d.length - 9 : 2)} ${d.slice(d.length - 9 > 0 ? d.length - 9 : 2)}`.replace(
    /\s+/g,
    " ",
  );
}

/** Dedupes by normalized key, preserving the first-seen original value. */
export function dedupeValues(
  values: Array<string | null | undefined>,
  normalizer: (v: string | null | undefined) => string | null,
): Array<{ value: string; normalized: string }> {
  const seen = new Map<string, { value: string; normalized: string }>();
  for (const v of values) {
    const n = normalizer(v);
    if (!n || seen.has(n)) continue;
    seen.set(n, { value: String(v).trim(), normalized: n });
  }
  return [...seen.values()];
}

export function isPhoneKey(key: string) {
  return /phone|mobile|cell|whatsapp|tel/i.test(key);
}

export function isEmailKey(key: string) {
  return /e-?mail/i.test(key);
}
