/**
 * Shared field-mapping logic for WordPress webhook payloads.
 * Used by the server-side webhook receiver AND the settings preview UI so
 * both agree on exactly which incoming field lands where.
 */

export const STANDARD_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "notes",
] as const;
export type StandardKey = (typeof STANDARD_KEYS)[number];

export type FieldMap = Partial<Record<StandardKey, string[]>>;

export const BUILTIN_ALIASES: Record<StandardKey, string[]> = {
  first_name: [
    "first_name", "first name", "fname", "firstname", "your-name",
    "name", "full_name", "full name", "your_name", "your name", "contact_name", "contact name",
  ],
  last_name: [
    "last_name", "last name", "lname", "lastname", "surname",
    "your-lastname", "family_name", "family name",
  ],
  email: [
    "email", "e-mail", "your-email", "your email", "email_address", "email address",
    "user_email", "user email", "mail", "e_mail", "contact_email", "contact email",
  ],
  phone: [
    "phone", "phone number", "your-phone", "your phone", "telephone", "tel",
    "mobile", "mobile number", "mobile phone", "cell", "cell phone", "cellphone",
    "contact_number", "contact number", "phone_number", "whatsapp", "whatsapp number",
  ],
  company: [
    "company", "company name", "your-company", "your company", "organization", "organisation",
    "business", "business name", "company_name", "employer",
  ],
  notes: [
    "notes", "note", "message", "your message", "your-message", "comments", "comment",
    "your-comment", "your comment", "inquiry", "enquiry", "details", "description",
    "how can we help", "how can we help you", "tell us more", "additional information",
  ],
};

export function normKey(k: string): string {
  return k.toLowerCase().replace(/[\s\-_.]+/g, "_");
}

export type MappingRow = {
  rawKey: string;
  value: string;
  target: StandardKey | "extra" | "ignored";
  reason: string;
};

export type MappingResult = {
  rows: MappingRow[];
  mapped: Partial<Record<StandardKey, string>>;
  extras: Record<string, string>;
  splitFullName: boolean;
};

export function mapPayload(
  raw: Record<string, unknown>,
  fieldMap: FieldMap = {},
): MappingResult {
  const aliasToStd = new Map<string, StandardKey>();
  const aliasSource = new Map<string, "builtin" | "custom">();

  for (const std of STANDARD_KEYS) {
    aliasToStd.set(normKey(std), std);
    aliasSource.set(normKey(std), "builtin");
    for (const a of BUILTIN_ALIASES[std]) {
      aliasToStd.set(normKey(a), std);
      aliasSource.set(normKey(a), "builtin");
    }
  }
  // Custom aliases override built-ins on conflict.
  for (const std of STANDARD_KEYS) {
    for (const a of fieldMap[std] ?? []) {
      aliasToStd.set(normKey(a), std);
      aliasSource.set(normKey(a), "custom");
    }
  }

  const mapped: Partial<Record<StandardKey, string>> = {};
  const extras: Record<string, string> = {};
  const rows: MappingRow[] = [];

  for (const [rawKey, rawVal] of Object.entries(raw)) {
    if (rawVal == null) {
      rows.push({ rawKey, value: "", target: "ignored", reason: "empty value" });
      continue;
    }
    const valStr =
      typeof rawVal === "string"
        ? rawVal
        : typeof rawVal === "number" || typeof rawVal === "boolean"
          ? String(rawVal)
          : JSON.stringify(rawVal);
    const trimmed = valStr.trim();
    if (!trimmed) {
      rows.push({ rawKey, value: "", target: "ignored", reason: "empty value" });
      continue;
    }

    const nk = normKey(rawKey);
    const std = aliasToStd.get(nk);
    if (std && mapped[std] == null) {
      const capped = trimmed.slice(0, std === "notes" ? 5000 : 255);
      mapped[std] = capped;
      const source = aliasSource.get(nk) ?? "builtin";
      rows.push({
        rawKey,
        value: capped,
        target: std,
        reason: source === "custom" ? `custom alias → ${std}` : `built-in alias → ${std}`,
      });
    } else if (std) {
      // Slot already filled by an earlier field — keep this one as extra.
      const capped = trimmed.slice(0, 2000);
      extras[rawKey.slice(0, 120)] = capped;
      rows.push({
        rawKey,
        value: capped,
        target: "extra",
        reason: `${std} already set — kept in payload`,
      });
    } else {
      const capped = trimmed.slice(0, 2000);
      extras[rawKey.slice(0, 120)] = capped;
      rows.push({
        rawKey,
        value: capped,
        target: "extra",
        reason: "no alias match — kept in payload",
      });
    }
  }

  let splitFullName = false;
  if (mapped.first_name && !mapped.last_name && /\s+/.test(mapped.first_name)) {
    const parts = mapped.first_name.split(/\s+/);
    mapped.first_name = parts.shift() ?? mapped.first_name;
    mapped.last_name = parts.join(" ").slice(0, 255);
    splitFullName = true;
  }

  return { rows, mapped, extras, splitFullName };
}
