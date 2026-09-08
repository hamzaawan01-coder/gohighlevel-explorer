import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LIFECYCLE_STAGES, type Contact, type ContactInput, type LifecycleStage } from "@/lib/contacts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { useTenancy } from "@/lib/tenancy";
import { fetchCustomFields, type CustomFieldDef } from "@/lib/custom-fields";

export function ContactDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Contact | null;
  onSubmit: (input: ContactInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ContactInput>({});
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const subId = useTenancy((s) => s.currentSubAccountId);
  const customFieldsQuery = useQuery({
    queryKey: ["custom-fields", subId, "contacts"],
    queryFn: () => fetchCustomFields(subId!, "contacts"),
    enabled: open && !!subId,
  });
  const defs: CustomFieldDef[] = customFieldsQuery.data ?? [];

  function setCustom(key: string, value: string | number | boolean | null) {
    setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [key]: value } }));
  }

  useEffect(() => {
    if (open) {
      setForm({
        first_name: initial?.first_name ?? "",
        last_name: initial?.last_name ?? "",
        email: initial?.email ?? "",
        phone: initial?.phone ?? "",
        company: initial?.company ?? "",
        tags: initial?.tags ?? [],
        notes: initial?.notes ?? "",
        lifecycle_stage: initial?.lifecycle_stage ?? "lead",
        lead_source: initial?.lead_source ?? "",
        custom_fields: (initial?.custom_fields ?? {}) as Record<string, string | number | boolean | null>,
      });
      setTagInput("");
    }
  }, [open, initial]);

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if ((form.tags ?? []).includes(t)) {
      setTagInput("");
      return;
    }
    setForm((f) => ({ ...f, tags: [...(f.tags ?? []), t] }));
    setTagInput("");
  }

  function removeTag(t: string) {
    setForm((f) => ({ ...f, tags: (f.tags ?? []).filter((x) => x !== t) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        first_name: form.first_name?.toString().trim() || null,
        last_name: form.last_name?.toString().trim() || null,
        email: form.email?.toString().trim() || null,
        phone: form.phone?.toString().trim() || null,
        company: form.company?.toString().trim() || null,
        notes: form.notes?.toString().trim() || null,
        lead_source: form.lead_source?.toString().trim() || null,
        lifecycle_stage: form.lifecycle_stage ?? "lead",
        custom_fields: form.custom_fields ?? {},
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={form.first_name ?? ""}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={form.last_name ?? ""}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={form.company ?? ""}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lifecycle_stage">Lifecycle stage</Label>
              <Select
                value={form.lifecycle_stage ?? "lead"}
                onValueChange={(v) => setForm({ ...form, lifecycle_stage: v as LifecycleStage })}
              >
                <SelectTrigger id="lifecycle_stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_source">Lead source</Label>
              <Input
                id="lead_source"
                placeholder="Referral, Website, Ad…"
                value={form.lead_source ?? ""}
                onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {(form.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-[11px]"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="vip, lead, partner…"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
          </div>
          {defs.length > 0 && (
            <div className="space-y-3 border-t border-border pt-3">
              {defs.map((d) => {
                const raw = (form.custom_fields ?? {})[d.key];
                const id = `cf_${d.key}`;
                return (
                  <div key={d.id} className="space-y-2">
                    <Label htmlFor={id}>
                      {d.label}
                      {d.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {d.field_type === "textarea" ? (
                      <Textarea
                        id={id}
                        rows={2}
                        required={d.required}
                        value={raw == null ? "" : String(raw)}
                        onChange={(e) => setCustom(d.key, e.target.value)}
                      />
                    ) : d.field_type === "select" ? (
                      <Select
                        value={raw == null || raw === "" ? undefined : String(raw)}
                        onValueChange={(v) => setCustom(d.key, v)}
                      >
                        <SelectTrigger id={id}>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {d.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : d.field_type === "checkbox" ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={!!raw} onCheckedChange={(v) => setCustom(d.key, v)} />
                        <span className="text-xs text-muted-foreground">{raw ? "Yes" : "No"}</span>
                      </div>
                    ) : (
                      <Input
                        id={id}
                        type={d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"}
                        required={d.required}
                        value={raw == null ? "" : String(raw)}
                        onChange={(e) =>
                          setCustom(
                            d.key,
                            d.field_type === "number"
                              ? e.target.value === ""
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
