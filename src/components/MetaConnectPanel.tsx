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
  configureMetaWebhooks,
} from "@/lib/meta.functions";
import { MetaLeadFormRouting } from "@/components/MetaLeadFormRouting";
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
  const configureWebhooksFn = useServerFn(configureMetaWebhooks);

  const configureWebhooks = useMutation({
    mutationFn: () => configureWebhooksFn({ data: { subAccountId: subId } }),
    onSuccess: (res: { results: { object: string; ok: boolean; error?: string }[] }) => {
      const failed = (res.results ?? []).filter((r) => !r.ok);
      if (failed.length === 0) toast.success("Webhooks registered with Meta (Page + Instagram)");
      else
        toast.warning(
          `Partially configured: ${failed.map((f) => `${f.object} — ${f.error}`).join("; ")}`,
        );
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
  const pages = (data?.pages ?? []) as PageRow[];
  const adAccounts = (data?.adAccounts ?? []) as AdAccountRow[];
  const subscribedCount = pages.filter((p) => p.webhook_subscribed).length;
  const igCount = pages.filter((p) => p.instagram_business_account_id).length;
  const leadAdsCount = pages.filter((p) => p.sync_lead_ads).length;

  if (q.isLoading) {
    return (
      <div className="surface-card space-y-3 p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-72 animate-pulse rounded bg-secondary" />
        <div className="h-9 w-36 animate-pulse rounded bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Connection header ─────────────────────────────── */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10">
              <Facebook className="size-5 text-[#1877F2]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold">Meta</h2>
                {conn ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <AlertCircle className="size-3" /> Not connected
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {conn ? (
                  <>
                    Logged in as{" "}
                    <span className="font-medium text-foreground">{conn.meta_user_name}</span>
                    {conn.token_expires_at && (
                      <> · token expires {new Date(conn.token_expires_at).toLocaleDateString()}</>
                    )}
                  </>
                ) : (
                  "Messenger + Instagram DMs into your inbox, Lead Ads into Contacts, ad spend in Reports."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!conn ? (
              <Button
                onClick={() => connect.mutate()}
                disabled={connect.isPending || data?.setup?.appConfigured === false}
              >
                <Facebook className="size-4" />
                {connect.isPending ? "Redirecting…" : "Connect Facebook"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                >
                  <RefreshCw className={`size-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Disconnect Meta from this workspace?")) disconnect.mutate();
                  }}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>

        {conn && (
          <div className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-4">
            <Stat label="Pages" value={pages.length} />
            <Stat label="Subscribed" value={`${subscribedCount}/${pages.length}`} />
            <Stat label="Instagram" value={igCount} />
            <Stat label="Lead Ads on" value={leadAdsCount} />
          </div>
        )}
      </div>

      {!conn && data?.setup && <MetaSetupGuide setup={data.setup} />}

      {conn && (
        <Tabs defaultValue="channels">
          <TabsList>
            <TabsTrigger value="channels">
              <MessageSquare className="mr-1.5 size-3.5" /> Channels
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="mr-1.5 size-3.5" /> Lead Ads
            </TabsTrigger>
            <TabsTrigger value="ads">
              <BarChart3 className="mr-1.5 size-3.5" /> Ad accounts
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Webhook className="mr-1.5 size-3.5" /> Webhooks
            </TabsTrigger>
          </TabsList>

          {/* ── Channels: pages & routing ───────────────── */}
          <TabsContent value="channels" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {pages.length === 0
                  ? "No pages found yet — click Refresh above."
                  : "Choose what each Page sends into this workspace."}
              </p>
              {pages.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={enableAll.isPending}
                  onClick={() => enableAll.mutate()}
                >
                  {enableAll.isPending ? "Enabling…" : "Enable everything"}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {pages.map((p) => (
                <div key={p.id} className="surface-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <Facebook className="size-3.5 shrink-0 text-[#1877F2]" />
                        {p.page_name}
                        {p.instagram_business_account_id && (
                          <Instagram className="size-3.5 shrink-0 text-[#E4405F]" />
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {p.category ?? "Page"} · {p.page_id}
                      </p>
                    </div>
                    {p.webhook_subscribed ? (
                      <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                        <CheckCircle2 className="size-3" /> Subscribed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          patchPage.mutate({ pageRowId: p.id, patch: { subscribe: true } })
                        }
                      >
                        Subscribe
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <ToggleRow
                      label="Messenger → Inbox"
                      checked={p.route_messenger_to_inbox}
                      onChange={(v) =>
                        patchPage.mutate({
                          pageRowId: p.id,
                          patch: { route_messenger_to_inbox: v },
                        })
                      }
                    />
                    <ToggleRow
                      label="Instagram DMs → Inbox"
                      checked={p.route_instagram_to_inbox}
                      disabled={!p.instagram_business_account_id}
                      onChange={(v) =>
                        patchPage.mutate({
                          pageRowId: p.id,
                          patch: { route_instagram_to_inbox: v },
                        })
                      }
                    />
                    <ToggleRow
                      label="Lead Ads → Contacts"
                      checked={p.sync_lead_ads}
                      onChange={(v) =>
                        patchPage.mutate({ pageRowId: p.id, patch: { sync_lead_ads: v } })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Lead Ads routing ───────────────────────── */}
          <TabsContent value="leads" className="mt-4">
            <MetaLeadFormRouting subId={subId} />
          </TabsContent>

          {/* ── Ad accounts ────────────────────────────── */}
          <TabsContent value="ads" className="mt-4">
            <div className="surface-card overflow-hidden">
              {adAccounts.length === 0 ? (
                <p className="p-5 text-xs text-muted-foreground">
                  No ad accounts found for this Meta user.
                </p>
              ) : (
                adAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 border-t border-border p-4 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name ?? a.ad_account_id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.ad_account_id} · {a.currency ?? "—"}
                      </p>
                    </div>
                    <div className="w-52 shrink-0">
                      <ToggleRow
                        label="Use for Reports"
                        checked={a.use_for_reports}
                        onChange={(v) => patchAd.mutate({ rowId: a.id, use_for_reports: v })}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Webhooks & app review ──────────────────── */}
          <TabsContent value="advanced" className="mt-4 space-y-3">
            <div className="surface-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Webhook callback</h3>
                  <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                    Register this URL in Meta automatically (Page: <code>messages</code>,{" "}
                    <code>messaging_postbacks</code>, <code>leadgen</code>; Instagram:{" "}
                    <code>messages</code>), or paste it manually in Meta App → Webhooks.
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={configureWebhooks.isPending}
                  onClick={() => configureWebhooks.mutate()}
                >
                  {configureWebhooks.isPending ? "Configuring…" : "Configure in Meta"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldCopy label="Callback URL" value={data.webhookUrl ?? ""} />
                <FieldCopy label="Verify Token" value={data.webhookVerifyToken ?? ""} secret />
              </div>
            </div>

            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle className="text-sm">Meta App Review</AlertTitle>
              <AlertDescription className="text-xs">
                Advanced permissions (Lead Ads, Ads Insights, page messaging, Instagram DMs) require
                Meta App Review + Business Verification. Until approved, only Facebook accounts added
                as <b>Testers</b> in your Meta App can use this integration.
                <a
                  className="ml-1 inline-flex items-center gap-1 underline"
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Meta developers <ExternalLink className="size-3" />
                </a>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      )}

      {!conn && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle className="text-sm">Meta App Review</AlertTitle>
          <AlertDescription className="text-xs">
            Until Meta approves the app, only Facebook accounts added as <b>Testers</b> can connect.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-5 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
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
