import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Mail, MessageSquare, ListChecks, Bell, Tag, ArrowRightCircle } from "lucide-react";
import { fetchContacts } from "@/lib/contacts";
import { useTenancy } from "@/lib/tenancy";
import type { Workflow, WorkflowAction } from "@/lib/workflows";
import { renderMergeTagsPreview, type MergeContext } from "@/lib/merge-tags";

export function WorkflowTestDialog({
  open,
  onOpenChange,
  workflow,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workflow: Workflow | null;
}) {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [contactId, setContactId] = useState<string>("");

  const contactsQ = useQuery({
    queryKey: ["contacts-test", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId && open,
  });

  useEffect(() => {
    if (!open) setContactId("");
  }, [open]);

  const contacts = contactsQ.data ?? [];
  const contact = contacts.find((c) => c.id === contactId) ?? null;

  const ctx: MergeContext = useMemo(
    () => ({
      workflow: { name: workflow?.name ?? "" },
      contact: contact
        ? {
            first_name: contact.first_name ?? "",
            last_name: contact.last_name ?? "",
            full_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            company: contact.company ?? "",
          }
        : {},
      deal: { name: "Sample deal", amount: 5000 },
    }),
    [workflow, contact],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test workflow · {workflow?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-secondary/40 p-3 flex gap-2">
            <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This is a dry-run preview. It shows what each action would produce for a real
              contact — nothing is sent, no tasks are created.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Test contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a contact to preview against" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {contacts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    No contacts yet.
                  </div>
                ) : (
                  contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        c.email ||
                        "(unnamed)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {workflow && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                What would happen
              </p>
              <ul className="space-y-2">
                {workflow.actions.map((a, i) => (
                  <ActionPreview key={i} action={a} ctx={ctx} />
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionPreview({ action, ctx }: { action: WorkflowAction; ctx: MergeContext }) {
  const contact = ctx.contact ?? {};
  const meta = (() => {
    switch (action.type) {
      case "send_email": {
        const to = action.to || (contact.email as string) || "(no contact email)";
        return {
          Icon: Mail,
          title: `Email → ${to}`,
          lines: [
            `Subject: ${renderMergeTagsPreview(action.subject, ctx)}`,
            renderMergeTagsPreview(action.body_text ?? "", ctx),
          ],
        };
      }
      case "send_sms": {
        const to = action.to || (contact.phone as string) || "(no contact phone)";
        return {
          Icon: MessageSquare,
          title: `SMS → ${to}`,
          lines: [renderMergeTagsPreview(action.body, ctx)],
        };
      }
      case "create_task":
        return {
          Icon: ListChecks,
          title: "Create task",
          lines: [
            renderMergeTagsPreview(action.title, ctx),
            `Priority: ${action.priority ?? "medium"} · Due in ${action.due_in_days ?? 0} day(s)`,
          ],
        };
      case "create_notification":
        return {
          Icon: Bell,
          title: "In-app notification",
          lines: [
            renderMergeTagsPreview(action.title, ctx),
            renderMergeTagsPreview(action.body ?? "", ctx),
          ],
        };
      case "add_contact_tag":
        return { Icon: Tag, title: `Tag contact "${action.tag}"`, lines: [] };
      case "set_contact_stage":
        return { Icon: ArrowRightCircle, title: `Set contact stage → ${action.stage}`, lines: [] };
      default:
        return { Icon: Info, title: "Unknown action", lines: [] };
    }
  })();
  const Icon = meta.Icon;
  return (
    <li className="rounded border border-border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-accent" />
        <p className="text-xs font-medium">{meta.title}</p>
      </div>
      {meta.lines.map((l, i) => (
        <p key={i} className="text-[11px] text-muted-foreground whitespace-pre-wrap pl-5">
          {l || <span className="italic">(empty)</span>}
        </p>
      ))}
    </li>
  );
}
