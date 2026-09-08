import { supabase } from "@/integrations/supabase/client";

/* ---------- Currency ---------- */

export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "GBP", label: "British pound (£)", symbol: "£" },
  { code: "USD", label: "US dollar ($)", symbol: "$" },
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "CAD", label: "Canadian dollar (CA$)", symbol: "CA$" },
  { code: "AUD", label: "Australian dollar (A$)", symbol: "A$" },
  { code: "AED", label: "UAE dirham (AED)", symbol: "AED " },
  { code: "PKR", label: "Pakistani rupee (Rs)", symbol: "Rs " },
  { code: "INR", label: "Indian rupee (₹)", symbol: "₹" },
];

export function currencySymbol(code?: string | null) {
  return CURRENCIES.find((c) => c.code === (code ?? "GBP"))?.symbol ?? `${code} `;
}

/** Format an amount with a currency code, e.g. formatAmount(1500, "USD") -> "$1,500". */
export function formatAmount(amount: number | string | null | undefined, code?: string | null) {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (code ?? "GBP").toUpperCase(),
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return `${currencySymbol(code)}${n.toLocaleString()}`;
  }
}

export async function fetchDefaultCurrency(subAccountId: string): Promise<string> {
  const { data, error } = await supabase
    .from("sub_accounts")
    .select("default_currency")
    .eq("id", subAccountId)
    .single();
  if (error) throw error;
  return (data?.default_currency as string) ?? "GBP";
}

export async function updateDefaultCurrency(subAccountId: string, currency: string) {
  const { error } = await supabase
    .from("sub_accounts")
    .update({ default_currency: currency })
    .eq("id", subAccountId);
  if (error) throw error;
}

/* ---------- Custom fields ---------- */

export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";

export const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Yes / no" },
];

export type CustomFieldDef = {
  id: string;
  sub_account_id: string;
  entity: string;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[];
  required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type CustomFieldValues = Record<string, string | number | boolean | null>;

export function slugifyKey(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";
}

export async function fetchCustomFields(
  subAccountId: string,
  entity = "contacts",
): Promise<CustomFieldDef[]> {
  const { data, error } = await supabase
    .from("custom_field_defs")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .eq("entity", entity)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    options: Array.isArray(r.options) ? (r.options as string[]) : [],
  })) as CustomFieldDef[];
}

export async function createCustomField(input: {
  subAccountId: string;
  entity?: string;
  label: string;
  field_type: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
}): Promise<CustomFieldDef> {
  const { data, error } = await supabase
    .from("custom_field_defs")
    .insert({
      sub_account_id: input.subAccountId,
      entity: input.entity ?? "contacts",
      key: slugifyKey(input.label),
      label: input.label.trim(),
      field_type: input.field_type,
      options: input.options ?? [],
      required: input.required ?? false,
      position: input.position ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, options: Array.isArray(data.options) ? (data.options as string[]) : [] } as CustomFieldDef;
}

export async function updateCustomField(
  id: string,
  patch: Partial<Pick<CustomFieldDef, "label" | "field_type" | "options" | "required" | "position">>,
) {
  const { error } = await supabase.from("custom_field_defs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomField(id: string) {
  const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
  if (error) throw error;
}

/** Display a stored custom value for a definition. */
export function displayCustomValue(def: CustomFieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (def.field_type === "checkbox") return value ? "Yes" : "No";
  return String(value);
}
