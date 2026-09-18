import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleStat, ConsoleTips, StatusPill } from "@/components/console";
import { EmptyState, ListSkeleton, ErrorState, PanelSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, Phone, Star, Trash2, Search, ExternalLink, Link2, PhoneCall } from "lucide-react";
import { useTenancy } from "@/lib/tenancy";
import {
  connectTwilio,
  disconnectTwilio,
  getTwilioConnection,
  searchNumbers,
  buyNumber,
  listMyNumbers,
  releaseTwilioNumber,
  setDefaultTwilioNumber,
  enableWhatsappOnNumber,
  listAccountNumbers,
  importTwilioNumber,
} from "@/lib/twilio.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/phone-numbers")({
  head: () => ({ meta: [{ title: "Phone Numbers — Settings" }] }),
  component: PhoneNumbersPage,
});

function PhoneNumbersPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const getConn = useServerFn(getTwilioConnection);
  const connQ = useQuery({
    queryKey: ["twilio-connection", subId],
    enabled: !!subId,
    queryFn: () => getConn({ data: { subAccountId: subId! } }),
  });

  return (
    <AppShell>
      <PageHeader
        title="Phone numbers"
        description="Buy and manage Twilio phone numbers for calls, SMS, and WhatsApp — right from your CRM."
        crumbs={[{ label: "Settings" }, { label: "Phone numbers" }]}
        meta={
          subId && connQ.data ? (
            <StatusPill ok={connQ.data.connected} label={connQ.data.connected ? "Connected" : "Not connected"} />
          ) : null
        }
      />
      <PageBody width="full">
        <SettingsShell>
        {!subId ? (
          <EmptyState icon={Phone} title="Select a workspace" description="Select a workspace to manage phone numbers." />
        ) : (
          <PhonePanels subId={subId} />
        )}
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}

function PhonePanels({ subId }: { subId: string }) {
  const getConn = useServerFn(getTwilioConnection);
  const connQ = useQuery({
    queryKey: ["twilio-connection", subId],
    queryFn: () => getConn({ data: { subAccountId: subId } }),
  });

  if (connQ.error) return <ErrorState onRetry={() => connQ.refetch()} error={connQ.error} />;
  if (connQ.isLoading || !connQ.data) return <PanelSkeleton />;

  return (
    <ConsoleSplit
      main={
        <>
          <ConsoleSection
            title="Connect Twilio"
            icon={Link2}
            hint={connQ.data?.connected ? "Credentials verified" : "Connect an account to buy numbers"}
          >
            <ConnectPanel subId={subId} conn={connQ.data} />
          </ConsoleSection>
          {connQ.data?.connected && (
            <>
              <ConsoleSection title="Search & buy numbers" icon={Search} hint="Twilio inventory search">
                <SearchAndBuyPanel subId={subId} />
              </ConsoleSection>
              <ConsoleSection title="Your numbers" icon={PhoneCall} hint="Owned numbers and their capabilities">
                <OwnedNumbersPanel subId={subId} />
              </ConsoleSection>
            </>
          )}
        </>
      }
      side={
        <>
          <ConsoleSection title="Connection health">
            <ConsoleStat
              label="Twilio"
              value={connQ.data?.connected ? "Connected" : "Not connected"}
              tone={connQ.data?.connected ? "ok" : "muted"}
            />
            {connQ.data?.connected ? (
              <>
                <ConsoleStat label="Account" value={connQ.data.friendlyName ?? "—"} />
                <ConsoleStat label="Status" value={connQ.data.status ?? "—"} />
              </>
            ) : null}
          </ConsoleSection>
          <ConsoleTips
            items={[
              "Charges for numbers, calls, and messages are billed by Twilio directly to your account.",
              "Use an API Key (not the Auth Token) when connecting — it can be scoped and revoked independently.",
              "Voice and SMS webhooks are auto-configured whenever you buy a new number.",
              "Releasing a number stops Twilio billing immediately and cannot be undone.",
            ]}
          />
        </>
      }
    />
  );
}

// ============ Connect / disconnect ============
function ConnectPanel({
  subId,
  conn,
}: {
  subId: string;
  conn: Awaited<ReturnType<typeof getTwilioConnection>>;
}) {
  const qc = useQueryClient();
  const connectFn = useServerFn(connectTwilio);
  const disconnectFn = useServerFn(disconnectTwilio);

  const [accountSid, setAccountSid] = useState("");
  const [apiKeySid, setApiKeySid] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");

  const connectM = useMutation({
    mutationFn: () =>
      connectFn({
        data: { subAccountId: subId, accountSid, apiKeySid, apiKeySecret },
      }),
    onSuccess: () => {
      toast.success("Twilio connected");
      setAccountSid(""); setApiKeySid(""); setApiKeySecret("");
      qc.invalidateQueries({ queryKey: ["twilio-connection", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectM = useMutation({
    mutationFn: () => disconnectFn({ data: { subAccountId: subId } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["twilio-connection", subId] });
      qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (conn?.connected) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 shrink-0 text-primary" /> Twilio connected
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {conn.friendlyName} · <span className="font-mono">{conn.accountSid}</span> · {conn.status}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">Disconnect</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Twilio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your owned numbers stay on Twilio and remain billed, but the CRM will no longer send or receive
                  messages/calls through them. Release numbers below first if you want to stop being billed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep connected</AlertDialogCancel>
                <AlertDialogAction onClick={() => disconnectM.mutate()}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Webhook URLs (auto-configured on new numbers)</summary>
          <div className="mt-2 space-y-1 break-all font-mono">
            <div>Voice: {conn.webhookVoiceUrl}</div>
            <div>SMS:   {conn.webhookSmsUrl}</div>
            <div>Status: {conn.webhookStatusUrl}</div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Charges for numbers, calls, and messages are billed by Twilio directly to your account.
        Create an <strong>API Key</strong> (not the Auth Token) in the Twilio console for the credentials below.{" "}
        <a
          href="https://console.twilio.com/us1/account/keys-credentials/api-keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline"
        >
          Twilio API Keys <ExternalLink className="size-3" />
        </a>
      </p>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="twilio-account-sid">Account SID (starts with AC)</Label>
          <Input id="twilio-account-sid" value={accountSid} onChange={(e) => setAccountSid(e.target.value.trim())} placeholder="AC…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twilio-api-key-sid">API Key SID (starts with SK)</Label>
          <Input id="twilio-api-key-sid" value={apiKeySid} onChange={(e) => setApiKeySid(e.target.value.trim())} placeholder="SK…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twilio-api-key-secret">API Key Secret</Label>
          <Input id="twilio-api-key-secret" type="password" value={apiKeySecret} onChange={(e) => setApiKeySecret(e.target.value)} placeholder="Your API Key Secret" />
        </div>
        <div>
          <Button
            onClick={() => connectM.mutate()}
            disabled={!accountSid || !apiKeySid || !apiKeySecret || connectM.isPending}
          >
            {connectM.isPending ? "Verifying…" : "Connect Twilio"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Search + buy ============
const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "IN", label: "India" },
  { code: "AE", label: "United Arab Emirates" },
];

function SearchAndBuyPanel({ subId }: { subId: string }) {
  const searchFn = useServerFn(searchNumbers);
  const buyFn = useServerFn(buyNumber);
  const qc = useQueryClient();

  const [country, setCountry] = useState("US");
  const [type, setType] = useState<"Local" | "TollFree" | "Mobile">("Local");
  const [areaCode, setAreaCode] = useState("");
  const [contains, setContains] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mmsEnabled, setMmsEnabled] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchNumbers>>["numbers"]>([]);
  const [price, setPrice] = useState<Awaited<ReturnType<typeof searchNumbers>>["monthlyPrice"]>(null);

  const searchM = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          subAccountId: subId,
          isoCountry: country,
          type,
          areaCode: areaCode || undefined,
          contains: contains || undefined,
          smsEnabled,
          voiceEnabled,
          mmsEnabled,
        },
      }),
    onSuccess: (r) => {
      setResults(r.numbers);
      setPrice(r.monthlyPrice);
      if (r.numbers.length === 0) toast.info("No numbers matched — try different filters.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buyM = useMutation({
    mutationFn: (phoneNumber: string) => buyFn({ data: { subAccountId: subId, phoneNumber } }),
    onSuccess: (r) => {
      toast.success(`Purchased ${r.phoneNumber}`);
      qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] });
      setResults((prev) => prev.filter((n) => n.phone_number !== r.phoneNumber));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Search Twilio's inventory. Voice + SMS webhooks are auto-configured on purchase.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="pn-country">Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="pn-country"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger id="pn-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Local">Local</SelectItem>
              <SelectItem value="TollFree">Toll-Free</SelectItem>
              <SelectItem value="Mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-area-code">Area code</Label>
          <Input id="pn-area-code" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="e.g. 415" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-contains">Contains digits</Label>
          <Input id="pn-contains" value={contains} onChange={(e) => setContains(e.target.value)} placeholder="e.g. 777" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} /> Voice
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} /> SMS
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mmsEnabled} onChange={(e) => setMmsEnabled(e.target.checked)} /> MMS
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => searchM.mutate()} disabled={searchM.isPending}>
          <Search className="mr-2 size-4" />
          {searchM.isPending ? "Searching…" : "Search"}
        </Button>
        {price && (
          <span className="text-xs text-muted-foreground">
            Approx {price.currency} {price.monthly.toFixed(2)}/mo
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((n) => (
                <TableRow key={n.phone_number}>
                  <TableCell className="font-mono">{n.friendly_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[n.locality, n.region, n.iso_country].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell className="space-x-1 text-xs">
                    {n.capabilities.voice && <Badge variant="secondary">Voice</Badge>}
                    {n.capabilities.SMS && <Badge variant="secondary">SMS</Badge>}
                    {n.capabilities.MMS && <Badge variant="secondary">MMS</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={buyM.isPending}>Buy</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Buy {n.friendly_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Your Twilio account will be charged{" "}
                            {price ? `${price.currency} ${price.monthly.toFixed(2)}` : "the current monthly rate"} for this
                            number, plus per-use rates for calls and messages. You can release it any time.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => buyM.mutate(n.phone_number)}>
                            Buy number
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ============ Owned numbers ============
function OwnedNumbersPanel({ subId }: { subId: string }) {
  const listFn = useServerFn(listMyNumbers);
  const releaseFn = useServerFn(releaseTwilioNumber);
  const defaultFn = useServerFn(setDefaultTwilioNumber);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["twilio-numbers", subId],
    queryFn: () => listFn({ data: { subAccountId: subId } }),
  });

  const releaseM = useMutation({
    mutationFn: (id: string) => releaseFn({ data: { subAccountId: subId, numberId: id } }),
    onSuccess: () => {
      toast.success("Number released");
      qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultM = useMutation({
    mutationFn: (id: string) => defaultFn({ data: { subAccountId: subId, numberId: id } }),
    onSuccess: () => {
      toast.success("Default number set");
      qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Refresh numbers"
          onClick={() => qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] })}
        >
          Refresh
        </Button>
      </div>

      {q.error ? (
        <ErrorState compact onRetry={() => q.refetch()} error={q.error} />
      ) : q.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          compact
          icon={Phone}
          title="No numbers yet"
          description="Search above and buy your first one."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono">
                    {n.phone_number}
                    {n.is_default && <Badge className="ml-2" variant="default">Default</Badge>}
                  </TableCell>
                  <TableCell>{n.friendly_name}</TableCell>
                  <TableCell className="space-x-1 text-xs">
                    {n.capabilities?.voice && <Badge variant="secondary">Voice</Badge>}
                    {(n.capabilities?.sms ?? n.capabilities?.SMS) && <Badge variant="secondary">SMS</Badge>}
                    {(n.capabilities?.mms ?? n.capabilities?.MMS) && <Badge variant="secondary">MMS</Badge>}
                  </TableCell>
                  <TableCell>
                    <WhatsAppCell subId={subId} number={n} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {n.monthly_cost ? `${n.cost_currency ?? ""} ${Number(n.monthly_cost).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {!n.is_default && (
                      <Button variant="ghost" size="sm" aria-label={`Set ${n.phone_number} as default`} onClick={() => defaultM.mutate(n.id)}>
                        <Star className="size-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label={`Release ${n.phone_number}`}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Release {n.phone_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This immediately releases the number from your Twilio account. Twilio stops billing you for
                            it, and it cannot be recovered. Any inbound calls or SMS to this number will fail.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => releaseM.mutate(n.id)}>
                            Release number
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ============ WhatsApp toggle ============
function WhatsAppCell({ subId, number }: { subId: string; number: any }) {
  const [open, setOpen] = useState(false);
  const [sender, setSender] = useState<string>(number.whatsapp_sender ?? number.phone_number);
  const qc = useQueryClient();
  const getConnFn = useServerFn(getTwilioConnection);
  const connQ = useQuery({
    queryKey: ["twilio-conn", subId],
    queryFn: () => getConnFn({ data: { subAccountId: subId } }),
  });
  const enableFn = useServerFn(enableWhatsappOnNumber);
  const enableM = useMutation({
    mutationFn: (enabled: boolean) =>
      enableFn({
        data: {
          subAccountId: subId,
          numberId: number.id,
          whatsappSender: sender,
          enabled,
        },
      }),
    onSuccess: (res) => {
      toast.success(number.whatsapp_enabled ? "WhatsApp disabled" : "WhatsApp enabled");
      qc.invalidateQueries({ queryKey: ["twilio-numbers", subId] });
      if (res?.whatsappWebhookUrl) {
        toast.message("Set this as Inbound URL on your Twilio WhatsApp Sender", {
          description: res.whatsappWebhookUrl,
        });
      }
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inboundUrl =
    (connQ.data && "webhookSmsUrl" in connQ.data
      ? (connQ.data as any).webhookSmsUrl?.replace(/\/sms$/, "/whatsapp")
      : null) ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={number.whatsapp_enabled ? "secondary" : "ghost"} size="sm" className="h-7 gap-1">
          <MessageCircle className="size-3.5 text-green-600" />
          {number.whatsapp_enabled ? "Enabled" : "Enable"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>WhatsApp on {number.phone_number}</DialogTitle>
          <DialogDescription>
            To send and receive WhatsApp on this number, you must first register it as a WhatsApp Sender in the
            Twilio Console (Messaging → Try it out → Senders → WhatsApp senders). After Twilio approves the sender,
            paste the inbound webhook URL below into the sender's "When a message comes in" field, then flip the
            switch to enable WhatsApp in the CRM.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wa-inbound-url">Inbound webhook URL (paste in Twilio)</Label>
            <div className="flex items-center gap-2">
              <Input id="wa-inbound-url" readOnly value={inboundUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inboundUrl);
                  toast.success("Copied");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-sender">WhatsApp sender (E.164)</Label>
            <Input
              id="wa-sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={number.phone_number}
            />
            <p className="text-xs text-muted-foreground">
              Usually your Twilio number in E.164 (e.g. +14155238886). Twilio prefixes it with{" "}
              <code>whatsapp:</code> automatically.
            </p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 sm:flex sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Enable WhatsApp</div>
              <div className="text-xs text-muted-foreground">
                Turn this on after the sender is approved in Twilio.
              </div>
            </div>
            <Switch
              aria-label="Enable WhatsApp"
              checked={number.whatsapp_enabled}
              onCheckedChange={(val) => enableM.mutate(val)}
              disabled={enableM.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <a
            href="https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open Twilio WhatsApp Senders <ExternalLink className="size-3" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
