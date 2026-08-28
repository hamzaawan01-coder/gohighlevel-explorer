import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Zap, CircleDot, ListChecks, Tag, ArrowRightCircle, BellRing, Copy, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import { WorkflowTestDialog } from "@/components/WorkflowTestDialog";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchWorkflows,
  fetchWorkflowRuns,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  WORKFLOW_TRIGGERS,
  type Workflow,
  type WorkflowAction,
  type WorkflowInput,
} from "@/lib/workflows";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({
    meta: [
      { title: "Workflows — Agency Engine" },
      { name: "description", content: "Automate follow-ups, tagging, and notifications." },
    ],
  }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [testing, setTesting] = useState<Workflow | null>(null);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const wfQ = useQuery({
    queryKey: ["workflows", subId],
    queryFn: () => fetchWorkflows(subId!),
    enabled: !!subId,
  });
  const runsQ = useQuery({
    queryKey: ["workflow-runs", subId],
    queryFn: () => fetchWorkflowRuns(subId!),
    enabled: !!subId,
  });

  const createMut = useMutation({
    mutationFn: (input: WorkflowInput) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createWorkflow(input, userId, subId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<WorkflowInput> }) =>
      updateWorkflow(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
      toast.success("Workflow deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const workflows = wfQ.data ?? [];
  const runs = runsQ.data ?? [];
  const [runFilter, setRunFilter] = useState<"all" | "ok" | "error">("all");
  const filteredRuns = runs.filter((r) =>
    runFilter === "all" ? true : runFilter === "ok" ? r.status === "ok" : r.status !== "ok",
  );
  const errCount = runs.filter((r) => r.status !== "ok").length;

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-accent" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {workflows.filter((w) => w.enabled).length} active
          </span>
        </div>
      }
      headerActions={
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="flex min-h-11 sm:min-h-0 items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" /> New Workflow
        </button>
      }
    >
      <div className="h-full flex flex-col lg:flex-row">
        <h1 className="sr-only">Workflows</h1>
        <div className="flex-1 overflow-auto min-w-0">
          <QuickTemplates
            onPick={(tpl) => {
              setEditing(null);
              // Pre-load builder with a template by wrapping input creation
              createMut.mutate(tpl);
            }}
          />
          {wfQ.isError ? (
            <div className="p-6">
              <ErrorState onRetry={() => wfQ.refetch()} />
            </div>
          ) : wfQ.isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No workflows yet"
              description="Pick a quick template above, or build one from scratch."
              action={
                <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="size-3.5 mr-1.5" /> Create your first workflow
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {workflows.map((w) => (
                <li key={w.id} className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/40">
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={(v) => updateMut.mutate({ id: w.id, input: { enabled: v } })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{w.name}</p>
                      {!w.enabled && (
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          paused
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {describeWorkflow(w)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.actions.map((a, i) => (
                        <ActionChip key={i} action={a} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setTesting(w)}
                    className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Test / preview"
                  >
                    <PlayCircle className="size-3" />
                  </button>
                  <button
                    onClick={() =>
                      createMut.mutate({
                        name: `${w.name} (copy)`,
                        enabled: false,
                        trigger_type: w.trigger_type,
                        trigger_config: w.trigger_config,
                        actions: w.actions,
                      })
                    }
                    className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Duplicate"
                  >
                    <Copy className="size-3" />
                  </button>
                  <button
                    onClick={() => { setEditing(w); setDialogOpen(true); }}
                    className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${w.name}"?`)) deleteMut.mutate(w.id); }}
                    className="size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="w-80 border-l border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Recent runs
              </p>
              {errCount > 0 && (
                <span className="text-[10px] font-mono text-destructive">{errCount} error{errCount === 1 ? "" : "s"}</span>
              )}
            </div>
            <div className="flex gap-1">
              {(["all", "ok", "error"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRunFilter(k)}
                  className={
                    "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-colors " +
                    (runFilter === k
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filteredRuns.length === 0 ? (
              <div className="p-4 text-[11px] text-muted-foreground italic">
                {runs.length === 0 ? "No runs yet." : "No runs match this filter."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredRuns.map((r) => {
                  const wf = workflows.find((w) => w.id === r.workflow_id);
                  return (
                    <li key={r.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CircleDot
                          className={"size-3 " + (r.status === "ok" ? "text-accent" : "text-destructive")}
                        />
                        <p className="text-xs font-medium truncate flex-1">{wf?.name ?? "Workflow"}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                        {formatDistanceToNow(new Date(r.ran_at), { addSuffix: true })}
                        {r.error ? <span className="text-destructive"> · {r.error}</span> : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <WorkflowBuilder
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) await updateMut.mutateAsync({ id: editing.id, input });
          else await createMut.mutateAsync(input);
        }}
      />
      <WorkflowTestDialog
        open={!!testing}
        onOpenChange={(o) => { if (!o) setTesting(null); }}
        workflow={testing}
      />
    </AppShell>
  );
}

function ActionChip({ action }: { action: WorkflowAction }) {
  const config = (() => {
    switch (action.type) {
      case "create_task":
        return { icon: ListChecks, label: action.title || "Task", tone: "bg-primary/10 text-primary" };
      case "set_contact_stage":
        return { icon: ArrowRightCircle, label: `→ ${action.stage}`, tone: "bg-accent/15 text-accent" };
      case "add_contact_tag":
        return { icon: Tag, label: action.tag || "tag", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
      case "create_notification":
        return { icon: BellRing, label: action.title || "Notify", tone: "bg-secondary text-foreground" };
      case "send_email":
        return { icon: BellRing, label: action.subject || "Email", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
      case "send_sms":
        return { icon: BellRing, label: (action.body ?? "SMS").slice(0, 20), tone: "bg-green-500/10 text-green-600 dark:text-green-400" };
      default:
        return { icon: BellRing, label: "Action", tone: "bg-secondary text-foreground" };
    }
  })();
  const Icon = config.icon;
  return (
    <span className={"inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded max-w-[160px] " + config.tone}>
      <Icon className="size-2.5 shrink-0" />
      <span className="truncate">{config.label}</span>
    </span>
  );
}

function describeWorkflow(w: Workflow): string {
  const trig = WORKFLOW_TRIGGERS.find((t) => t.value === w.trigger_type)?.label ?? w.trigger_type;
  const cfg = w.trigger_config as Record<string, string>;
  let when = `When ${trig.toLowerCase()}`;
  if (w.trigger_type === "contact.stage_changed" && cfg.to_stage) when += ` to “${cfg.to_stage}”`;
  if (w.trigger_type === "task.due_soon" && cfg.hours) when += ` (within ${cfg.hours}h)`;
  if (w.trigger_type === "contact.stale" && cfg.days) when += ` (after ${cfg.days} days)`;
  const parts: string[] = w.actions.map((a) => {
    switch (a.type) {
      case "create_task":
        return `create a task “${a.title}”`;
      case "set_contact_stage":
        return `move contact to ${a.stage}`;
      case "add_contact_tag":
        return `tag contact “${a.tag}”`;
      case "create_notification":
        return `send an in-app notification`;
      case "send_email":
        return `email the contact “${a.subject}”`;
      case "send_sms":
        return `text the contact`;
      default:
        return "run an action";
    }
  });
  const then = parts.length === 0
    ? "do nothing yet."
    : parts.length === 1
    ? parts[0] + "."
    : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1] + ".";
  return `${when}, ${then}`;
}



type QuickTemplate = { key: string; group: string; label: string; description: string; input: WorkflowInput };

const QUICK_TEMPLATES: QuickTemplate[] = [
  // ── New leads / opportunities ──
  {
    key: "new-lead-sms", group: "New leads",
    label: "New opportunity → SMS the customer",
    description: "Text the linked contact the moment a new deal is added.",
    input: {
      name: "New opportunity — SMS the customer", enabled: true,
      trigger_type: "deal.created", trigger_config: {},
      actions: [{ type: "send_sms", body: "Hi {{contact.first_name}}! Thanks for your interest in {{deal.name}} — we've received your enquiry and someone will be in touch shortly." }],
    },
  },
  {
    key: "new-lead-email", group: "New leads",
    label: "New opportunity → Email the customer",
    description: "Send a branded acknowledgement email when a new opportunity comes in.",
    input: {
      name: "New opportunity — Email the customer", enabled: true,
      trigger_type: "deal.created", trigger_config: {},
      actions: [{
        type: "send_email",
        subject: "We got your enquiry, {{contact.first_name}}",
        body_text: "Hi {{contact.first_name}},\n\nThanks for reaching out about {{deal.name}} — we've received your enquiry and someone from our team will follow up shortly.\n\n— The team",
        body_html: "<p>Hi {{contact.first_name}},</p><p>Thanks for reaching out about {{deal.name}} — we've received your enquiry and someone from our team will follow up shortly.</p><p>— The team</p>",
      }],
    },
  },
  {
    key: "new-lead-notify-owner", group: "New leads",
    label: "New opportunity → Notify the owner",
    description: "Ping the owner in-app the moment a new deal lands.",
    input: {
      name: "New opportunity — notify owner", enabled: true,
      trigger_type: "deal.created", trigger_config: {},
      actions: [{ type: "create_notification", title: "New opportunity: {{deal.name}}", body: "From {{contact.full_name}} ({{contact.email}})" }],
    },
  },
  {
    key: "new-lead-followup-task", group: "New leads",
    label: "New opportunity → Create a follow-up task",
    description: "Assign a same-day follow-up task to the owner.",
    input: {
      name: "New opportunity — follow-up task", enabled: true,
      trigger_type: "deal.created", trigger_config: {},
      actions: [{ type: "create_task", title: "Follow up with {{contact.first_name}} about {{deal.name}}", priority: "high", due_in_days: 0 }],
    },
  },

  // ── Deal stage changes ──
  {
    key: "stage-changed-sms", group: "Deal updates",
    label: "Deal stage changed → SMS the customer",
    description: "Notify the customer whenever their opportunity moves to a new stage.",
    input: {
      name: "Deal stage changed — SMS the customer", enabled: true,
      trigger_type: "deal.stage_changed", trigger_config: {},
      actions: [{ type: "send_sms", body: "Hi {{contact.first_name}} — there's an update on {{deal.name}}. We'll be in touch shortly with next steps." }],
    },
  },
  {
    key: "stage-changed-email", group: "Deal updates",
    label: "Deal stage changed → Email the customer",
    description: "Send an email update whenever the deal advances to a new stage.",
    input: {
      name: "Deal stage changed — Email the customer", enabled: true,
      trigger_type: "deal.stage_changed", trigger_config: {},
      actions: [{
        type: "send_email",
        subject: "An update on {{deal.name}}",
        body_text: "Hi {{contact.first_name}},\n\nThere's an update on your enquiry ({{deal.name}}). We'll follow up shortly with next steps.\n\n— The team",
      }],
    },
  },

  // ── New contact / lifecycle ──
  {
    key: "new-contact-welcome-email", group: "New contacts",
    label: "New contact → Welcome email",
    description: "Send a welcome email as soon as a contact is created.",
    input: {
      name: "New contact — welcome email", enabled: true,
      trigger_type: "contact.created", trigger_config: {},
      actions: [{
        type: "send_email",
        subject: "Welcome, {{contact.first_name}}",
        body_text: "Hi {{contact.first_name}},\n\nThanks for joining us. If you have any questions, just reply to this email.\n\n— The team",
      }],
    },
  },
  {
    key: "new-contact-tag-lead", group: "New contacts",
    label: "New contact → Tag as lead",
    description: "Auto-tag every new contact so you can filter them later.",
    input: {
      name: "New contact — tag as lead", enabled: true,
      trigger_type: "contact.created", trigger_config: {},
      actions: [{ type: "add_contact_tag", tag: "new-lead" }],
    },
  },
  {
    key: "contact-mql-sms", group: "Contact stage",
    label: "Contact became MQL → SMS",
    description: "Text a contact when they hit the MQL stage.",
    input: {
      name: "Contact became MQL — SMS", enabled: true,
      trigger_type: "contact.stage_changed", trigger_config: { to_stage: "mql" },
      actions: [{ type: "send_sms", body: "Hi {{contact.first_name}} — thanks for engaging with us! Would you like to book a quick chat?" }],
    },
  },
  {
    key: "contact-customer-thankyou", group: "Contact stage",
    label: "Contact became customer → Thank-you email",
    description: "Send a warm thank-you when a contact becomes a customer.",
    input: {
      name: "Contact became customer — thank you", enabled: true,
      trigger_type: "contact.stage_changed", trigger_config: { to_stage: "customer" },
      actions: [{
        type: "send_email",
        subject: "Welcome aboard, {{contact.first_name}}!",
        body_text: "Hi {{contact.first_name}},\n\nWelcome — we're really glad to have you as a customer. Let us know how we can help.\n\n— The team",
      }],
    },
  },

  // ── Form submissions ──
  {
    key: "form-submitted-email", group: "Forms",
    label: "Form submitted → Confirmation email",
    description: "Confirm the submission automatically over email.",
    input: {
      name: "Form submitted — confirmation email", enabled: true,
      trigger_type: "form.submitted", trigger_config: {},
      actions: [{
        type: "send_email",
        subject: "Thanks — we got your submission",
        body_text: "Hi {{contact.first_name}},\n\nThanks for submitting the form. Someone will get back to you shortly.\n\n— The team",
      }],
    },
  },
  {
    key: "form-submitted-task", group: "Forms",
    label: "Form submitted → Follow-up task",
    description: "Create a task so nothing slips through.",
    input: {
      name: "Form submitted — follow-up task", enabled: true,
      trigger_type: "form.submitted", trigger_config: {},
      actions: [{ type: "create_task", title: "Reply to {{contact.first_name}} form submission", priority: "high", due_in_days: 1 }],
    },
  },

  // ── Housekeeping / scheduled ──
  {
    key: "stale-contact-nudge", group: "Housekeeping",
    label: "Stale contact → Re-engagement email",
    description: "Reach out to contacts with no activity in 30 days.",
    input: {
      name: "Stale contact — re-engagement", enabled: true,
      trigger_type: "contact.stale", trigger_config: { days: "30" },
      actions: [{
        type: "send_email",
        subject: "Still interested, {{contact.first_name}}?",
        body_text: "Hi {{contact.first_name}},\n\nWe haven't heard from you in a while — just checking in to see if there's anything we can help with.\n\n— The team",
      }],
    },
  },
  {
    key: "task-due-soon-notify", group: "Housekeeping",
    label: "Task due soon → Notify owner",
    description: "Ping the owner 24 hours before a task is due.",
    input: {
      name: "Task due soon — notify owner", enabled: true,
      trigger_type: "task.due_soon", trigger_config: { hours: "24" },
      actions: [{ type: "create_notification", title: "Task due soon", body: "You have a task due within 24 hours." }],
    },
  },
  {
    key: "task-completed-notify", group: "Housekeeping",
    label: "Task completed → In-app notification",
    description: "Track completions in the notification feed.",
    input: {
      name: "Task completed — notify", enabled: true,
      trigger_type: "task.completed", trigger_config: {},
      actions: [{ type: "create_notification", title: "Task completed", body: "A task was marked done." }],
    },
  },
];

function QuickTemplates({ onPick }: { onPick: (input: WorkflowInput) => void }) {
  const [openGallery, setOpenGallery] = useState(false);
  const groups = Array.from(new Set(QUICK_TEMPLATES.map((t) => t.group)));
  const featured = QUICK_TEMPLATES.slice(0, 4);
  return (
    <div className="px-6 py-4 border-b border-border bg-secondary/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="size-3 text-accent" />
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Quick templates — {QUICK_TEMPLATES.length} recipes
          </p>
        </div>
        <button
          onClick={() => setOpenGallery((v) => !v)}
          className="text-[10px] font-mono uppercase tracking-wider text-primary hover:underline"
        >
          {openGallery ? "Show less" : "Browse all"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        One-click automations. Bodies use personalization tokens like <code className="font-mono text-[10px] bg-secondary px-1 rounded">{"{{contact.first_name}}"}</code> and are editable after adding. Messaging templates require an SMS/email provider in Settings → Integrations.
      </p>
      {openGallery ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g}>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{g}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {QUICK_TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <TemplateCard key={t.key} t={t} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {featured.map((t) => <TemplateCard key={t.key} t={t} onPick={onPick} />)}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ t, onPick }: { t: QuickTemplate; onPick: (input: WorkflowInput) => void }) {
  return (
    <button
      onClick={() => onPick(t.input)}
      className="text-left rounded-md border border-border bg-card px-3 py-2 hover:border-primary/60 hover:bg-secondary/50 transition-colors"
    >
      <p className="text-xs font-medium">{t.label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
    </button>
  );
}
