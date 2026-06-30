import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Contact, ContactInput } from "@/lib/contacts";
import { X } from "lucide-react";

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
