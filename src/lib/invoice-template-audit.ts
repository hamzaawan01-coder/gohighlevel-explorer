/**
 * Workspace audit log for invoice template changes.
 *
 * Every edit, new version, duplication, archive and default change is recorded
 * with the template name + version so it is clear which branding a client saw.
 */
import { supabase } from "@/integrations/supabase/client";

export type TemplateAuditAction =
  | "created"
  | "edited"
  | "new_version"
  | "duplicated"
  | "archived"
  | "made_default"
  | "imported"
  | "exported";

export type TemplateAuditEntry = {
  id: string;
  sub_account_id: string;
  template_id: string | null;
  template_name: string | null;
  template_version: number | null;
  action: string;
  detail: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
};

export const TEMPLATE_AUDIT_LABELS: Record<string, string> = {
  created: "Template created",
  edited: "Template edited",
  new_version: "Saved as new version",
  duplicated: "Duplicated",
  archived: "Archived",
  made_default: "Made workspace default",
  imported: "Imported from file",
  exported: "Exported to file",
};

/** Append an entry. Never throws — auditing must not block the edit. */
export async function logTemplateAudit(input: {
  subAccountId: string;
  templateId?: string | null;
  templateName?: string | null;
  templateVersion?: number | null;
  action: TemplateAuditAction;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("invoice_template_audit").insert({
      sub_account_id: input.subAccountId,
      template_id: input.templateId ?? null,
      template_name: input.templateName ?? null,
      template_version: input.templateVersion ?? null,
      action: input.action,
      detail: (input.detail ?? {}) as never,
      changed_by: auth.user.id,
    } as never);
  } catch {
    // ignore
  }
}

export async function fetchTemplateAudit(subAccountId: string): Promise<TemplateAuditEntry[]> {
  const { data, error } = await supabase
    .from("invoice_template_audit")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as TemplateAuditEntry[];
}

export function describeTemplateAudit(entry: TemplateAuditEntry): string {
  const label = TEMPLATE_AUDIT_LABELS[entry.action] ?? entry.action;
  const name = entry.template_name ? ` — ${entry.template_name}` : "";
  const version = entry.template_version ? ` v${entry.template_version}` : "";
  return `${label}${name}${version}`;
}

/** Fields that changed, as a compact "field: old → new" list. */
export function changedFieldsSummary(entry: TemplateAuditEntry): string[] {
  const changes = entry.detail['changes'];
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>).map(
    ([field, v]) => `${field}: ${String(v?.from ?? "—")} → ${String(v?.to ?? "—")}`,
  );
}
