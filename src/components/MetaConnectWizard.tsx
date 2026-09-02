import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  startMetaOAuth,
  getMetaConnection,
  refreshMetaAccounts,
  updateMetaPage,
} from "@/lib/meta.functions";
import { MetaLeadFormRouting } from "@/components/MetaLeadFormRouting";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { beginOAuthHandoff } from "@/lib/oauth-handoff";
import { toast } from "sonner";
import {
  Facebook,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
} from "lucide-react";

type PageRow = {
  id: string;
  page_id: string;
  page_name: string;
  category: string | null;
  instagram_business_account_id: string | null;
  webhook_subscribed: boolean;
  route_messenger_to_inbox: boolean;
  route_instagram_to_inbox: boolean;
  sync_lead_ads: boolean;
};

const DISMISS_KEY = "meta-wizard-dismissed.v1";

function loadDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Three-step self-serve onboarding so a non-technical client can connect their
 * own Facebook without help: connect → choose pages → decide where leads land.
 */
export function MetaConnectWizard({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMetaConnection);
  const startFn = useServerFn(startMetaOAuth);
  const refreshFn = useServerFn(refreshMetaAccounts);
  const updatePageFn = useServerFn(updateMetaPage);

  const [step, setStep] = useState(1);
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed());

  const q = useQuery({
    queryKey: ["meta-connection", subId],
    queryFn: () => getFn({ data: { subAccountId: subId } }),
  });

  const conn = q.data?.connection ?? null;
  const pages = (q.data?.pages ?? []) as PageRow[];
  const readyPages = useMemo(
    () => pages.filter((p) => p.webhook_subscribed && (p.route_messenger_to_inbox || p.sync_lead_ads)),
    [pages],
  );

  // Jump the client to the first unfinished step whenever state changes.
  useEffect(() => {
    if (!conn) setStep(1);
    else if (readyPages.length === 0) setStep(2);
  }, [conn, readyPages.length]);

  const connect = useMutation({
    mutationFn: () => {
      const handoff = beginOAuthHandoff();
      return startFn({ data: { subAccountId: subId } }).then((res) => ({ ...res, handoff }));
    },
    onSuccess: (res: { url: string; handoff: (url: string) => void }) => {
      // Facebook blocks iframe rendering, so open it in a top-level tab.
      res.handoff(res.url);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const refresh = useMutation({
    mutationFn: () => refreshFn({ data: { subAccountId: subId } }),
    onSuccess: () => {
      toast.success("Pulled your latest Pages and ad accounts");
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePage = useMutation({
    mutationFn: (v: { page: PageRow; messages?: boolean; leads?: boolean }) =>
      updatePageFn({
        data: {
          pageRowId: v.page.id,
          subAccountId: subId,
          subscribe: true,
          route_messenger_to_inbox: v.messages ?? v.page.route_messenger_to_inbox,
          route_instagram_to_inbox: v.page.instagram_business_account_id
            ? (v.messages ?? v.page.route_instagram_to_inbox)
            : false,
          sync_lead_ads: v.leads ?? v.page.sync_lead_ads,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-connection", subId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const enableAll = useMutation({
    mutationFn: async () => {
      const id = toast.loading(`Setting up 0 / ${pages.length} pages…`);
      let ok = 0;
      const failures: string[] = [];
      for (const [i, p] of pages.entries()) {
        toast.loading(`Setting up ${i + 1} / ${pages.length} — ${p.page_name}`, { id });
        try {
          await updatePageFn({
            data: {
              pageRowId: p.id,
              subAccountId: subId,
              subscribe: true,
              route_messenger_to_inbox: true,
              route_instagram_to_inbox: Boolean(p.instagram_business_account_id),
              sync_lead_ads: true,
            },
          });
          ok++;
        } catch (e) {
          failures.push(`${p.page_name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      toast.dismiss(id);
      return { ok, failures };
    },
    onSuccess: ({ ok, failures }) => {
      if (ok > 0) toast.success(`${ok} page${ok === 1 ? "" : "s"} ready`);
      if (failures.length > 0) toast.error(`${failures.length} failed — ${failures[0]}`);
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = Boolean(conn) && readyPages.length > 0;
  if (dismissed.includes(subId) && complete) return null;

  const dismiss = () => {
    const next = Array.from(new Set([...dismissed, subId]));
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* private mode — fine, it just reappears next visit */
    }
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold">Facebook setup — 3 quick steps</h3>
            <p className="text-xs text-muted-foreground">
              Connect your own Facebook, pick which Pages to use, then choose where leads land.
            </p>
          </div>
        </div>
        {complete && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide setup wizard"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
        {[
          { n: 1, label: "Connect", done: Boolean(conn) },
          { n: 2, label: "Choose Pages", done: readyPages.length > 0 },
          { n: 3, label: "Where leads go", done: complete },
        ].map((s, i) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              step === s.n ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                s.done ? "bg-emerald-600 text-white" : "border border-border"
              }`}
            >
              {s.done ? <CheckCircle2 className="size-3" /> : s.n}
            </span>
            {s.label}
            {i < 2 && <ArrowRight className="size-3 opacity-40" />}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {step === 1 && (
          <>
            {conn ? (
              <p className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Connected as <b>{conn.meta_user_name}</b>. You can continue.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You will be taken to Facebook to log in with your own account and approve access.
                We only read the Pages, ad accounts and Lead Ad forms you allow.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                <Facebook className="size-4" />
                {conn ? "Reconnect Facebook" : connect.isPending ? "Opening…" : "Connect Facebook"}
              </Button>
              {conn && (
                <Button variant="outline" onClick={() => setStep(2)}>
                  Next <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
              >
                <RefreshCw className={`size-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
                {refresh.isPending ? "Pulling…" : "Pull my Pages"}
              </Button>
              {pages.length > 0 && (
                <Button size="sm" onClick={() => enableAll.mutate()} disabled={enableAll.isPending}>
                  <CheckCircle2 className="size-3.5" />
                  {enableAll.isPending ? "Setting up…" : `Use all ${pages.length} Pages`}
                </Button>
              )}
            </div>
            {pages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No Pages yet — click <b>Pull my Pages</b> after connecting.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {pages.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 p-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.page_name}</span>
                    {p.webhook_subscribed && (
                      <Badge variant="secondary" className="text-[10px]">
                        Live
                      </Badge>
                    )}
                    <label className="flex items-center gap-1.5">
                      <Switch
                        checked={p.route_messenger_to_inbox}
                        onCheckedChange={(v) => togglePage.mutate({ page: p, messages: v })}
                      />
                      Messages
                    </label>
                    <label className="flex items-center gap-1.5">
                      <Switch
                        checked={p.sync_lead_ads}
                        onCheckedChange={(v) => togglePage.mutate({ page: p, leads: v })}
                      />
                      Leads
                    </label>
                  </div>
                ))}
                {pages.length > 25 && (
                  <p className="p-2.5 text-[11px] text-muted-foreground">
                    Showing 25 of {pages.length} — use <b>Use all Pages</b> or the Channels tab
                    below for the rest.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStep(3)}>
                Next <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-xs text-muted-foreground">
              Pick the pipeline and stage each Lead Ad form should create opportunities in. Leave
              blank to use your default pipeline's first stage.
            </p>
            <MetaLeadFormRouting subId={subId} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              {complete && (
                <Button size="sm" onClick={dismiss}>
                  <CheckCircle2 className="size-3.5" /> Finish
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
