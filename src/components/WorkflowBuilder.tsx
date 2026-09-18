import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import {
  WORKFLOW_TRIGGERS,
  WORKFLOW_ACTION_TYPES,
  type Workflow,
  type WorkflowAction,
  type WorkflowInput,
  type WorkflowTrigger,
} from "@/lib/workflows";
import { LIFECYCLE_STAGES, type LifecycleStage } from "@/lib/contacts";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/tasks";
import { MergeTagField } from "@/components/MergeTagField";

export function WorkflowBuilder({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Workflow | null;
  onSubmit: (input: WorkflowInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [trigger, setTrigger] = useState<WorkflowTrigger>("contact.created");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setEnabled(initial?.enabled ?? true);
    setTrigger(initial?.trigger_type ?? "contact.created");
    setTriggerConfig((initial?.trigger_config as Record<string, string>) ?? {});
    setActions(initial?.actions ?? []);
  }, [open, initial]);

  function addAction(type: WorkflowAction["type"]) {
    let a: WorkflowAction;
    switch (type) {
      case "create_task":
        a = { type, title: "Follow up with {{contact.first_name}}", priority: "medium", due_in_days: 1 };
        break;
      case "set_contact_stage":
        a = { type, stage: "mql" };
        break;
      case "add_contact_tag":
        a = { type, tag: "" };
        break;
      case "create_client":
        a = { type };
        break;
      case "create_notification":
        a = { type, title: name || "Workflow ran" };
        break;
      case "send_email":
        a = {
          type,
          subject: "Hi {{contact.first_name}}",
          body_text: "Hi {{contact.first_name}},\n\nThanks for your interest — we'll be in touch shortly.",
        };
        break;
      case "send_sms":
        a = {
          type,
          body: "Hi {{contact.first_name}}, thanks for your interest! We'll be in touch shortly.",
        };
        break;
    }
    setActions((cur) => [...cur, a]);
  }

  function updateAction(idx: number, patch: Partial<WorkflowAction>) {
    setActions((cur) => cur.map((a, i) => (i === idx ? ({ ...a, ...patch } as WorkflowAction) : a)));
  }

  function removeAction(idx: number) {
    setActions((cur) => cur.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || actions.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        enabled,
        trigger_type: trigger,
        trigger_config: triggerConfig,
        actions,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit workflow" : "New workflow"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-xs font-medium">Enabled</p>
              <p className="text-[11px] text-muted-foreground">Workflow will fire on matching events.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              When this happens
            </p>
            <Select value={trigger} onValueChange={(v) => { setTrigger(v as WorkflowTrigger); setTriggerConfig({}); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TRIGGERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trigger === "contact.stage_changed" && (
              <div className="space-y-1">
                <Label className="text-[11px]">To stage (optional filter)</Label>
                <Select
                  value={triggerConfig.to_stage ?? "any"}
                  onValueChange={(v) =>
                    setTriggerConfig(v === "any" ? {} : { to_stage: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any stage</SelectItem>
                    {LIFECYCLE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {trigger === "task.due_soon" && (
              <div className="space-y-1">
                <Label className="text-[11px]">Hours before due</Label>
                <Input
                  type="number"
                  min={1}
                  value={triggerConfig.hours ?? "24"}
                  onChange={(e) => setTriggerConfig({ hours: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Scanned every 15 minutes. Fires once per task per window.</p>
              </div>
            )}
            {trigger === "contact.stale" && (
              <div className="space-y-1">
                <Label className="text-[11px]">Days without activity</Label>
                <Input
                  type="number"
                  min={1}
                  value={triggerConfig.days ?? "30"}
                  onChange={(e) => setTriggerConfig({ days: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Scanned every 15 minutes. Fires once per contact per window.</p>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Do this
              </p>
              <Select value="" onValueChange={(v) => v && addAction(v as WorkflowAction["type"])}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="+ Add action" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_ACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {actions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No actions yet.</p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a, idx) => (
                  <li key={idx} className="rounded border border-border p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-accent">
                        {WORKFLOW_ACTION_TYPES.find((t) => t.value === a.type)?.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        aria-label="Remove action"
                        className="flex min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 items-center justify-center text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    <ActionFields action={a} onChange={(patch) => updateAction(idx, patch)} />
                  </li>
                ))}
              </ul>
            )}
            {actions.length === 0 && (
              <button
                type="button"
                onClick={() => addAction("create_task")}
                className="w-full text-xs flex items-center justify-center gap-1 py-1.5 border border-dashed border-border rounded text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3" /> Add first action
              </button>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name.trim() || actions.length === 0}>
              {submitting ? "Saving…" : initial ? "Save changes" : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActionFields({
  action,
  onChange,
}: {
  action: WorkflowAction;
  onChange: (patch: Partial<WorkflowAction>) => void;
}) {
  if (action.type === "create_task") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <MergeTagField
            label="Task title"
            value={action.title}
            onChange={(v) => onChange({ title: v } as Partial<WorkflowAction>)}
            showPreview={false}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Priority</Label>
          <Select
            value={action.priority ?? "medium"}
            onValueChange={(v) => onChange({ priority: v as TaskPriority } as Partial<WorkflowAction>)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Due in (days)</Label>
          <Input
            type="number"
            min={0}
            value={action.due_in_days ?? 1}
            onChange={(e) => onChange({ due_in_days: Number(e.target.value) } as Partial<WorkflowAction>)}
          />
        </div>
      </div>
    );
  }
  if (action.type === "set_contact_stage") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px]">New stage</Label>
        <Select
          value={action.stage}
          onValueChange={(v) => onChange({ stage: v as LifecycleStage } as Partial<WorkflowAction>)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIFECYCLE_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (action.type === "add_contact_tag") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px]">Tag</Label>
        <Input value={action.tag} onChange={(e) => onChange({ tag: e.target.value } as Partial<WorkflowAction>)} />
      </div>
    );
  }
  if (action.type === "create_client") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Creates a client record from the opportunity's contact (or reuses a matching one) and links the
        opportunity to it.
      </p>
    );
  }
  if (action.type === "create_notification") {
    return (
      <div className="space-y-2">
        <MergeTagField
          label="Title"
          value={action.title}
          onChange={(v) => onChange({ title: v } as Partial<WorkflowAction>)}
          showPreview={false}
        />
        <MergeTagField
          label="Body"
          value={action.body ?? ""}
          onChange={(v) => onChange({ body: v } as Partial<WorkflowAction>)}
          multiline
        />
      </div>
    );
  }
  if (action.type === "send_email") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-[11px]">To (optional — defaults to contact email)</Label>
          <Input value={action.to ?? ""} onChange={(e) => onChange({ to: e.target.value } as Partial<WorkflowAction>)} placeholder="leave blank for contact email" />
        </div>
        <MergeTagField
          label="Subject"
          value={action.subject}
          onChange={(v) => onChange({ subject: v } as Partial<WorkflowAction>)}
        />
        <MergeTagField
          label="Body"
          value={action.body_text ?? ""}
          onChange={(v) => onChange({ body_text: v } as Partial<WorkflowAction>)}
          multiline
        />
        <SendTimingFields action={action} onChange={onChange} />
      </div>
    );
  }
  if (action.type === "send_sms") {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-[11px]">To (optional — defaults to contact phone)</Label>
          <Input value={action.to ?? ""} onChange={(e) => onChange({ to: e.target.value } as Partial<WorkflowAction>)} placeholder="leave blank for contact phone" />
        </div>
        <MergeTagField
          label="Message"
          value={action.body}
          onChange={(v) => onChange({ body: v } as Partial<WorkflowAction>)}
          multiline
        />
        <SendTimingFields action={action} onChange={onChange} />
      </div>
    );
  }
  return null;
}

function SendTimingFields({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_email" | "send_sms" }>;
  onChange: (patch: Partial<WorkflowAction>) => void;
}) {
  const delay = action.delay_minutes ?? 0;
  const respect = action.respect_quiet_hours ?? true;
  return (
    <div className="rounded border border-dashed border-border p-2 space-y-2 bg-muted/30">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Send timing</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Wait (minutes)</Label>
          <Input
            type="number"
            min={0}
            value={delay}
            onChange={(e) => onChange({ delay_minutes: Number(e.target.value) } as Partial<WorkflowAction>)}
          />
          <p className="text-[10px] text-muted-foreground">0 = send right away.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Quiet hours</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={respect}
              onCheckedChange={(v) => onChange({ respect_quiet_hours: v } as Partial<WorkflowAction>)}
            />
            <span className="text-[11px] text-muted-foreground">
              {respect ? "Wait until morning if late" : "Send any time"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
