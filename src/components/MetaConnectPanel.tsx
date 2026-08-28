import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  startMetaOAuth,
  getMetaConnection,
  refreshMetaAccounts,
  updateMetaPage,
  updateMetaAdAccount,
  disconnectMeta,
} from "@/lib/meta.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Copy, Facebook, Instagram, BarChart3 } from "lucide-react";

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

type AdAccountRow = {
  id: string;
  ad_account_id: string;
  name: string | null;
  currency: string | null;
  use_for_reports: boolean;
};

export function MetaConnectPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMetaConnection);
  const startFn = useServerFn(startMetaOAuth);
  const refreshFn = useServerFn(refreshMetaAccounts);
  const updatePageFn = useServerFn(updateMetaPage);
  const updateAdFn = useServerFn(updateMetaAdAccount);
  const disconnectFn = useServerFn(disconnectMeta);

  const q = useQuery({
    queryKey: ["meta-connection", subId],
    queryFn: () => getFn({ data: { subAccountId: subId } }),
  });

  // Toast on OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "meta") return;
    const status = params.get("meta");
    if (status === "connected") toast.success("Facebook connected");
    else if (status === "error") toast.error(`Meta connection failed: ${params.get("message") ?? "unknown"}`);
    if (status) {
      params.delete("meta"); params.delete("message");
      const next = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
    }
  }, [qc, subId]);

  const connect = useMutation({
    mutationFn: () => startFn({ data: { subAccountId: subId } }),
    onSuccess: ({ url }) => {
      // Facebook refuses to render inside an iframe (the Lovable preview),
      // so always hand off in a top-level tab/window.
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        try {
          window.top!.location.href = url;
        } catch {
          toast.error("Popup blocked — allow popups, or open the app in a new tab and retry.");
        }
      } else {
        toast.info("Continue in the Facebook tab, then come back and click Refresh accounts.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn({ data: { subAccountId: subId } }),
    onSuccess: ({ pages, adAccounts }) => {
      toast.success(`Refreshed: ${pages} pages, ${adAccounts} ad accounts`);
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { subAccountId: subId } }),
    onSuccess: () => {
      toast.success("Disconnected Meta");
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchPage = useMutation({
    mutationFn: (v: { pageRowId: string; patch: Partial<PageRow> & { subscribe?: boolean } }) =>
      updatePageFn({ data: { pageRowId: v.pageRowId, subAccountId: subId, ...v.patch } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-connection", subId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const patchAd = useMutation({
    mutationFn: (v: { rowId: string; use_for_reports: boolean }) =>
      updateAdFn({ data: { rowId: v.rowId, subAccountId: subId, use_for_reports: v.use_for_reports } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-connection", subId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  /** One-click: subscribe every page to webhooks and route everything to the inbox. */
  const enableAll = useMutation({
    mutationFn: async () => {
      const pages = (q.data?.pages ?? []) as PageRow[];
      let ok = 0;
      const failures: string[] = [];
      for (const p of pages) {
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
      return { ok, failures };
    },
    onSuccess: ({ ok, failures }) => {
      if (ok > 0) toast.success(`Enabled ${ok} page${ok === 1 ? "" : "s"}`);
      if (failures.length > 0) toast.error(`${failures.length} failed — ${failures[0]}`);
      qc.invalidateQueries({ queryKey: ["meta-connection", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;
  const conn = data?.connection;

  if (q.isLoading) return <p className="text-xs text-muted-foreground p-4">Loading…</p>;

  return (
    <div className="space-y-6 mt-4">
      {/* Connect state */}
      <div className="rounded-md border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium flex items-center gap-2">
              <Facebook className="size-4 text-[#1877F2]" /> Meta (Facebook, Instagram, Ads)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Connect one Facebook account to route Messenger + Instagram DMs into your inbox,
              sync Lead Ads leads into Contacts, and read Meta Ads spend on the Reports page.
            </p>
          </div>
          {conn ? (
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Connected</Badge>
          ) : (
            <Badge variant="outline" className="gap-1"><AlertCircle className="size-3" /> Not connected</Badge>
          )}
        </div>

        {!conn ? (
          <Button
            onClick={() => connect.mutate()}
            disabled={connect.isPending || data?.setup?.appConfigured === false}
          >
            <Facebook className="size-4 mr-2" />
            {connect.isPending ? "Redirecting…" : "Connect Facebook"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Logged in as <span className="font-medium text-foreground">{conn.meta_user_name}</span>
              {conn.token_expires_at && (
                <> · token expires {new Date(conn.token_expires_at).toLocaleDateString()}</>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                <RefreshCw className={`size-3.5 mr-2 ${refresh.isPending ? "animate-spin" : ""}`} />
                Refresh pages & ad accounts
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm("Disconnect Meta from this workspace?")) disconnect.mutate();
              }}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>

      {!conn && data?.setup && <MetaSetupGuide setup={data.setup} />}



      {conn && (
        <>
          {/* Webhook URL — must be added manually inside Meta's Webhooks product UI */}
          <div className="rounded-md border border-border p-5 space-y-3">
            <h3 className="font-medium text-sm">Webhook callback URL</h3>
            <p className="text-xs text-muted-foreground">
              Paste these into your Meta App → <b>Webhooks</b> product, once per object
              (Page, Instagram). Subscribe to fields: <code>messages</code>, <code>messaging_postbacks</code>, <code>leadgen</code>.
            </p>
            <FieldCopy label="Callback URL" value={data.webhookUrl ?? ""} />
            <FieldCopy label="Verify Token" value={data.webhookVerifyToken ?? ""} secret />
          </div>

          {/* Pages */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-sm">Facebook Pages & Instagram accounts</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {(data.pages ?? []).length === 0 ? "No pages found. Click Refresh above." : "Toggle what should flow into this workspace."}
                </p>
              </div>
              {(data.pages ?? []).length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={enableAll.isPending}
                  onClick={() => enableAll.mutate()}
                >
                  {enableAll.isPending ? "Enabling…" : "Enable all pages"}
                </Button>
              )}
            </div>

            {(data.pages ?? []).map((p: PageRow) => (
              <div key={p.id} className="p-4 border-t border-border first:border-t-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <Facebook className="size-3.5 text-[#1877F2] shrink-0" />
                      {p.page_name}
                      {p.instagram_business_account_id && (
                        <Instagram className="size-3.5 text-[#E4405F] shrink-0" />
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{p.category ?? "Page"} · id {p.page_id}</p>
                  </div>
                  {p.webhook_subscribed ? (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Subscribed</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => patchPage.mutate({ pageRowId: p.id, patch: { subscribe: true } })}>
                      Subscribe to webhooks
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <ToggleRow
                    label="Route Messenger to inbox"
                    checked={p.route_messenger_to_inbox}
                    onChange={(v) => patchPage.mutate({ pageRowId: p.id, patch: { route_messenger_to_inbox: v } })}
                  />
                  <ToggleRow
                    label="Route Instagram DMs to inbox"
                    checked={p.route_instagram_to_inbox}
                    disabled={!p.instagram_business_account_id}
                    onChange={(v) => patchPage.mutate({ pageRowId: p.id, patch: { route_instagram_to_inbox: v } })}
                  />
                  <ToggleRow
                    label="Sync Lead Ads leads to Contacts"
                    checked={p.sync_lead_ads}
                    onChange={(v) => patchPage.mutate({ pageRowId: p.id, patch: { sync_lead_ads: v } })}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Ad accounts */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <BarChart3 className="size-4" />
              <h3 className="font-medium text-sm">Meta Ads accounts</h3>
            </div>
            {(data.adAccounts ?? []).length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No ad accounts found for this Meta user.</p>
            ) : (
              (data.adAccounts as AdAccountRow[]).map((a) => (
                <div key={a.id} className="p-4 border-t border-border first:border-t-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.name ?? a.ad_account_id}</p>
                    <p className="text-[11px] text-muted-foreground">{a.ad_account_id} · {a.currency ?? "—"}</p>
                  </div>
                  <ToggleRow
                    label="Use for Reports"
                    checked={a.use_for_reports}
                    onChange={(v) => patchAd.mutate({ rowId: a.id, use_for_reports: v })}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle className="text-sm">Meta App Review</AlertTitle>
        <AlertDescription className="text-xs">
          Advanced permissions (Lead Ads, Ads Insights, page messaging, Instagram DMs) require
          Meta App Review + Business Verification. Until approved, only Facebook accounts you've added
          as <b>Testers</b> in your Meta App can use this integration.
          <a className="underline ml-1 inline-flex items-center gap-1" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
            Open Meta developers <ExternalLink className="size-3" />
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs ${disabled ? "opacity-50" : ""}`}>
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function FieldCopy({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret);
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-2">
        <code className="flex-1 text-xs bg-muted/40 rounded px-2 py-1.5 truncate">
          {revealed ? value : "•".repeat(Math.min(value.length, 32))}
        </code>
        {secret && (
          <Button size="sm" variant="ghost" onClick={() => setRevealed((v) => !v)}>
            {revealed ? "Hide" : "Reveal"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); }}>
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

type SetupInfo = {
  appConfigured: boolean;
  verifyTokenConfigured: boolean;
  redirectUri: string;
  webhookBaseUrl: string;
  scopes: string[];
};

function MetaSetupGuide({ setup }: { setup: SetupInfo }) {
  return (
    <div className="rounded-md border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-sm">One-time Meta app setup</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Meta requires this CRM to be registered as an app before anyone can log in with Facebook.
            You do this once — your customers never see it, they just click “Connect Facebook”.
          </p>
        </div>
        {setup.appConfigured ? (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Credentials saved</Badge>
        ) : (
          <Badge variant="outline" className="gap-1"><AlertCircle className="size-3" /> Credentials missing</Badge>
        )}
      </div>

      <ol className="space-y-3 text-xs text-muted-foreground list-decimal pl-4">
        <li>
          Go to{" "}
          <a className="underline text-foreground inline-flex items-center gap-1" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
            developers.facebook.com/apps <ExternalLink className="size-3" />
          </a>{" "}
          → <b>Create app</b> → use case <b>Other</b> → type <b>Business</b>.
        </li>
        <li>
          Add the products: <b>Facebook Login</b>, <b>Webhooks</b>, and (for Lead Ads){" "}
          <b>Marketing API</b>.
        </li>
        <li>
          In <b>Facebook Login → Settings</b>, paste this into <b>Valid OAuth Redirect URIs</b>:
          <div className="mt-2"><FieldCopy label="Redirect URI" value={setup.redirectUri} /></div>
        </li>
        <li>
          In <b>App settings → Basic</b>, copy the <b>App ID</b> and <b>App Secret</b> and give them
          to me — I store them as encrypted server secrets, never in your app’s code.
        </li>
        <li>
          Add yourself under <b>App roles → Testers</b> so you can connect before Meta approves the
          app for public use.
        </li>
        <li>
          After the first Facebook connect, this panel shows your exact <b>Webhook callback URL</b> +
          verify token to paste into the Webhooks product. It looks like:
          <div className="mt-2"><FieldCopy label="Webhook URL pattern" value={setup.webhookBaseUrl} /></div>
        </li>
      </ol>

      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-1">
          Permissions this app requests (submit these for App Review to serve customers publicly)
        </p>
        <div className="flex flex-wrap gap-1">
          {setup.scopes.map((s) => (
            <code key={s} className="text-[10px] bg-muted/40 rounded px-1.5 py-0.5">{s}</code>
          ))}
        </div>
      </div>

      {!setup.appConfigured && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle className="text-sm">Waiting on your App ID and App Secret</AlertTitle>
          <AlertDescription className="text-xs">
            Until those are saved, the Connect Facebook button stays disabled. Send them over in chat
            and I’ll store them securely.
          </AlertDescription>
        </Alert>
      )}
      {setup.appConfigured && !setup.verifyTokenConfigured && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle className="text-sm">Webhook verify token not set</AlertTitle>
          <AlertDescription className="text-xs">
            OAuth will work, but inbound DMs and Lead Ads need a verify token before Meta will
            deliver events. Ask me to generate one.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
