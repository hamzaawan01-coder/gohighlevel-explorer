import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { SettingsNav } from "@/components/SettingsNav";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PanelSkeleton } from "@/components/ui/states";
import { useTenancy } from "@/lib/tenancy";
import { fetchInvoiceBranding, saveInvoiceBranding, type BrandingPatch } from "@/lib/invoice-branding";
import { renderInvoiceHtml, safeColor } from "@/lib/invoice-render";
import type { Invoice, InvoiceItem } from "@/lib/invoices";

export const Route = createFileRoute("/_authenticated/settings/invoices")({
  head: () => ({
    meta: [
      { title: "Invoice branding — Settings" },
      {
        name: "description",
        content: "Set the logo, colours, payment instructions, terms and footer used on invoices and PDFs.",
      },
      { property: "og:title", content: "Invoice branding — Settings" },
      { property: "og:description", content: "Brand your invoice emails and print/PDF output per workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceBrandingPage,
});

const SAMPLE_INVOICE = {
  id: "sample",
  sub_account_id: "sample",
  contact_id: null,
  deal_id: null,
  number: "INV-0001",
  status: "sent",
  currency: "GBP",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  tax_rate: 20,
  subtotal: 1000,
  tax_amount: 200,
  total: 1200,
  notes: "Retainer for this month.",
  paid_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Invoice;

const SAMPLE_ITEMS = [
  { id: "1", invoice_id: "sample", sub_account_id: "sample", description: "Marketing retainer", quantity: 1, unit_price: 800, position: 0 },
  { id: "2", invoice_id: "sample", sub_account_id: "sample", description: "Ad management", quantity: 4, unit_price: 50, position: 1 },
] as unknown as InvoiceItem[];

function InvoiceBrandingPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandingPatch>({});

  const q = useQuery({
    queryKey: ["invoice-branding", subId],
    queryFn: () => fetchInvoiceBranding(subId!),
    enabled: !!subId,
  });

  useEffect(() => {
    if (q.data) {
      const { sub_account_id: _ignored, ...rest } = q.data;
      setForm(rest);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveInvoiceBranding(subId!, form),
    onSuccess: () => {
      toast.success("Invoice branding saved");
      qc.invalidateQueries({ queryKey: ["invoice-branding", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: BrandingPatch) => setForm((f) => ({ ...f, ...patch }));

  const preview = renderInvoiceHtml({
    invoice: SAMPLE_INVOICE,
    items: SAMPLE_ITEMS,
    branding: { sub_account_id: "sample", ...form } as never,
    recipientName: "Sample client",
    payUrl: "#",
  });

  return (
    <AppShell>
      <PageHeader
        title="Invoice branding"
        description="Applied to invoice emails, overdue reminders and the print/PDF output for this workspace."
        actions={
          <Button size="sm" onClick={() => save.mutate()} disabled={!subId || save.isPending}>
            {save.isPending ? "Saving…" : "Save branding"}
          </Button>
        }
      />
      <SettingsNav />
      <PageBody>
        {q.isLoading ? (
          <PanelSkeleton />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border bg-card p-5">
              <div className="space-y-1.5">
                <Label htmlFor="business">Business name</Label>
                <Input
                  id="business"
                  value={form.business_name ?? ""}
                  onChange={(e) => set({ business_name: e.target.value })}
                  placeholder="Click Away Finance"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={form.logo_url ?? ""}
                  onChange={(e) => set({ logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent">Accent colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="accent"
                    type="color"
                    className="size-9 cursor-pointer rounded border bg-background"
                    value={safeColor(form.accent_color)}
                    onChange={(e) => set({ accent_color: e.target.value })}
                  />
                  <Input
                    value={form.accent_color ?? ""}
                    onChange={(e) => set({ accent_color: e.target.value })}
                    placeholder="#4f46e5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Business address</Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={form.address ?? ""}
                  onChange={(e) => set({ address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay">Payment instructions</Label>
                <Textarea
                  id="pay"
                  rows={3}
                  value={form.payment_instructions ?? ""}
                  onChange={(e) => set({ payment_instructions: e.target.value })}
                  placeholder="Bank transfer to… or pay online with the button above."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms">Terms</Label>
                <Textarea
                  id="terms"
                  rows={3}
                  value={form.terms ?? ""}
                  onChange={(e) => set({ terms: e.target.value })}
                  placeholder="Payment due within 14 days."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer">Footer note</Label>
                <Textarea
                  id="footer"
                  rows={2}
                  value={form.footer_note ?? ""}
                  onChange={(e) => set({ footer_note: e.target.value })}
                  placeholder="Thank you for your business."
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Live preview</div>
              <iframe
                title="Invoice preview"
                className="h-[720px] w-full rounded-xl border bg-white"
                srcDoc={preview}
              />
            </div>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
