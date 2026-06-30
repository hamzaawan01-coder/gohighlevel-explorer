import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Stage } from "@/lib/pipeline";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { useTenancy } from "@/lib/tenancy";
import { useQuery } from "@tanstack/react-query";

const NO_CONTACT = "__none__";

export function NewDealDialog({
  open,
  onOpenChange,
  stages,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  onCreate: (input: {
    title: string;
    value: number;
    stage_id: string;
    contact_id: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState<string>(stages[0]?.id ?? "");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setValue("");
      setStageId(stages[0]?.id ?? "");
      setContactId(NO_CONTACT);
    }
  }, [open, stages]);

  const subId = useTenancy((s) => s.currentSubAccountId);
  const contactsQuery = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: open && !!subId,
  });

  const contacts = contactsQuery.data ?? [];
  const contactOptions = useMemo(
    () =>
      contacts.map((c: Contact) => ({
        id: c.id,
        label:
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.email ||
          c.company ||
          "Unnamed",
      })),
    [contacts],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !stageId) return;
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        value: Number(value) || 0,
        stage_id: stageId,
        contact_id: contactId === NO_CONTACT ? null : contactId,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acme Corp — Annual retainer"
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="value">Value (USD)</Label>
              <Input
                id="value"
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Link a contact (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>— None —</SelectItem>
                {contactOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contactOptions.length === 0 && !contactsQuery.isLoading && (
              <p className="text-[10px] text-muted-foreground">
                No contacts yet. You can add one from the Contacts page.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
