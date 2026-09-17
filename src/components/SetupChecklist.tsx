import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrations } from "@/lib/integrations";
import { SkeletonBlock } from "@/components/ui/states";

const DISMISS_KEY = "crm.setupChecklist.dismissed";

type Step = {
  key: string;
  label: string;
  description: string;
  to: string;
  cta: string;
  done: boolean;
};

async function countRows(table: string, subAccountId: string) {
  const { count } = await supabase
    .from(table as never)
    .select("id", { count: "exact", head: true })
    .eq("sub_account_id", subAccountId);
  return count ?? 0;
}

async function loadSetupState(subAccountId: string) {
  const [integrations, pipelines, contacts, numbers, meta] = await Promise.all([
    fetchIntegrations(subAccountId).catch(() => null),
    countRows("pipelines", subAccountId),
    countRows("contacts", subAccountId),
    countRows("twilio_phone_numbers", subAccountId).catch(() => 0),
    countRows("meta_connections", subAccountId).catch(() => 0),
  ]);
  return {
    email: !!integrations?.email_provider,
    sms: !!integrations?.sms_provider,
    pipelines,
    contacts,
    numbers,
    meta,
  };
}

/**
 * Dashboard onboarding checklist: shows what still needs connecting and a
 * completion percentage. Dismissible, and hidden automatically once complete.
 */
export function SetupChecklist({ subAccountId }: { subAccountId: string }) {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["setup-checklist", subAccountId],
    queryFn: () => loadSetupState(subAccountId),
    staleTime: 60_000,
  });

  if (dismissed) return null;

  if (isLoading || !data) {
    return (
      <section className="surface-card space-y-3 p-4">
        <SkeletonBlock className="h-3 w-40" />
        <SkeletonBlock className="h-1.5 w-full" />
        <SkeletonBlock className="h-3 w-2/3" />
      </section>
    );
  }

  const steps: Step[] = [
    {
      key: "pipeline",
      label: "Create your first pipeline",
      description: "Stages that your opportunities move through.",
      to: "/opportunities",
      cta: "Open pipelines",
      done: data.pipelines > 0,
    },
    {
      key: "contacts",
      label: "Add or import contacts",
      description: "Import a CSV or add your first contact by hand.",
      to: "/contacts",
      cta: "Go to contacts",
      done: data.contacts > 0,
    },
    {
      key: "email",
      label: "Connect an email sender",
      description: "Needed before workflows can send email.",
      to: "/settings/integrations",
      cta: "Connect email",
      done: data.email,
    },
    {
      key: "sms",
      label: "Connect SMS",
      description: "Texting for workflows, conversations and reminders.",
      to: "/settings/integrations",
      cta: "Connect SMS",
      done: data.sms,
    },
    {
      key: "number",
      label: "Get a phone number",
      description: "Calls, SMS and WhatsApp all run on your own number.",
      to: "/settings/phone-numbers",
      cta: "Browse numbers",
      done: data.numbers > 0,
    },
    {
      key: "meta",
      label: "Connect Facebook & Instagram",
      description: "Pull in Lead Ads and Messenger/Instagram DMs.",
      to: "/settings/integrations",
      cta: "Connect Meta",
      done: data.meta > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  if (pct === 100) return null;

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="setup-checklist-heading">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
            <Rocket className="size-4 text-primary" />
          </span>
          <div className="min-w-0">
            <h2 id="setup-checklist-heading" className="font-display text-sm font-bold">
              Finish setting up your workspace
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {doneCount} of {steps.length} steps done · {pct}% complete
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="setup-checklist-steps"
          >
            {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {open ? "Hide" : "Show"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Workspace setup progress"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {open ? (
        <ul id="setup-checklist-steps" className="grid gap-2 p-4 sm:grid-cols-2">
          {steps.map((s) => (
            <li
              key={s.key}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5 ${
                s.done ? "border-primary/25 bg-primary/5" : "border-border"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  s.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s.done ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{s.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {s.description}
                </span>
              </span>
              {s.done ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Done
                </span>
              ) : (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={s.to}>{s.cta}</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
