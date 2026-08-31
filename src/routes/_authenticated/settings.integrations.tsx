import { SettingsNav } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Facebook,
  History,
  ShieldCheck,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { MetaConnectPanel } from "@/components/MetaConnectPanel";
import { LeadDisplaySettings } from "@/components/LeadDisplaySettings";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchIntegrations,
  fetchOutbound,
  type EmailProvider,
} from "@/lib/integrations";
import {
  sendTestEmail,
  sendTestSms,
  retryOutboundMessage,
  getIntegrationSafeConfig,
  saveEmailIntegrationSecure,
  saveSmsIntegrationSecure,
} from "@/lib/integrations.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Connection console" },
      {
        name: "description",
        content:
          "Configure email, SMS and Meta channels for your workspace, run test sends and review delivery history.",
      },
      { property: "og:title", content: "Integrations — Connection console" },
      {
        property: "og:description",
        content: "Manage every outbound channel and API connection for your workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

/* ---------------- shared console primitives ---------------- */

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
        ok
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground",
      ].join(" ")}
    >
      <span className="relative flex size-2">
        {ok ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
        ) : null}
        <span
          className={`relative inline-flex size-2 rounded-full ${ok ? "bg-primary" : "bg-muted-foreground/50"}`}
        />
      </span>
      {label}
    </span>
  );
}

function TabDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`size-1.5 rounded-full ${ok ? "bg-primary" : "bg-muted-foreground/40"}`}
      aria-hidden
    />
  );
}

function ConsoleSection({
  title,
  hint,
  children,
  footer,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="rounded-xl border border-border bg-card/60 p-5 md:p-6">{children}</div>
      {footer ? <div className="mt-4 flex items-center justify-end gap-2">{footer}</div> : null}
    </section>
  );
}

function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="eyebrow mb-4">{title}</h3>
      {children}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </Label>
  );
}

function SecurityNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-5">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

function IntegrationsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const q = useQuery({
    queryKey: ["integrations", subId],
    queryFn: () => fetchIntegrations(subId as string),
    enabled: Boolean(subId),
  });
  const history = useQuery({
    queryKey: ["outbound", subId],
    queryFn: () => fetchOutbound(subId as string),
    enabled: Boolean(subId),
  });

  const emailOk = Boolean(q.data?.email_verified_at);
  const smsOk = Boolean(q.data?.sms_verified_at);
  const anyOk = emailOk || smsOk;
  const sendCount = history.data?.length ?? 0;

  const initialTab =
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab") ??
    "email";

  return (
    <AppShell>
      <PageHeader
        crumbs={[{ label: "Settings" }, { label: "Integrations" }]}
        title="Integrations"
        description="Manage your communication channels and API connections. Credentials are stored per workspace and never shared across tenants."
        actions={
          <StatusPill
            ok={anyOk}
            label={anyOk ? "System operational" : "Awaiting setup"}
          />
        }
      />
      <PageBody>
        <SettingsNav />
        {!subId ? (
          <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            Select a workspace to configure integrations.
          </div>
        ) : (
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="email" className="gap-2">
                <Mail className="size-4" />
                Email
                {emailOk ? (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <TabDot ok={false} />
                )}
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-2">
                <MessageSquare className="size-4" />
                SMS
                {smsOk ? (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <TabDot ok={false} />
                )}
              </TabsTrigger>
              <TabsTrigger value="meta" className="gap-2">
                <Facebook className="size-4" />
                Meta
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="size-4" />
                Send history
                {sendCount > 0 ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {sendCount}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-6">
              <EmailPanel subId={subId} />
            </TabsContent>
            <TabsContent value="sms" className="mt-6">
              <SmsPanel subId={subId} />
            </TabsContent>
            <TabsContent value="meta" className="mt-6 space-y-4">
              <MetaConnectPanel subId={subId} />
              <LeadDisplaySettings />
            </TabsContent>
            <TabsContent value="history" className="mt-6">
              <HistoryPanel subId={subId} />
            </TabsContent>
          </Tabs>
        )}
      </PageBody>
    </AppShell>
  );
}

/* ---------------- Email panel ---------------- */

function EmailPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", subId], queryFn: () => fetchIntegrations(subId) });
  const testFn = useServerFn(sendTestEmail);
  const safeConfigFn = useServerFn(getIntegrationSafeConfig);
  const saveFn = useServerFn(saveEmailIntegrationSecure);
  const safeCfg = useQuery({
    queryKey: ["integration-config", subId],
    queryFn: () => safeConfigFn({ data: { sub_account_id: subId } }),
  });

  const [provider, setProvider] = useState<EmailProvider>("resend");
  const [fromAddr, setFromAddr] = useState("");
  const [fromName, setFromName] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    const row = q.data;
    if (!row) return;
    if (row.email_provider) setProvider(row.email_provider as EmailProvider);
    setFromAddr(row.email_from_address ?? "");
    setFromName(row.email_from_name ?? "");
  }, [q.data]);

  useEffect(() => {
    const cfg = safeCfg.data?.email;
    if (!cfg) return;
    setSmtpHost(cfg.host);
    setSmtpPort(String(cfg.port));
    setSmtpSecure(cfg.secure);
    setSmtpUser(cfg.user);
    // Secrets are never sent to the browser — left blank means "keep existing".
    setSmtpPass("");
    setApiKey("");
  }, [safeCfg.data]);

  const secretSet =
    provider === "smtp"
      ? Boolean(safeCfg.data?.email.has_password)
      : Boolean(safeCfg.data?.email.has_api_key);

  const save = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          sub_account_id: subId,
          provider,
          from_address: fromAddr,
          from_name: fromName || null,
          host: smtpHost,
          port: parseInt(smtpPort, 10) || 587,
          secure: smtpSecure,
          user: smtpUser,
          password: smtpPass || undefined,
          api_key: apiKey || undefined,
        },
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", subId] });
      toast.success("Email settings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const test = useMutation({
    mutationFn: async () => {
      if (!testTo.trim()) throw new Error("Enter a recipient email");
      await save.mutateAsync();
      return testFn({ data: { sub_account_id: subId, to: testTo.trim() } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", subId] });
      toast.success("Test email sent — check inbox");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Test failed"),
  });

  const verified = q.data?.email_verified_at;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <ConsoleSection
          title="Email provider configuration"
          hint={provider === "smtp" ? "Custom SMTP" : `${provider} API`}
          footer={
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="px-8">
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel>Provider</FieldLabel>
              <Select value={provider} onValueChange={(v) => setProvider(v as EmailProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Resend (recommended)</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="smtp">Custom SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="email-from-name">From name (optional)</FieldLabel>
              <Input
                id="email-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="email-from-address">From address</FieldLabel>
              <Input
                id="email-from-address"
                value={fromAddr}
                onChange={(e) => setFromAddr(e.target.value)}
                placeholder="hello@yourdomain.com"
              />
            </div>

            {provider === "smtp" ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel htmlFor="smtp-host">SMTP host</FieldLabel>
                  <Input
                    id="smtp-host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="smtp-port">Port</FieldLabel>
                  <Input
                    id="smtp-port"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    type="number"
                  />
                </div>
                <div className="flex items-center gap-3 md:pt-6">
                  <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                  <Label htmlFor="smtp-secure" className="text-xs">
                    Use TLS (port 465)
                  </Label>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="smtp-user">Username</FieldLabel>
                  <Input
                    id="smtp-user"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="smtp-pass">Password</FieldLabel>
                  <Input
                    id="smtp-pass"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    type="password"
                    placeholder={secretSet ? "Saved — leave blank to keep" : "••••••••"}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="email-api-key">
                  {provider === "resend" ? "Resend API key" : "SendGrid API key"}
                </FieldLabel>
                <Input
                  id="email-api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  placeholder={secretSet ? "Saved — leave blank to keep" : "••••••••"}
                  className="tracking-widest"
                />

                <p className="text-[11px] text-muted-foreground">
                  {provider === "resend" ? (
                    <>
                      Create at{" "}
                      <a
                        className="underline"
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        resend.com/api-keys
                      </a>{" "}
                      <ExternalLink className="inline size-3" />
                    </>
                  ) : (
                    <>
                      Create at{" "}
                      <a
                        className="underline"
                        href="https://app.sendgrid.com/settings/api_keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        sendgrid.com api keys
                      </a>{" "}
                      <ExternalLink className="inline size-3" />
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </ConsoleSection>
      </div>

      <div className="space-y-6">
        <SidePanel title="Connection health">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Status</span>
              {verified ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3 text-primary" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="size-3" /> Not verified
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last verified</span>
              <span className="text-muted-foreground">
                {verified
                  ? formatDistanceToNow(new Date(verified), { addSuffix: true })
                  : "—"}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A successful test send marks this channel verified.
            </p>
          </div>
        </SidePanel>

        <SidePanel title="Quick test">
          <div className="space-y-3">
            <Input
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send test email"
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Saves your settings first, then sends a test email.
            </p>
          </div>
        </SidePanel>

        <SecurityNote>
          Keep API keys private — never paste them into screenshots or chats. Rotate a key
          immediately if it has been shared.
        </SecurityNote>
      </div>
    </div>
  );
}

/* ---------------- SMS panel ---------------- */

function SmsPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", subId], queryFn: () => fetchIntegrations(subId) });
  const testFn = useServerFn(sendTestSms);
  const safeConfigFn = useServerFn(getIntegrationSafeConfig);
  const saveFn = useServerFn(saveSmsIntegrationSecure);
  const safeCfg = useQuery({
    queryKey: ["integration-config", subId],
    queryFn: () => safeConfigFn({ data: { sub_account_id: subId } }),
  });

  const [provider, setProvider] = useState<"twilio" | "twilio_connector">("twilio_connector");
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [testTo, setTestTo] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const row = q.data;
    if (!row) return;
    if (row.sms_provider === "twilio" || row.sms_provider === "twilio_connector") {
      setProvider(row.sms_provider);
    }
    setFromNumber(row.sms_from_number ?? "");
  }, [q.data]);

  useEffect(() => {
    const cfg = safeCfg.data?.sms;
    if (!cfg) return;
    setSid(cfg.account_sid);
    // Auth token is never sent to the browser — blank means "keep existing".
    setToken("");
  }, [safeCfg.data]);

  const tokenSet = Boolean(safeCfg.data?.sms.has_auth_token);

  const save = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          sub_account_id: subId,
          provider,
          from_number: fromNumber,
          account_sid: sid,
          auth_token: token || undefined,
        },
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", subId] });
      toast.success("SMS settings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const test = useMutation({
    mutationFn: async () => {
      if (!testTo.trim()) throw new Error("Enter a recipient phone");
      await save.mutateAsync();
      return testFn({ data: { sub_account_id: subId, to: testTo.trim() } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", subId] });
      toast.success("Test SMS sent");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Test failed"),
  });

  const verified = q.data?.sms_verified_at;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <ConsoleSection
          title="Twilio configuration"
          hint={provider === "twilio_connector" ? "Managed connector" : "Own credentials"}
          footer={
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="px-8">
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <FieldLabel>Connection mode</FieldLabel>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as "twilio" | "twilio_connector")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio_connector">Managed connector (recommended)</SelectItem>
                  <SelectItem value="twilio">Your own Twilio credentials</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {provider === "twilio_connector"
                  ? "Uses the Twilio connector linked at the workspace level — no per-tenant credentials needed."
                  : "Paste your own Twilio Account SID and Auth Token. Stored per workspace."}
              </p>
            </div>

            {provider === "twilio" ? (
              <>
                <div className="space-y-2">
                  <FieldLabel htmlFor="twilio-sid">Account SID</FieldLabel>
                  <Input
                    id="twilio-sid"
                    value={sid}
                    onChange={(e) => setSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="twilio-token">Auth token</FieldLabel>
                  <Input
                    id="twilio-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="tracking-widest"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="twilio-from">From number (E.164)</FieldLabel>
              <Input
                id="twilio-from"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="+15551234567"
              />
              <p className="text-[11px] text-muted-foreground">
                Find your credentials and numbers at{" "}
                <a
                  className="underline"
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.twilio.com
                </a>
                . The From number must be a Twilio-provisioned number.
              </p>
            </div>
          </div>
        </ConsoleSection>

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-left">
              <span className="text-sm font-medium">
                Test SMS failing? Verify the destination number
              </span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${helpOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-5 pb-5">
              <p className="text-xs text-muted-foreground">
                If Twilio returns an error like{" "}
                <span className="font-mono">
                  "The number +1555XXXXXXX is unverified. Trial accounts cannot send messages to
                  unverified numbers"
                </span>
                , your Twilio account is still in trial mode. Trial accounts can only send SMS to
                numbers you have explicitly verified in the Twilio console.
              </p>
              <div className="space-y-2 text-xs">
                <p className="font-medium text-foreground">
                  Option 1 — Verify the number (free, stays on trial)
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>
                    Open{" "}
                    <a
                      className="underline"
                      href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Twilio Console → Verified Caller IDs
                    </a>
                    .
                  </li>
                  <li>
                    Click <b>Add a new Caller ID</b> and enter the destination number in E.164
                    format.
                  </li>
                  <li>Twilio calls or texts the number with a 6-digit code — enter it to confirm.</li>
                  <li>
                    Come back here and click <b>Send test SMS</b> again.
                  </li>
                </ol>
              </div>
              <div className="space-y-2 text-xs">
                <p className="font-medium text-foreground">
                  Option 2 — Upgrade Twilio (send to any number)
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>
                    Open{" "}
                    <a
                      className="underline"
                      href="https://console.twilio.com/us1/billing/manage-billing/upgrade"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Twilio Console → Upgrade
                    </a>{" "}
                    and add a payment method.
                  </li>
                  <li>
                    After upgrading, you can send SMS to any number worldwide (subject to Geo
                    Permissions).
                  </li>
                </ol>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is a Twilio account restriction — no changes to this app are needed once the
                number is verified or the account is upgraded.
              </p>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      <div className="space-y-6">
        <SidePanel title="Connection health">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Status</span>
              {verified ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3 text-primary" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="size-3" /> Not verified
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium">
                {provider === "twilio_connector" ? "Connector" : "Own credentials"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-mono text-xs">{fromNumber || "—"}</span>
            </div>
          </div>
        </SidePanel>

        <SidePanel title="Quick test">
          <div className="space-y-3">
            <Input
              placeholder="+15551234567"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send test SMS"
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Use E.164 format (e.g. <code className="font-mono">+15551234567</code>).
            </p>
          </div>
        </SidePanel>

        <SecurityNote>
          Auth tokens grant full access to your Twilio account. Prefer the managed connector so no
          secrets are stored per workspace.
        </SecurityNote>
      </div>
    </div>
  );
}

/* ---------------- History panel ---------------- */

type OutboundRow = {
  id: string;
  created_at: string;
  channel: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  status: string;
  attempts: number;
  error: string | null;
};

function HistoryPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["outbound", subId], queryFn: () => fetchOutbound(subId) });
  const rows = q.data ?? [];
  const retryFn = useServerFn(retryOutboundMessage);
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Retrying…");
      qc.invalidateQueries({ queryKey: ["outbound", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const failed = rows.filter((r) => r.status === "failed").length;

  const columns: Column<OutboundRow>[] = [
    {
      key: "when",
      header: "When",
      cell: (r) => (
        <span className="block min-w-0 whitespace-nowrap text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
        </span>
      ),
      sortValue: (r) => new Date(r.created_at).getTime(),
    },
    {
      key: "channel",
      header: "Channel",
      cell: (r) => <Badge variant="outline">{r.channel}</Badge>,
      sortValue: (r) => r.channel,
    },
    {
      key: "to",
      header: "To",
      cell: (r) => <span className="block min-w-0 truncate">{r.to_address}</span>,
      sortValue: (r) => r.to_address,
    },
    {
      key: "body",
      header: "Subject / body",
      cell: (r) => (
        <span className="block max-w-[240px] min-w-0 truncate">{r.subject ?? r.body_text ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                r.status === "sent" ? "secondary" : r.status === "failed" ? "destructive" : "outline"
              }
            >
              {r.status}
            </Badge>
            {r.attempts > 0 ? (
              <span className="text-[10px] text-muted-foreground">×{r.attempts}</span>
            ) : null}
          </div>
          {r.error ? (
            <div className="mt-1 max-w-[240px] break-words text-[10px] text-destructive" title={r.error}>
              {r.error}
            </div>
          ) : null}
        </div>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "actions",
      header: "",
      locked: true,
      className: "text-right",
      cell: (r) =>
        r.status === "failed" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={retry.isPending}
            onClick={() => retry.mutate(r.id)}
            aria-label={`Retry send to ${r.to_address}`}
          >
            Retry
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{rows.length} sends</Badge>
        {failed > 0 ? <Badge variant="destructive">{failed} failed</Badge> : null}
      </div>
      <div className="overflow-x-auto">
        <DataTable
          tableKey="send-history"
          caption="Outbound message history"
          rows={rows as OutboundRow[]}
          columns={columns}
          rowKey={(r) => r.id}
          isLoading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          emptyTitle="No sends yet"
          emptyDescription="Run a test from the Email or SMS tab to see activity here."
        />
      </div>
    </div>
  );
}
