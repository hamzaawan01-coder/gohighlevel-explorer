import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

export type Invoice = {
  id: string;
  sub_account_id: string;
  contact_id: string | null;
  deal_id: string | null;
  number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  sub_account_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
};

export function formatMoney(amount: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

/** An invoice is overdue when it is still awaiting payment past its due date. */
export function isOverdue(inv: Invoice) {
  if (inv.status !== "sent") return false;
  if (!inv.due_date) return false;
  return new Date(`${inv.due_date}T23:59:59`) < new Date();
}

export async function fetchInvoices(subAccountId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Invoice;
}

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as InvoiceItem[];
}

export async function createInvoice(input: {
  subAccountId: string;
  contactId?: string | null;
  dealId?: string | null;
  currency?: string;
  dueDate?: string | null;
  taxRate?: number;
  notes?: string | null;
}): Promise<Invoice> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      sub_account_id: input.subAccountId,
      contact_id: input.contactId ?? null,
      deal_id: input.dealId ?? null,
      currency: input.currency ?? "GBP",
      due_date: input.dueDate ?? null,
      tax_rate: input.taxRate ?? 0,
      notes: input.notes ?? null,
      number: "",
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(
  id: string,
  patch: Partial<
    Pick<
      Invoice,
      "status" | "contact_id" | "deal_id" | "currency" | "issue_date" | "due_date" | "tax_rate" | "notes"
    >
  >,
): Promise<void> {
  const paidAt =
    patch.status === "paid"
      ? new Date().toISOString()
      : patch.status
        ? null
        : undefined;
  const { error } = await supabase
    .from("invoices")
    .update({ ...patch, ...(paidAt !== undefined ? { paid_at: paidAt } : {}) })
    .eq("id", id);
  if (error) throw error;
}


export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function addInvoiceItem(input: {
  invoiceId: string;
  subAccountId: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  position?: number;
}): Promise<InvoiceItem> {
  const { data, error } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: input.invoiceId,
      sub_account_id: input.subAccountId,
      description: input.description ?? "",
      quantity: input.quantity ?? 1,
      unit_price: input.unitPrice ?? 0,
      position: input.position ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as InvoiceItem;
}

export async function updateInvoiceItem(
  id: string,
  patch: Partial<Pick<InvoiceItem, "description" | "quantity" | "unit_price" | "position">>,
): Promise<void> {
  const { error } = await supabase.from("invoice_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  const { error } = await supabase.from("invoice_items").delete().eq("id", id);
  if (error) throw error;
}

export function invoicesToCsv(rows: Invoice[]): string {
  const head = ["Number", "Status", "Issue date", "Due date", "Currency", "Subtotal", "Tax", "Total"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [r.number, r.status, r.issue_date, r.due_date ?? "", r.currency, r.subtotal, r.tax_amount, r.total]
      .map(esc)
      .join(","),
  );
  return [head.map(esc).join(","), ...body].join("\n");
}
