import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil, Trash2, Zap, CircleDot, ListChecks, Tag, ArrowRightCircle, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
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
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-3.5" /> New Workflow
        </button>
      }
    >
      <div className="h-full flex">
        <div className="flex-1 overflow-auto">
          <QuickTemplates
            onPick={(tpl) => {
              setEditing(null);
              // Pre-load builder with a template by wrapping input creation
              createMut.mutate(tpl);
            }}
          />
          {wfQ.isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" /><span className="text-xs">Loading…</span>
            </div>
          ) : workflows.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Zap className="size-8 opacity-40" />
              <p className="text-xs">No workflows yet — pick a template above or</p>
              <button
                onClick={() => { setEditing(null); setDialogOpen(true); }}
                className="text-xs text-primary hover:underline"
              >
                Create your first workflow
              </button>
            </div>
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      When {WORKFLOW_TRIGGERS.find((t) => t.value === w.trigger_type)?.label}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.actions.map((a, i) => (
                        <ActionChip key={i} action={a} />
                      ))}
                    </div>
                  </div>
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

const QUICK_TEMPLATES: { key: string; label: string; description: string; input: WorkflowInput }[] = [
  {
    key: "new-lead-sms",
    label: "New opportunity → SMS the customer",
    description: "Text the linked contact the moment a new deal is added.",
    input: {
      name: "New opportunity — SMS the customer",
      enabled: true,
      trigger_type: "deal.created",
      trigger_config: {},
      actions: [
        {
          type: "send_sms",
          body: "Hi! Thanks for your interest — we've received your enquiry and someone will be in touch shortly.",
        },
      ],
    },
  },
  {
    key: "new-lead-email",
    label: "New opportunity → Email the customer",
    description: "Send a branded acknowledgement email when a new opportunity comes in.",
    input: {
      name: "New opportunity — Email the customer",
      enabled: true,
      trigger_type: "deal.created",
      trigger_config: {},
      actions: [
        {
          type: "send_email",
          subject: "We got your enquiry",
          body_text: "Hi there,\n\nThanks for reaching out — we've received your enquiry and someone from our team will follow up shortly.\n\n— The team",
          body_html: "<p>Hi there,</p><p>Thanks for reaching out — we've received your enquiry and someone from our team will follow up shortly.</p><p>— The team</p>",
        },
      ],
    },
  },
  {
    key: "stage-changed-sms",
    label: "Deal stage changed → SMS the customer",
    description: "Notify the customer whenever their opportunity moves to a new stage.",
    input: {
      name: "Deal stage changed — SMS the customer",
      enabled: true,
      trigger_type: "deal.stage_changed",
      trigger_config: {},
      actions: [
        {
          type: "send_sms",
          body: "Good news — there's an update on your enquiry. We'll be in touch shortly with next steps.",
        },
      ],
    },
  },
  {
    key: "stage-changed-email",
    label: "Deal stage changed → Email the customer",
    description: "Send an email update whenever the deal advances to a new stage.",
    input: {
      name: "Deal stage changed — Email the customer",
      enabled: true,
      trigger_type: "deal.stage_changed",
      trigger_config: {},
      actions: [
        {
          type: "send_email",
          subject: "An update on your enquiry",
          body_text: "Hi there,\n\nThere's an update on your enquiry with us. We'll follow up shortly with next steps.\n\n— The team",
          body_html: "<p>Hi there,</p><p>There's an update on your enquiry with us. We'll follow up shortly with next steps.</p><p>— The team</p>",
        },
      ],
    },
  },
];

function QuickTemplates({ onPick }: { onPick: (input: WorkflowInput) => void }) {
  return (
    <div className="px-6 py-4 border-b border-border bg-secondary/20">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="size-3 text-accent" />
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Quick templates — customer response automations
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        One-click automations that message the customer linked to a deal. Recipient is the deal's contact; message body is editable after adding. Requires an SMS/email provider in Settings → Integrations.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {QUICK_TEMPLATES.map((t) => (
          <button
            key={t.key}
            onClick={() => onPick(t.input)}
            className="text-left rounded-md border border-border bg-card px-3 py-2 hover:border-primary/60 hover:bg-secondary/50 transition-colors"
          >
            <p className="text-xs font-medium">{t.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
