import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Plus, Star, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SettingsNav } from "@/components/SettingsNav";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PanelSkeleton } from "@/components/ui/states";
import { useTenancy } from "@/lib/tenancy";
import {
  archiveInvoiceTemplate,
  createInvoiceTemplate,
  duplicateInvoiceTemplate,
  fetchInvoiceTemplates,
  saveTemplateAsNewVersion,
  setDefaultInvoiceTemplate,
  templateBranding,
  updateInvoiceTemplate,
  type InvoiceTemplate,
  type TemplatePatch,
} from "@/lib/invoice-templates";
import { renderInvoiceHtml, safeColor } from "@/lib/invoice-render";
import type { Invoice, InvoiceItem } from "@/lib/invoices";

export const Route = createFileRoute("/_authenticated/settings/invoices")({
  head: () => ({
    meta: [
      { title: "Invoice templates — Settings" },
      {
        name: "description",
        content:
          "Create and version invoice template variants — logo, colours, payment instructions, terms and footer — and pick a workspace default.",
      },
      { property: "og:title", content: "Invoice templates — Settings" },
      {
        property: "og:description",
        content: "Save multiple branding variants per workspace and choose which one each invoice uses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceTemplatesPage,
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
} as unknown as Invoice;

const SAMPLE_ITEMS = [
  { id: "1", description: "Marketing retainer", quantity: 1, unit_price: 800 },
  { id: "2", description: "Ad management", quantity: 4, unit_price: 50 },
] as unknown as InvoiceItem[];

function InvoiceTemplatesPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplatePatch>({});

  const q = useQuery({
    queryKey: ["invoice-templates", subId],
    queryFn: () => fetchInvoiceTemplates(subId!),
    enabled: !!subId,
  });

  const templates = q.data ?? [];
  const selected: InvoiceTemplate | null =
    templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setForm({
      name: selected.name,
      business_name: selected.business_name,
      logo_url: selected.logo_url,
      accent_color: selected.accent_color,
      address: selected.address,
      payment_instructions: selected.payment_instructions,
      terms: selected.terms,
      footer_note: selected.footer_note,
    });
    // Reset the editor whenever a different template variant is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["invoice-templates", subId] });
    qc.invalidateQueries({ queryKey: ["invoice-template"] });
    if (id) setSelectedId(id);
  };

  const create = useMutation({
    mutationFn: () =>
      createInvoiceTemplate(subId!, {
        name: `Template ${templates.length + 1}`,
        makeDefault: templates.length === 0,
      }),
    onSuccess: (t) => {
      toast.success("Template created");
      refresh(t.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateInvoiceTemplate(selected!, `${selected!.name} copy`),
    onSuccess: (t) => {
      toast.success("Template duplicated");
      refresh(t.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => updateInvoiceTemplate(selected!.id, form),
    onSuccess: () => {
      toast.success("Template saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveVersion = useMutation({
    mutationFn: () => saveTemplateAsNewVersion(selected!, form),
    onSuccess: (t) => {
      toast.success(`Saved as version ${t.version}`);
      refresh(t.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeDefault = useMutation({
    mutationFn: () => setDefaultInvoiceTemplate(subId!, selected!.id),
    onSuccess: () => {
      toast.success("Default template updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: () => archiveInvoiceTemplate(selected!.id),
    onSuccess: () => {
      toast.success("Template archived — invoices already sent keep their version");
      setSelectedId(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: TemplatePatch) => setForm((f) => ({ ...f, ...patch }));

  const preview = useMemo(
    () =>
      renderInvoiceHtml({
        invoice: SAMPLE_INVOICE,
        items: SAMPLE_ITEMS,
        branding: { ...templateBranding(selected), ...form },
        recipientName: "Sample client",
        payUrl: "#",
      }),
    [form, selected],
  );

  return (
    <AppShell>
      <PageHeader
        title="Invoice templates"
        description="Save multiple branding variants per workspace, version them safely, and pick which one each invoice uses."
        actions={
          <Button size="sm" onClick={() => create.mutate()} disabled={!subId || create.isPending}>
            <Plus className="size-3.5" /> New template
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
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
            <aside className="space-y-2">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No templates yet — create one to brand your invoices.
                </p>
              )}
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    selected?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full border"
                      style={{ background: safeColor(t.accent_color) }}
                    />
                    <span className="truncate font-medium">{t.name}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    v{t.version}
                    {t.is_default && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        Default
                      </Badge>
                    )}
                  </span>
                </button>
              ))}
            </aside>

            {selected ? (
              <div className="space-y-4 rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveVersion.mutate()}
                    disabled={saveVersion.isPending}
                    title="Keep the current version intact for documents already sent"
                  >
                    <Check className="size-3.5" /> Save as v{selected.version + 1}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => duplicate.mutate()}>
                    <Copy className="size-3.5" /> Duplicate
                  </Button>
                  {!selected.is_default && (
                    <Button size="sm" variant="outline" onClick={() => makeDefault.mutate()}>
                      <Star className="size-3.5" /> Make default
                    </Button>
                  )}
                  {!selected.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => archive.mutate()}
                    >
                      <Trash2 className="size-3.5" /> Archive
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tname">Template name</Label>
                  <Input id="tname" value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
                </div>
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
            ) : (
              <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                Create a template to start editing.
              </div>
            )}

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
