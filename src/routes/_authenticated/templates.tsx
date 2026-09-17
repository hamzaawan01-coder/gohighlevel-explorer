import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Mail, MessageSquare, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MergeTagField } from "@/components/MergeTagField";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import {
  fetchMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  type MessageTemplate,
  type MessageTemplateInput,
  type TemplateChannel,
} from "@/lib/message-templates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Message templates — Lead Convert" },
      {
        name: "description",
        content: "Reusable email and SMS templates with personalization tokens.",
      },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const q = useQuery({
    queryKey: ["message-templates", subId],
    queryFn: () => fetchMessageTemplates(subId!),
    enabled: !!subId,
  });

  const createMut = useMutation({
    mutationFn: (input: MessageTemplateInput) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createMessageTemplate(input, userId, subId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<MessageTemplateInput> }) =>
      updateMessageTemplate(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success("Template updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = q.data ?? [];

  return (
    <AppShell
      headerStatus={
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {templates.length} template{templates.length === 1 ? "" : "s"}
        </span>
      }
      headerActions={
        <button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="flex min-h-11 sm:min-h-0 items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" /> New Template
        </button>
      }
    >
      <div className="h-full overflow-auto">
        <h1 className="sr-only">Message templates</h1>
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-secondary/20">
          <p className="text-xs font-medium mb-1">Reusable message templates</p>
          <p className="text-[11px] text-muted-foreground">
            Save messages once and reuse them in workflows, campaigns, and manual sends. Use
            personalization tokens like <code className="font-mono text-[10px] bg-secondary px-1 rounded">{"{{contact.first_name}}"}</code>{" "}
            to auto-fill each recipient's details.
          </p>
        </div>
        {q.isError ? (
          <div className="p-6">
            <ErrorState onRetry={() => q.refetch()} />
          </div>
        ) : q.isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={5} />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No templates yet"
            description="Save a reusable email or SMS template to speed up campaigns and workflows."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5 mr-1.5" /> Create your first template
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((t) => (
              <li
                key={t.id}
                className="px-4 sm:px-6 py-4 flex items-start gap-3 sm:gap-4 hover:bg-secondary/40"
              >
                <div className="size-8 rounded bg-secondary flex items-center justify-center shrink-0">
                  {t.channel === "email" ? (
                    <Mail className="size-3.5 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {t.channel}
                    </span>
                  </div>
                  {t.subject && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Subject: {t.subject}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {t.body_text || t.body_html || <span className="italic">(no body)</span>}
                  </p>
                </div>
                <button
                  onClick={() =>
                    createMut.mutate({
                      name: `${t.name} (copy)`,
                      channel: t.channel,
                      subject: t.subject,
                      body_html: t.body_html,
                      body_text: t.body_text,
                    })
                  }
                  className="min-h-11 min-w-11 sm:size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Duplicate"
                  aria-label={`Duplicate ${t.name}`}
                >
                  <Copy className="size-3" />
                </button>
                <button
                  onClick={() => {
                    setEditing(t);
                    setDialogOpen(true);
                  }}
                  className="min-h-11 min-w-11 sm:size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Edit"
                  aria-label={`Edit ${t.name}`}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}
                  className="min-h-11 min-w-11 sm:size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Delete"
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) await updateMut.mutateAsync({ id: editing.id, input });
          else await createMut.mutateAsync(input);
          setDialogOpen(false);
        }}
      />
    </AppShell>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: MessageTemplate | null;
  onSubmit: (input: MessageTemplateInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("email");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setChannel(initial?.channel ?? "email");
    setSubject(initial?.subject ?? "");
    setBodyText(initial?.body_text ?? "");
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        channel,
        subject: channel === "email" ? subject : null,
        body_text: bodyText,
        body_html: channel === "email" ? bodyText.replace(/\n/g, "<br/>") : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {channel === "email" && (
            <MergeTagField
              label="Subject"
              value={subject}
              onChange={setSubject}
              placeholder="Hi {{contact.first_name}}, quick update"
            />
          )}
          <MergeTagField
            label={channel === "email" ? "Body" : "Message"}
            value={bodyText}
            onChange={setBodyText}
            multiline
            placeholder={
              channel === "email"
                ? "Hi {{contact.first_name}},\n\nThanks for reaching out about {{deal.name}}."
                : "Hi {{contact.first_name}}, thanks for your interest!"
            }
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : initial ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
