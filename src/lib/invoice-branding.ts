import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRANDING, type InvoiceBranding } from "./invoice-render";

export type { InvoiceBranding };
export { DEFAULT_BRANDING };

export type BrandingPatch = Partial<Omit<InvoiceBranding, "sub_account_id">>;

/** Workspace branding, or defaults when it has never been configured. */
export async function fetchInvoiceBranding(subAccountId: string): Promise<InvoiceBranding> {
  const { data, error } = await supabase
    .from("invoice_branding")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as InvoiceBranding | null) ?? { sub_account_id: subAccountId, ...DEFAULT_BRANDING };
}

export async function saveInvoiceBranding(subAccountId: string, patch: BrandingPatch): Promise<void> {
  const { error } = await supabase
    .from("invoice_branding")
    .upsert({ sub_account_id: subAccountId, ...patch }, { onConflict: "sub_account_id" });
  if (error) throw error;
}
