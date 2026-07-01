import { supabase } from "@/integrations/supabase/client";
import type { Contact, LifecycleStage } from "@/lib/contacts";

const HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "lifecycle_stage",
  "lead_source",
  "tags",
  "notes",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function contactsToCsv(rows: Contact[]): string {
  const lines = [HEADERS.join(",")];
  for (const c of rows) {
    lines.push(
      [
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.lifecycle_stage,
        c.lead_source,
        (c.tags ?? []).join("|"),
        c.notes,
      ].map(csvEscape).join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Simple RFC-4180-ish parser (handles quotes, embedded commas/newlines, "" escapes)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const VALID_STAGES: LifecycleStage[] = ["lead", "mql", "sql", "customer", "lost"];

export type ImportRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  lifecycle_stage: LifecycleStage;
  lead_source: string | null;
  tags: string[];
  notes: string | null;
};

export type ParsedImport = {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  headers: string[];
};

export function parseContactsCsv(text: string): ParsedImport {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], errors: [{ line: 0, message: "Empty file" }], headers: [] };
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const rows: ImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const get = (n: string) => {
      const i = idx(n);
      return i >= 0 ? (row[i] ?? "").trim() : "";
    };
    const email = get("email").toLowerCase() || null;
    const first = get("first_name") || null;
    const last = get("last_name") || null;
    if (!email && !first && !last) {
      errors.push({ line: r + 1, message: "Row needs at least an email or a name" });
      continue;
    }
    const stageRaw = (get("lifecycle_stage") || "lead").toLowerCase() as LifecycleStage;
    const stage = VALID_STAGES.includes(stageRaw) ? stageRaw : "lead";
    const tagsRaw = get("tags");
    const tags = tagsRaw ? tagsRaw.split(/[|;,]/).map((t) => t.trim()).filter(Boolean) : [];
    rows.push({
      first_name: first,
      last_name: last,
      email,
      phone: get("phone") || null,
      company: get("company") || null,
      lifecycle_stage: stage,
      lead_source: get("lead_source") || null,
      tags,
      notes: get("notes") || null,
    });
  }
  return { rows, errors, headers };
}

export async function importContacts(
  rows: ImportRow[],
  ownerId: string,
  subAccountId: string,
): Promise<{ inserted: number; updated: number; failed: number }> {
  let inserted = 0, updated = 0, failed = 0;

  // Preload existing by email for dedupe within this sub account
  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
  const existingByEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id,email")
      .eq("sub_account_id", subAccountId)
      .in("email", emails);
    for (const c of data ?? []) {
      if (c.email) existingByEmail.set(c.email.toLowerCase(), c.id);
    }
  }

  for (const r of rows) {
    try {
      const existingId = r.email ? existingByEmail.get(r.email) : undefined;
      if (existingId) {
        const { error } = await supabase.from("contacts").update({
          first_name: r.first_name,
          last_name: r.last_name,
          phone: r.phone,
          company: r.company,
          lifecycle_stage: r.lifecycle_stage,
          lead_source: r.lead_source,
          tags: r.tags,
          notes: r.notes,
        }).eq("id", existingId);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase.from("contacts").insert({
          owner_id: ownerId,
          sub_account_id: subAccountId,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          phone: r.phone,
          company: r.company,
          lifecycle_stage: r.lifecycle_stage,
          lead_source: r.lead_source,
          tags: r.tags,
          notes: r.notes,
        });
        if (error) throw error;
        inserted++;
      }
    } catch {
      failed++;
    }
  }
  return { inserted, updated, failed };
}

export function sampleCsv(): string {
  return [
    HEADERS.join(","),
    "Jane,Doe,jane@example.com,+15551234567,Acme,lead,website,vip|newsletter,Met at conference",
    "John,Smith,john@example.com,,Beta Corp,mql,referral,enterprise,",
  ].join("\n");
}
