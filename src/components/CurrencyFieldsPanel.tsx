import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsSection, SettingsRow } from "@/components/SettingsNav";
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

/**
 * Currency picker plus the build-your-own extra fields editor.
 * Used both on the settings home (inline) and on its own settings page.
 */
export function CurrencyFieldsPanel({ entity = "contacts" }: { entity?: "contacts" | "deals" }) {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"contacts" | "deals">(entity);

  const currencyQ = useQuery({
    queryKey: ["default-currency", subId],
    queryFn: () => fetchDefaultCurrency(subId!),
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

  return (
    <>
      <SettingsSection
        title="Account currency"
        description="Used for new deals, totals and new invoices. Existing records keep the currency they were saved with, and you can still pick a different currency on an individual deal."
      >
        <SettingsRow
          label="Currency"
          htmlFor="currency"
          description="Shown on deal cards, pipeline totals and new invoices."
        >
          <Select
            value={currencyQ.data ?? "GBP"}
            onValueChange={(v) => currencyMut.mutate(v)}
            disabled={!subId || currencyQ.isLoading}
          >
            <SelectTrigger id="currency" className="w-64">
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
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Your own extra fields"
        description="Anything you add here shows up on the form and on the record’s overview."
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            {(["contacts", "deals"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setTab(e)}
                className={`h-7 rounded px-2.5 text-[11px] font-medium transition-colors ${
                  tab === e
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {e === "contacts" ? "Contact fields" : "Deal fields"}
              </button>
            ))}
          </div>
        }
        padded
      >
        <FieldsEditor entity={tab} />
      </SettingsSection>
    </>
  );
}

function FieldsEditor({ entity }: { entity: "contacts" | "deals" }) {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const qc = useQueryClient();

  const fieldsQ = useQuery({
    queryKey: ["custom-fields", subId, entity],
    queryFn: () => fetchCustomFields(subId!, entity),
    enabled: !!subId,
  });
  const fields = fieldsQ.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["custom-fields", subId, entity] });

  const createMut = useMutation({
    mutationFn: (input: {
      label: string;
      field_type: CustomFieldType;
      options: string[];
      required: boolean;
    }) => createCustomField({ subAccountId: subId!, entity, ...input, position: fields.length }),
    onSuccess: () => {
      invalidate();
      toast.success("Field added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateCustomField>[1] }) =>
      updateCustomField(id, patch),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomField(id),
    onSuccess: () => {
      invalidate();
      toast.success("Field removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);

  const newOptions = useMemo(
    () =>
      optionsText
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean),
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
    <div className="space-y-4">
      {fieldsQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : fields.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No extra fields yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex flex-col text-muted-foreground">
                <button
                  type="button"
                  aria-label={`Move ${f.label} up`}
                  disabled={i === 0}
                  onClick={() => move(f, -1)}
                  className="text-[10px] hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Move ${f.label} down`}
                  disabled={i === fields.length - 1}
                  onClick={() => move(f, 1)}
                  className="text-[10px] hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Input
                  value={f.label}
                  onChange={(e) => updateMut.mutate({ id: f.id, patch: { label: e.target.value } })}
                  className="h-8 text-xs"
                  aria-label={`Label for ${f.label}`}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {FIELD_TYPES.find((t) => t.value === f.field_type)?.label}
                  {f.field_type === "select" && f.options.length > 0 && ` · ${f.options.join(", ")}`}
                  {f.required && " · required"}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                Required
                <Switch
                  checked={f.required}
                  onCheckedChange={(v) => updateMut.mutate({ id: f.id, patch: { required: v } })}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove "${f.label}"? Values already saved stay in place.`))
                    deleteMut.mutate(f.id);
                }}
                aria-label={`Remove ${f.label}`}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
            <Label htmlFor={`new-label-${entity}`}>Field name</Label>
            <Input
              id={`new-label-${entity}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Job title, Address, Birthday…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`new-type-${entity}`}>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
              <SelectTrigger id={`new-type-${entity}`}>
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
            <Label htmlFor={`new-options-${entity}`}>Choices</Label>
            <Input
              id={`new-options-${entity}`}
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
    </div>
  );
}
