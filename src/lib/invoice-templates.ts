/**
 * Invoice template variants.
 *
 * A workspace can keep several named branding/template variants (e.g.
 * "Default", "Retainer clients", "White label"). Each invoice points at one of
 * them, and every generated document stores a snapshot of the variant used so
 * old documents can be reproduced byte-for-byte later.
 */
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRANDING, type InvoiceBranding } from "./invoice-render";
import { logTemplateAudit } from "./invoice-template-audit";

export type InvoiceTemplate = {
  id: string;
  sub_account_id: string;
  name: string;
  version: number;
  is_default: boolean;
  archived_at: string | null;
  business_name: string | null;
  logo_url: string | null;
  accent_color: string;
  address: string | null;
  payment_instructions: string | null;
  terms: string | null
  footer_note: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields that make up the rendered look of an invoice. */
export type TemplateBrandingPatch = Partial<
  Pick<
    InvoiceTemplate,
    | "business_name"
    | "logo_url"
    | "accent_color"
    | "address"
    | "payment_instructions"
    | "terms"
    | "footer_note"
  >
>;

export type TemplatePatch = TemplateBrandingPatch & Partial<Pick<InvoiceTemplate, "name">>;

/** Branding shape the renderer expects, derived from a template row. */
export function templateBranding(t: InvoiceTemplate | null | undefined): Partial<InvoiceBranding> {
  if (!t) return { ...DEFAULT_BRANDING };
  return {
    sub_account_id: t.sub_account_id,
    business_name: t.business_name,
    logo_url: t.logo_url,
    accent_color: t.accent_color,
    address: t.address,
    payment_instructions: t.payment_instructions,
    terms: t.terms,
    footer_note: t.footer_note,
  };
}

export async function fetchInvoiceTemplates(subAccountId: string): Promise<InvoiceTemplate[]> {
  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceTemplate[];
}

/** Includes archived versions — needed for the version diff picker. */
export async function fetchAllInvoiceTemplates(subAccountId: string): Promise<InvoiceTemplate[]> {
  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("name", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceTemplate[];
}

export async function createInvoiceTemplate(
  subAccountId: string,
  input: TemplatePatch & {
    name: string;
    makeDefault?: boolean;
    auditAction?: "created" | "duplicated" | "imported";
    auditDetail?: Record<string, unknown>;
  },
): Promise<InvoiceTemplate> {
  const { name, makeDefault, auditAction: _a, auditDetail: _d, ...branding } = input;
  const auth = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      sub_account_id: subAccountId,
      name,
      accent_color: branding.accent_color ?? DEFAULT_BRANDING.accent_color,
      business_name: branding.business_name ?? null,
      logo_url: branding.logo_url ?? null,
      address: branding.address ?? null,
      payment_instructions: branding.payment_instructions ?? null,
      terms: branding.terms ?? null,
      footer_note: branding.footer_note ?? null,
      created_by: auth.data.user?.id ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  const created = data as unknown as InvoiceTemplate;
  await logTemplateAudit({
    subAccountId,
    templateId: created.id,
    templateName: created.name,
    templateVersion: created.version,
    action: input.auditAction ?? "created",
    detail: input.auditDetail ?? {},
  });
  if (makeDefault) await setDefaultInvoiceTemplate(subAccountId, created.id);
  return created;
}

export async function updateInvoiceTemplate(
  id: string,
  patch: TemplatePatch,
  previous?: InvoiceTemplate | null,
): Promise<void> {
  const { error } = await supabase.from("invoice_templates").update(patch as never).eq("id", id);
  if (error) throw error;
  if (previous) {
    await logTemplateAudit({
      subAccountId: previous.sub_account_id,
      templateId: id,
      templateName: patch.name ?? previous.name,
      templateVersion: previous.version,
      action: "edited",
      detail: { changes: templateChanges(previous, patch) },
    });
  }
}

/** Per-field { from, to } map for the fields this patch actually changes. */
export function templateChanges(
  previous: InvoiceTemplate,
  patch: TemplatePatch,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(patch) as Array<keyof TemplatePatch>) {
    const from = (previous as unknown as Record<string, unknown>)[key as string] ?? null;
    const to = (patch as Record<string, unknown>)[key as string] ?? null;
    if (String(from ?? "") !== String(to ?? "")) out[key as string] = { from, to };
  }
  return out;
}

/**
 * Save edits as a NEW version instead of overwriting, so documents already sent
 * with the previous version keep an accurate history entry.
 */
export async function saveTemplateAsNewVersion(
  template: InvoiceTemplate,
  patch: TemplatePatch,
): Promise<InvoiceTemplate> {
  const merged = { ...template, ...patch };
  const auth = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      sub_account_id: template.sub_account_id,
      name: merged.name,
      version: template.version + 1,
      business_name: merged.business_name,
      logo_url: merged.logo_url,
      accent_color: merged.accent_color,
      address: merged.address,
      payment_instructions: merged.payment_instructions,
      terms: merged.terms,
      footer_note: merged.footer_note,
      created_by: auth.data.user?.id ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  const next = data as unknown as InvoiceTemplate;

  // The superseded version stays readable in render history but drops out of
  // the picker, and the new version inherits "default" when it applied.
  await supabase
    .from("invoice_templates")
    .update({ archived_at: new Date().toISOString(), is_default: false } as never)
    .eq("id", template.id);
  if (template.is_default) await setDefaultInvoiceTemplate(template.sub_account_id, next.id);
  await logTemplateAudit({
    subAccountId: template.sub_account_id,
    templateId: next.id,
    templateName: next.name,
    templateVersion: next.version,
    action: "new_version",
    detail: { from_version: template.version, changes: templateChanges(template, patch) },
  });
  return next;
}

export async function duplicateInvoiceTemplate(
  template: InvoiceTemplate,
  name: string,
): Promise<InvoiceTemplate> {
  return createInvoiceTemplate(template.sub_account_id, {
    auditAction: "duplicated",
    auditDetail: { source_template: template.name, source_version: template.version },
    name,
    business_name: template.business_name,
    logo_url: template.logo_url,
    accent_color: template.accent_color,
    address: template.address,
    payment_instructions: template.payment_instructions,
    terms: template.terms,
    footer_note: template.footer_note,
  });
}

export async function setDefaultInvoiceTemplate(subAccountId: string, id: string): Promise<void> {
  const clear = await supabase
    .from("invoice_templates")
    .update({ is_default: false } as never)
    .eq("sub_account_id", subAccountId)
    .eq("is_default", true);
  if (clear.error) throw clear.error;
  const { error } = await supabase.from("invoice_templates").update({ is_default: true } as never).eq("id", id);
  if (error) throw error;
  await logTemplateAudit({ subAccountId, templateId: id, action: "made_default" });
}

export async function archiveInvoiceTemplate(id: string, template?: InvoiceTemplate | null): Promise<void> {
  const { error } = await supabase
    .from("invoice_templates")
    .update({ archived_at: new Date().toISOString(), is_default: false } as never)
    .eq("id", id);
  if (error) throw error;
  if (template) {
    await logTemplateAudit({
      subAccountId: template.sub_account_id,
      templateId: id,
      templateName: template.name,
      templateVersion: template.version,
      action: "archived",
    });
  }
}
