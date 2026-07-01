import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
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
import { toast } from "sonner";
import { Mail, MessageSquare, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchIntegrations,
  saveEmailIntegration,
  saveSmsIntegration,
  fetchOutbound,
  type EmailProvider,
} from "@/lib/integrations";
import { sendTestEmail, sendTestSms } from "@/lib/integrations.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Settings" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your own email provider and Twilio account. Credentials are stored per
            workspace and never shared across tenants.
          </p>
        </div>

        {!subId ? (
          <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
            Select a workspace to configure integrations.
          </div>
        ) : (
          <Tabs defaultValue="email" className="w-full">
            <TabsList>
              <TabsTrigger value="email"><Mail className="size-4 mr-2" />Email</TabsTrigger>
              <TabsTrigger value="sms"><MessageSquare className="size-4 mr-2" />SMS</TabsTrigger>
              <TabsTrigger value="history">Send history</TabsTrigger>
            </TabsList>
            <TabsContent value="email"><EmailPanel subId={subId} /></TabsContent>
            <TabsContent value="sms"><SmsPanel subId={subId} /></TabsContent>
            <TabsContent value="history"><HistoryPanel subId={subId} /></TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

// ============ Email panel ============
function EmailPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", subId], queryFn: () => fetchIntegrations(subId) });
  const testFn = useServerFn(sendTestEmail);

  const [provider, setProvider] = useState<EmailProvider>("resend");
  const [fromAddr, setFromAddr] = useState("");
  const [fromName, setFromName] = useState("");

  // provider-specific fields
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
    const cfg = (row.email_config ?? {}) as Record<string, unknown>;
    if (row.email_provider === "smtp") {
      setSmtpHost(String(cfg.host ?? ""));
      setSmtpPort(String(cfg.port ?? 587));
      setSmtpSecure(Boolean(cfg.secure));
      setSmtpUser(String(cfg.user ?? ""));
      setSmtpPass(String(cfg.password ?? ""));
    } else {
      setApiKey(String(cfg.api_key ?? ""));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      let config: Record<string, unknown>;
      if (provider === "smtp") {
        config = {
          host: smtpHost, port: parseInt(smtpPort, 10) || 587,
          secure: smtpSecure, user: smtpUser, password: smtpPass,
        };
      } else {
        config = { api_key: apiKey };
      }
      await saveEmailIntegration({
        sub_account_id: subId, provider, config: config as never,
        from_address: fromAddr, from_name: fromName || undefined,
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
    <div className="space-y-6 mt-4">
      <div className="rounded-md border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Email provider</h2>
          {verified ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3 text-green-500" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="size-3" /> Not verified
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as EmailProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="smtp">Custom SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div />
          <div>
            <Label>From address</Label>
            <Input value={fromAddr} onChange={(e) => setFromAddr(e.target.value)} placeholder="hello@yourdomain.com" />
          </div>
          <div>
            <Label>From name (optional)</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Company" />
          </div>
        </div>

        {provider === "smtp" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>SMTP host</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <Label>Port</Label>
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} type="number" />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="smtp-secure" type="checkbox" checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="size-4"
              />
              <Label htmlFor="smtp-secure" className="mb-1">Use TLS (port 465)</Label>
            </div>
            <div>
              <Label>Username</Label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} type="password" placeholder="••••••••" />
            </div>
          </div>
        ) : (
          <div>
            <Label>{provider === "resend" ? "Resend API key" : "SendGrid API key"}</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="••••••••" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {provider === "resend"
                ? <>Create at <a className="underline" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">resend.com/api-keys</a> <ExternalLink className="inline size-3" /></>
                : <>Create at <a className="underline" href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer">sendgrid.com api keys</a> <ExternalLink className="inline size-3" /></>}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border p-5 space-y-3">
        <h2 className="font-medium">Send a test email</h2>
        <div className="flex gap-2">
          <Input placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Sending..." : "Send test"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Saves your settings first, then sends a test email.</p>
      </div>
    </div>
  );
}

// ============ SMS panel ============
function SmsPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", subId], queryFn: () => fetchIntegrations(subId) });
  const testFn = useServerFn(sendTestSms);

  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    const row = q.data;
    if (!row) return;
    const cfg = (row.sms_config ?? {}) as Record<string, unknown>;
    setSid(String(cfg.account_sid ?? ""));
    setToken(String(cfg.auth_token ?? ""));
    setFromNumber(row.sms_from_number ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      await saveSmsIntegration({
        sub_account_id: subId,
        config: { account_sid: sid, auth_token: token },
        from_number: fromNumber,
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
    <div className="space-y-6 mt-4">
      <div className="rounded-md border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Twilio credentials</h2>
          {verified ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3 text-green-500" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="size-3" /> Not verified
            </Badge>
          )}
        </div>

        <div>
          <Label>Account SID</Label>
          <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxx" />
        </div>
        <div>
          <Label>Auth token</Label>
          <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="••••••••" />
        </div>
        <div>
          <Label>From number (E.164)</Label>
          <Input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+15551234567" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Find your credentials at{" "}
          <a className="underline" href="https://console.twilio.com" target="_blank" rel="noreferrer">
            console.twilio.com
          </a>. The From number must be a Twilio-provisioned number.
        </p>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border p-5 space-y-3">
        <h2 className="font-medium">Send a test SMS</h2>
        <div className="flex gap-2">
          <Input placeholder="+15551234567" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Sending..." : "Send test"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ History panel ============
function HistoryPanel({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["outbound", subId], queryFn: () => fetchOutbound(subId) });
  const rows = q.data ?? [];
  const retryFn = useServerFn(
    // Lazy require avoids adding a static import to the top of this file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("@/lib/integrations.functions") as typeof import("@/lib/integrations.functions"))
      .retryOutboundMessage,
  );
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Retrying…");
      qc.invalidateQueries({ queryKey: ["outbound", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left p-2 font-medium">When</th>
            <th className="text-left p-2 font-medium">Channel</th>
            <th className="text-left p-2 font-medium">To</th>
            <th className="text-left p-2 font-medium">Subject / body</th>
            <th className="text-left p-2 font-medium">Status</th>
            <th className="text-left p-2 font-medium w-[80px]"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No sends yet.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</td>
              <td className="p-2"><Badge variant="outline">{r.channel}</Badge></td>
              <td className="p-2">{r.to_address}</td>
              <td className="p-2 truncate max-w-[240px]">{r.subject ?? r.body_text ?? "—"}</td>
              <td className="p-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={r.status === "sent" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>
                    {r.status}
                  </Badge>
                  {r.attempts > 0 && (
                    <span className="text-[10px] text-muted-foreground">×{r.attempts}</span>
                  )}
                </div>
                {r.error && (
                  <div className="text-[10px] text-red-500 mt-1 max-w-[240px] break-words" title={r.error}>
                    {r.error}
                  </div>
                )}
              </td>
              <td className="p-2 text-right">
                {r.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(r.id)}
                  >
                    Retry
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

