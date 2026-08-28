import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, CreditCard, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ErrorState, PanelSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenancy } from "@/lib/tenancy";
import { fetchContacts } from "@/lib/contacts";
import {
  addInvoiceItem,
  deleteInvoiceItem,
  fetchInvoice,
  fetchInvoiceItems,
  formatMoney,
  INVOICE_STATUSES,
  updateInvoice,
  updateInvoiceItem,
  type InvoiceStatus,
} from "@/lib/invoices";
import { fetchInvoiceBranding } from "@/lib/invoice-branding";
import { renderInvoiceHtml } from "@/lib/invoice-render";
import {
  fetchInvoiceDeliveries,
  fetchInvoiceEvents,
  fetchInvoiceReminders,
} from "@/lib/invoice-history";
import { createInvoicePaymentLink, sendInvoiceEmail } from "@/lib/invoices.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [
      { title: "Invoice — Agency Engine" },
      { name: "description", content: "Edit invoice line items, tax, due date and payment status." },
      { property: "og:title", content: "Invoice — Agency Engine" },
      { property: "og:description", content: "Edit invoice line items, tax and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);

  const invoiceQ = useQuery({ queryKey: ["invoice", id], queryFn: () => fetchInvoice(id) });
  const itemsQ = useQuery({ queryKey: ["invoice-items", id], queryFn: () => fetchInvoiceItems(id) });
  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });

  const brandingQ = useQuery({
    queryKey: ["invoice-branding", subId],
    queryFn: () => fetchInvoiceBranding(subId!),
    enabled: !!subId,
  });
  const eventsQ = useQuery({ queryKey: ["invoice-events", id], queryFn: () => fetchInvoiceEvents(id) });
  const remindersQ = useQuery({ queryKey: ["invoice-reminders", id], queryFn: () => fetchInvoiceReminders(id) });
  const deliveriesQ = useQuery({
    queryKey: ["invoice-deliveries", id],
    queryFn: () => fetchInvoiceDeliveries(id),
  });

  const invoice = invoiceQ.data;
  const items = itemsQ.data ?? [];
  const contacts = contactsQ.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoice-items", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice-events", id] });
    qc.invalidateQueries({ queryKey: ["invoice-reminders", id] });
    qc.invalidateQueries({ queryKey: ["invoice-deliveries", id] });
  };

  const sendFn = useServerFn(sendInvoiceEmail);
  const payLinkFn = useServerFn(createInvoicePaymentLink);

  const send = useMutation({
    mutationFn: async () => {
      const res = await sendFn({ data: { invoiceId: id } });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      toast.success(`Invoice queued to ${res.to}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payLink = useMutation({
    mutationFn: async () => {
      const res = await payLinkFn({ data: { invoiceId: id, environment: getStripeEnvironment() } });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      toast.success("Payment link ready");
      window.open(res.url, "_blank", "noopener");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Print the branded document (same layout the client receives by email). */
  const printBranded = () => {
    if (!invoice) return;
    const html = renderInvoiceHtml({
      invoice,
      items,
      branding: brandingQ.data ?? null,
      recipientName:
        contacts.find((c) => c.id === invoice.contact_id) &&
        [
          contacts.find((c) => c.id === invoice.contact_id)?.first_name,
          contacts.find((c) => c.id === invoice.contact_id)?.last_name,
        ]
          .filter(Boolean)
          .join(" "),
      payUrl: invoice.stripe_payment_link_url,
    });
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to print the branded invoice");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const saveInvoice = useMutation({
    mutationFn: (patch: Parameters<typeof updateInvoice>[1]) => updateInvoice(id, patch),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: () =>
      addInvoiceItem({
        invoiceId: id,
        subAccountId: invoice!.sub_account_id,
        description: "New item",
        quantity: 1,
        unitPrice: 0,
        position: items.length,
      }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: Parameters<typeof updateInvoiceItem>[1] }) =>
      updateInvoiceItem(itemId, patch),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => deleteInvoiceItem(itemId),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      headerActions={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
            <Send className="size-3.5" /> {send.isPending ? "Sending…" : "Send invoice"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => payLink.mutate()} disabled={payLink.isPending}>
            <CreditCard className="size-3.5" /> {invoice?.stripe_payment_link_url ? "Payment link" : "Create pay link"}
          </Button>
          <Button variant="outline" size="sm" onClick={printBranded}>
            <Printer className="size-3.5" /> Print / PDF
          </Button>
          <Link to="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          </Link>
        </div>
      }
    >
      <div className="h-full overflow-auto p-6">
        {invoiceQ.isLoading ? (
          <PanelSkeleton />
        ) : invoiceQ.error || !invoice ? (
          <ErrorState error={invoiceQ.error} onRetry={() => void invoiceQ.refetch()} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Invoice {invoice.number}</h1>
                <p className="text-xs text-muted-foreground">
                  Issued {invoice.issue_date}
                  {invoice.due_date ? ` · due ${invoice.due_date}` : ""}
                </p>
              </div>
              <div className="w-40 space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={invoice.status}
                  onValueChange={(v) => saveInvoice.mutate({ status: v as InvoiceStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </header>

            <section className="surface-card grid gap-3 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select
                  value={invoice.contact_id ?? "none"}
                  onValueChange={(v) => saveInvoice.mutate({ contact_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Contact"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="issue">Issue date</Label>
                  <Input
                    id="issue"
                    type="date"
                    defaultValue={invoice.issue_date}
                    onBlur={(e) => saveInvoice.mutate({ issue_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due">Due date</Label>
                  <Input
                    id="due"
                    type="date"
                    defaultValue={invoice.due_date ?? ""}
                    onBlur={(e) => saveInvoice.mutate({ due_date: e.target.value || null })}
                  />
                </div>
              </div>
            </section>

            <section className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h2 className="text-sm font-medium">Line items</h2>
                <Button size="sm" variant="outline" onClick={() => addItem.mutate()} disabled={addItem.isPending}>
                  <Plus className="size-3.5" /> Add item
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Unit price</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Amount</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No line items yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label="Description"
                            defaultValue={item.description}
                            onBlur={(e) =>
                              e.target.value !== item.description &&
                              saveItem.mutate({ itemId: item.id, patch: { description: e.target.value } })
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label="Quantity"
                            type="number"
                            step="0.01"
                            className="text-right"
                            defaultValue={String(item.quantity)}
                            onBlur={(e) =>
                              saveItem.mutate({ itemId: item.id, patch: { quantity: Number(e.target.value) || 0 } })
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label="Unit price"
                            type="number"
                            step="0.01"
                            className="text-right"
                            defaultValue={String(item.unit_price)}
                            onBlur={(e) =>
                              saveItem.mutate({ itemId: item.id, patch: { unit_price: Number(e.target.value) || 0 } })
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {formatMoney(Number(item.quantity) * Number(item.unit_price), invoice.currency)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            aria-label="Remove item"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem.mutate(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="notes">Notes / payment terms</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  defaultValue={invoice.notes ?? ""}
                  onBlur={(e) => saveInvoice.mutate({ notes: e.target.value || null })}
                />
              </div>
              <div className="surface-card w-full space-y-2 p-4 sm:w-64">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(Number(invoice.subtotal), invoice.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Label htmlFor="tax" className="text-muted-foreground">
                    Tax %
                  </Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.01"
                    className="h-8 w-20 text-right"
                    defaultValue={String(invoice.tax_rate)}
                    onBlur={(e) => saveInvoice.mutate({ tax_rate: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(Number(invoice.total), invoice.currency)}</span>
                </div>
              </div>
            </section>

            <section className="surface-card space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Overdue reminders</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <Label htmlFor="rem" className="text-xs text-muted-foreground">
                    Auto follow-ups
                  </Label>
                  <Switch
                    id="rem"
                    checked={invoice.reminders_enabled}
                    onCheckedChange={(v) => saveInvoice.mutate({ reminders_enabled: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interval" className="text-xs text-muted-foreground">
                    Every N days
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min={1}
                    defaultValue={String(invoice.reminder_interval_days)}
                    onBlur={(e) =>
                      saveInvoice.mutate({ reminder_interval_days: Number(e.target.value) || 3 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxrem" className="text-xs text-muted-foreground">
                    Max reminders
                  </Label>
                  <Input
                    id="maxrem"
                    type="number"
                    min={1}
                    defaultValue={String(invoice.max_reminders)}
                    onBlur={(e) => saveInvoice.mutate({ max_reminders: Number(e.target.value) || 3 })}
                  />
                </div>
              </div>
              {(remindersQ.data ?? []).length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {(remindersQ.data ?? []).map((r) => (
                    <li key={r.id}>
                      Reminder {r.sequence}: {r.status}
                      {r.sent_at ? ` · sent ${new Date(r.sent_at).toLocaleString()}` : ""}
                      {r.error ? ` · ${r.error}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface-card space-y-3 p-4">
              <h2 className="text-sm font-medium">Delivery status</h2>
              {(deliveriesQ.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {(deliveriesQ.data ?? []).map((d) => (
                    <li key={d.id} className="flex flex-wrap gap-2">
                      <span className="font-medium capitalize">{d.status}</span>
                      <span className="text-muted-foreground">
                        {d.to_address} · {d.provider ?? "pending provider"} · attempts {d.attempts}
                        {d.sent_at ? ` · ${new Date(d.sent_at).toLocaleString()}` : ""}
                      </span>
                      {d.error && <span className="text-destructive">{d.error}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface-card space-y-3 p-4">
              <h2 className="text-sm font-medium">Invoice history</h2>
              {(eventsQ.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-1.5 text-xs">
                  {(eventsQ.data ?? []).map((ev) => (
                    <li key={ev.id} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium capitalize">{ev.type.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                      {Object.keys(ev.detail ?? {}).length > 0 && (
                        <span className="text-muted-foreground">
                          {Object.entries(ev.detail)
                            .filter(([, v]) => v !== null && v !== "")
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                            .join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
