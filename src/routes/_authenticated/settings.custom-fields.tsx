import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SettingsNav } from "@/components/SettingsNav";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenancy } from "@/lib/tenancy";
import {
  CURRENCIES,
  FIELD_TYPES,
  createCustomField,
  deleteCustomField,
  fetchCustomFields,
  fetchDefaultCurrency,
  updateCustomField,
  updateDefaultCurrency,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";

export const Route = createFileRoute("/_authenticated/settings/custom-fields")({
  head: () => ({
    meta: [
      { title: "Currency & custom fields | Click Away CRM" },
      {
        name: "description",
        content:
          "Choose the currency used across deals and invoices, and build your own extra contact fields.",
      },
      { property: "og:title", content: "Currency & custom fields | Click Away CRM" },
      {
        property: "og:description",
        content: "Set your account currency and add your own contact fields without any code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomFieldsSettings,
});

function CustomFieldsSettings() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();

  const currencyQ = useQuery({
    queryKey: ["default-currency", subId],
    queryFn: () => fetchDefaultCurrency(subId!),
    enabled: !!subId,
  });

  const fieldsQ = useQuery({
    queryKey: ["custom-fields", subId, "contacts"],
    queryFn: () => fetchCustomFields(subId!, "contacts"),
    enabled: !!subId,
  });

  const currencyMut = useMutation({
    mutationFn: (code: string) => updateDefaultCurrency(subId!, code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["default-currency", subId] });
      toast.success("Currency saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields = fieldsQ.data ?? [];
  const invalidateFields = () => qc.invalidateQueries({ queryKey: ["custom-fields", subId, "contacts"] });

  const createMut = useMutation({
    mutationFn: (input: { label: string; field_type: CustomFieldType; options: string[]; required: boolean }) =>
      createCustomField({ subAccountId: subId!, ...input, position: fields.length }),
    onSuccess: () => {
      invalidateFields();
      toast.success("Field added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateCustomField>[1] }) =>
      updateCustomField(id, patch),
    onSuccess: invalidateFields,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomField(id),
    onSuccess: () => {
      invalidateFields();
      toast.success("Field removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);

  const newOptions = useMemo(
    () => optionsText.split(/[\n,]/).map((o) => o.trim()).filter(Boolean),
    [optionsText],
  );

  function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !subId) return;
    if (type === "select" && newOptions.length === 0) {
      toast.error("Add at least one dropdown choice");
      return;
    }
    createMut.mutate({ label: label.trim(), field_type: type, options: newOptions, required });
    setLabel("");
    setOptionsText("");
    setRequired(false);
    setType("text");
  }

  function move(field: CustomFieldDef, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === field.id);
    const swap = fields[idx + dir];
    if (!swap) return;
    updateMut.mutate({ id: field.id, patch: { position: swap.position } });
    updateMut.mutate({ id: swap.id, patch: { position: field.position } });
  }

  return (
    <AppShell sidebar={<SettingsNav />}>
      <PageHeader
        title="Currency & custom fields"
        description="Pick the currency shown on deals and invoices, and create your own extra contact fields."
      />
      <PageBody>
        <div className="space-y-8 max-w-2xl">
          {/* Currency */}
          <section className="rounded-lg border border-border p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Account currency</h2>
              <p className="text-xs text-muted-foreground">
                Used for new deals, totals and new invoices. Existing records keep the currency they were
                saved with, and you can still pick a different currency on an individual deal.
              </p>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={currencyQ.data ?? "GBP"}
                onValueChange={(v) => currencyMut.mutate(v)}
                disabled={!subId || currencyQ.isLoading}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Custom fields */}
          <section className="rounded-lg border border-border p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Extra contact fields</h2>
              <p className="text-xs text-muted-foreground">
                Anything you add here shows up on the contact form and on the contact’s overview.
              </p>
            </div>

            {fieldsQ.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : fields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No extra fields yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {fields.map((f, i) => (
                  <li key={f.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex flex-col text-muted-foreground">
                      <button
                        type="button"
                        aria-label={`Move ${f.label} up`}
                        disabled={i === 0}
                        onClick={() => move(f, -1)}
                        className="text-[10px] disabled:opacity-30 hover:text-foreground"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${f.label} down`}
                        disabled={i === fields.length - 1}
                        onClick={() => move(f, 1)}
                        className="text-[10px] disabled:opacity-30 hover:text-foreground"
                      >
                        ▼
                      </button>
                    </div>
                    <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={f.label}
                        onChange={(e) => updateMut.mutate({ id: f.id, patch: { label: e.target.value } })}
                        className="h-8 text-xs"
                        aria-label={`Label for ${f.label}`}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {FIELD_TYPES.find((t) => t.value === f.field_type)?.label}
                        {f.field_type === "select" && f.options.length > 0 && ` · ${f.options.join(", ")}`}
                        {f.required && " · required"}
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                      Required
                      <Switch
                        checked={f.required}
                        onCheckedChange={(v) => updateMut.mutate({ id: f.id, patch: { required: v } })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove "${f.label}"? Values already saved on contacts stay in place.`))
                          deleteMut.mutate(f.id);
                      }}
                      aria-label={`Remove ${f.label}`}
                      className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addField} className="space-y-3 border-t border-border pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-label">Field name</Label>
                  <Input
                    id="new-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Job title, Address, Birthday…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-type">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
                    <SelectTrigger id="new-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {type === "select" && (
                <div className="space-y-2">
                  <Label htmlFor="new-options">Choices</Label>
                  <Input
                    id="new-options"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Small, Medium, Large"
                  />
                  <p className="text-[10px] text-muted-foreground">Separate each choice with a comma.</p>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={required} onCheckedChange={setRequired} />
                Make this field required
              </label>
              <Button type="submit" disabled={!label.trim() || createMut.isPending}>
                <Plus className="size-3.5" /> Add field
              </Button>
            </form>
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}
