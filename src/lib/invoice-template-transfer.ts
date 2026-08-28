/**
 * Copy invoice template variants between workspaces via a downloadable file.
 *
 * Export produces a portable JSON (or CSV) document containing only branding
 * fields — no ids — so the same file can be imported into any workspace.
 */
import { createInvoiceTemplate, type InvoiceTemplate, type TemplatePatch } from "./invoice-templates";
import { logTemplateAudit } from "./invoice-template-audit";

export const TEMPLATE_FIELDS = [
  "name",
  "business_name",
  "logo_url",
  "accent_color",
  "address",
  "payment_instructions",
  "terms",
  "footer_note",
] as const;

export type PortableTemplate = {
  name: string;
  version?: number | null;
  is_default?: boolean;
  business_name?: string | null;
  logo_url?: string | null;
  accent_color?: string | null;
  address?: string | null;
  payment_instructions?: string | null;
  terms?: string | null;
  footer_note?: string | null;
};

export type TemplateExportFile = {
  kind: "invoice-template-variants";
  format_version: 1;
  exported_at: string;
  templates: PortableTemplate[];
};

export function toPortable(t: InvoiceTemplate): PortableTemplate {
  return {
    name: t.name,
    version: t.version,
    is_default: t.is_default,
    business_name: t.business_name,
    logo_url: t.logo_url,
    accent_color: t.accent_color,
    address: t.address,
    payment_instructions: t.payment_instructions,
    terms: t.terms,
    footer_note: t.footer_note,
  };
}

export function templatesToJson(templates: InvoiceTemplate[]): string {
  const file: TemplateExportFile = {
    kind: "invoice-template-variants",
    format_version: 1,
    exported_at: new Date().toISOString(),
    templates: templates.map(toPortable),
  };
  return JSON.stringify(file, null, 2);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function templatesToCsv(templates: InvoiceTemplate[]): string {
  const head = [...TEMPLATE_FIELDS, "version", "is_default"];
  const lines = [head.join(",")];
  for (const t of templates) {
    const p = toPortable(t) as Record<string, unknown>;
    lines.push(head.map((h) => csvCell(p[h])).join(","));
  }
  return lines.join("\n");
}

/** Minimal RFC4180-ish CSV row parser (handles quotes and embedded commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Accepts either the JSON export file or a CSV with matching headers. */
export function parseTemplateFile(text: string): PortableTemplate[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as TemplateExportFile | PortableTemplate[];
    const list = Array.isArray(parsed) ? parsed : parsed.templates;
    if (!Array.isArray(list)) throw new Error("This file has no templates array.");
    return list.filter((t) => t && typeof t.name === "string" && t.name.trim() !== "");
  }
  const rows = parseCsv(trimmed);
  if (rows.length < 2) throw new Error("This CSV has no template rows.");
  const head = rows[0]!.map((h) => h.trim());
  if (!head.includes("name")) throw new Error("This CSV is missing a 'name' column.");
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    head.forEach((h, i) => (rec[h] = r[i] ?? ""));
    return {
      name: rec['name'] ?? "",
      business_name: rec['business_name'] || null,
      logo_url: rec['logo_url'] || null,
      accent_color: rec['accent_color'] || null,
      address: rec['address'] || null,
      payment_instructions: rec['payment_instructions'] || null,
      terms: rec['terms'] || null,
      footer_note: rec['footer_note'] || null,
    } satisfies PortableTemplate;
  }).filter((t) => t.name.trim() !== "");
}

/** Create one new variant per imported entry, avoiding name collisions. */
export async function importTemplates(
  subAccountId: string,
  incoming: PortableTemplate[],
  existing: InvoiceTemplate[],
): Promise<{ imported: number; names: string[] }> {
  const taken = new Set(existing.map((t) => t.name.toLowerCase()));
  const names: string[] = [];
  for (const t of incoming) {
    let name = t.name.trim();
    if (taken.has(name.toLowerCase())) name = `${name} (imported)`;
    let suffix = 2;
    while (taken.has(name.toLowerCase())) name = `${t.name.trim()} (imported ${suffix++})`;
    taken.add(name.toLowerCase());
    const patch: TemplatePatch = {
      business_name: t.business_name ?? null,
      logo_url: t.logo_url ?? null,
      accent_color: t.accent_color ?? undefined,
      address: t.address ?? null,
      payment_instructions: t.payment_instructions ?? null,
      terms: t.terms ?? null,
      footer_note: t.footer_note ?? null,
    };
    await createInvoiceTemplate(subAccountId, {
      ...patch,
      name,
      auditAction: "imported",
      auditDetail: { source_name: t.name, source_version: t.version ?? null },
    });
    names.push(name);
  }
  return { imported: names.length, names };
}

export async function logTemplateExport(
  subAccountId: string,
  templates: InvoiceTemplate[],
  format: "json" | "csv",
): Promise<void> {
  await logTemplateAudit({
    subAccountId,
    action: "exported",
    detail: { format, count: templates.length, names: templates.map((t) => t.name) },
  });
}

/* ------------------------------- Version diff ----------------------------- */

export type TemplateDiffRow = {
  field: (typeof TEMPLATE_FIELDS)[number];
  left: string;
  right: string;
  changed: boolean;
};

/** Field-by-field comparison of two variants/versions. */
export function diffTemplates(a: InvoiceTemplate, b: InvoiceTemplate): TemplateDiffRow[] {
  return TEMPLATE_FIELDS.map((field) => {
    const left = String((a as unknown as Record<string, unknown>)[field] ?? "");
    const right = String((b as unknown as Record<string, unknown>)[field] ?? "");
    return { field, left, right, changed: left !== right };
  });
}
