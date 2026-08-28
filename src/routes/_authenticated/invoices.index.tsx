import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenancy } from "@/lib/tenancy";
import { fetchContacts } from "@/lib/contacts";
import {
  createInvoice,
  deleteInvoice,
  fetchInvoices,
  formatMoney,
  INVOICE_STATUSES,
  invoicesToCsv,
  isOverdue,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoices";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices — Agency Engine" },
      {
        name: "description",
        content: "Create, send and track client invoices with line items, tax and payment status.",
      },
      { property: "og:title", content: "Invoices — Agency Engine" },
      { property: "og:description", content: "Client invoicing with line items, tax and payment tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent/10 text-accent",
  paid: "bg-emerald-500/10 text-emerald-600",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground line-through",
};

function InvoicesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("20");
  const [currency, setCurrency] = useState("GBP");

  const invoicesQ = useQuery({
    queryKey: ["invoices", subId],
    queryFn: () => fetchInvoices(subId!),
    enabled: !!subId,
  });
  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });

  const invoices = invoicesQ.data ?? [];
  const contacts = contactsQ.data ?? [];
  const contactName = (id: string | null) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) return "—";
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Contact";
  };

  const rows = useMemo(
    () => (filter === "all" ? invoices : invoices.filter((i) => effectiveStatus(i) === filter)),
    [invoices, filter],
  );

  const outstanding = invoices
    .filter((i) => i.status === "sent")
    .reduce((sum, i) => sum + Number(i.total ?? 0), 0);

  const createMut = useMutation({
    mutationFn: () =>
      createInvoice({
        subAccountId: subId!,
        contactId: contactId === "none" ? null : contactId,
        dueDate: dueDate || null,
        taxRate: Number(taxRate) || 0,
        currency,
      }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      toast.success(`${inv.number} created`);
      navigate({ to: "/invoices/$id", params: { id: inv.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    const blob = new Blob([invoicesToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      headerStatus={
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {formatMoney(outstanding, invoices[0]?.currency ?? "GBP")} outstanding
        </span>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> New invoice
          </Button>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        <h1 className="sr-only">Invoices</h1>
        <div className="px-6 py-4 border-b border-border flex items-center gap-1.5 flex-wrap">
          {(["all", ...INVOICE_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s as InvoiceStatus | "all")}
              className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {invoicesQ.isLoading ? (
            <ListSkeleton />
          ) : invoicesQ.error ? (
            <ErrorState message={(invoicesQ.error as Error).message} onRetry={() => invoicesQ.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Create an invoice, add line items, then send it to your client."
              action={<Button onClick={() => setOpen(true)}>New invoice</Button>}
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Number</th>
                    <th className="text-left font-medium px-4 py-2">Client</th>
                    <th className="text-left font-medium px-4 py-2">Issued</th>
                    <th className="text-left font-medium px-4 py-2">Due</th>
                    <th className="text-right font-medium px-4 py-2">Total</th>
                    <th className="text-left font-medium px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer"
                      onClick={() => navigate({ to: "/invoices/$id", params: { id: inv.id } })}
                    >
                      <td className="px-4 py-2 font-mono text-xs">{inv.number}</td>
                      <td className="px-4 py-2">{contactName(inv.contact_id)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{inv.issue_date}</td>
                      <td className="px-4 py-2 text-muted-foreground">{inv.due_date ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney(Number(inv.total), inv.currency)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs capitalize ${STATUS_CLASS[effectiveStatus(inv)]}`}
                        >
                          {effectiveStatus(inv)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          aria-label={`Delete ${inv.number}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${inv.number}? This cannot be undone.`)) deleteMut.mutate(inv.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax">Tax %</Label>
                <Input id="tax" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cur">Currency</Label>
                <Input id="cur" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={!subId || createMut.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function effectiveStatus(inv: Invoice): InvoiceStatus {
  return isOverdue(inv) ? "overdue" : inv.status;
}
