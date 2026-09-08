import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { EmptyState, ListSkeleton, ErrorState, PanelSkeleton } from "@/components/ui/states";
import { ConsoleSection, ConsoleSplit, ConsoleStat, ConsoleTips, StatusPill } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Copy,
  Trash2,
  Webhook,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  X,
  Wand2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhooks,
  updateWebhook,
  webhookUrl,
  type WordPressWebhook,
} from "@/lib/wordpress-webhooks";
import {
  BUILTIN_ALIASES,
  STANDARD_KEYS,
  mapPayload,
  type FieldMap,
  type StandardKey,
} from "@/lib/wordpress-field-map";
import { formatDistanceToNow } from "date-fns";


export const Route = createFileRoute("/_authenticated/settings/wordpress")({
  head: () => ({ meta: [{ title: "WordPress — Settings" }] }),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="p-8 text-sm text-destructive">{error.message}</div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-sm text-muted-foreground">Page not found.</div>
    </AppShell>
  ),
  component: WordPressPage,
});

function WordPressPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const statusQ = useQuery({
    queryKey: ["wp-webhooks", subId],
    enabled: !!subId,
    queryFn: () => fetchWebhooks(subId!),
  });
  const hasLiveWebhook = (statusQ.data ?? []).some((h) => h.enabled);

  return (
    <AppShell>
      <PageHeader
        title="WordPress"
        description={
          <>
            Receive form submissions from any WordPress site as leads. Works with WPForms, Gravity
            Forms, Fluent Forms, Contact Form 7, Elementor Forms, and a plain{" "}
            <code>functions.php</code> snippet.
          </>
        }
        crumbs={[{ label: "Settings" }, { label: "WordPress" }]}
        meta={
          subId && statusQ.data ? (
            <StatusPill ok={hasLiveWebhook} label={hasLiveWebhook ? "Live" : "No live webhook"} />
          ) : null
        }
      />
      <PageBody width="full">
        <SettingsShell>
        {!subId || !userId ? (
          <EmptyState icon={Webhook} title="Select a workspace" description="Select a workspace to configure WordPress webhooks." />
        ) : (
          <WebhooksPanel subId={subId} userId={userId} />
        )}
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}

function WebhooksPanel({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wp-webhooks", subId], queryFn: () => fetchWebhooks(subId) });
  const [newName, setNewName] = useState("");
  const [withSecret, setWithSecret] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      createWebhook({
        name: newName.trim() || "Main site",
        subAccountId: subId,
        ownerId: userId,
        generateSecret: withSecret,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] });
      setNewName("");
      toast.success("Webhook created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} error={q.error} />;
  if (q.isLoading) return <PanelSkeleton />;

  const rows = q.data ?? [];
  const liveCount = rows.filter((h) => h.enabled).length;

  return (
    <ConsoleSplit
      main={
        <>
          <ConsoleSection title="Create webhook" icon={Plus} hint="Generate a URL to paste into WordPress">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="wp-new-name" className="text-xs">Site or form name</Label>
                <Input
                  id="wp-new-name"
                  placeholder="e.g. Main site — Contact form"
                  value={newName}
                  maxLength={80}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={withSecret} onCheckedChange={setWithSecret} id="wp-secret" />
                <Label htmlFor="wp-secret" className="text-sm">
                  Generate HMAC secret
                </Label>
              </div>
              <Button disabled={create.isPending} onClick={() => create.mutate()}>
                Create
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              An HMAC secret is recommended: WordPress signs each request and the endpoint verifies
              the signature before creating a lead.
            </p>
          </ConsoleSection>

          <ConsoleSection title="Webhooks" icon={Webhook} hint={`${rows.length} configured`}>
            {rows.length === 0 ? (
              <EmptyState
                compact
                icon={Webhook}
                title="No webhooks yet"
                description="Create one above to get a URL you can paste into WordPress."
              />
            ) : (
              <div className="space-y-4">
                {rows.map((h) => (
                  <WebhookRow key={h.id} hook={h} subId={subId} />
                ))}
              </div>
            )}
          </ConsoleSection>
        </>
      }
      side={
        <>
          <ConsoleSection title="Webhook health">
            <ConsoleStat label="Total webhooks" value={rows.length} />
            <ConsoleStat label="Live" value={liveCount} tone={liveCount > 0 ? "ok" : "muted"} />
            <ConsoleStat label="Disabled" value={rows.length - liveCount} tone={rows.length - liveCount > 0 ? "warn" : "muted"} />
          </ConsoleSection>
          <ConsoleTips
            items={[
              "An HMAC secret lets the endpoint verify each request actually came from your WordPress site.",
              "Use the setup instructions on each webhook for form-plugin-specific steps.",
              "Field mapping controls which WordPress form fields become contact fields vs. payload extras.",
            ]}
          />
        </>
      }
    />
  );
}

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Could not copy"),
  );
}

function WebhookRow({ hook, subId }: { hook: WordPressWebhook; subId: string }) {
  const qc = useQueryClient();
  const url = webhookUrl(hook.token);

  const toggle = useMutation({
    mutationFn: () => updateWebhook(hook.id, { enabled: !hook.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] }),
  });
  const del = useMutation({
    mutationFn: () => deleteWebhook(hook.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] });
      toast.success("Webhook deleted");
    },
  });
  const rotate = useMutation({
    mutationFn: () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return updateWebhook(hook.id, { secret });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] });
      toast.success("New secret generated");
    },
  });

  return (
    <div className="rounded-md border border-border p-5 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2 truncate">
            {hook.name}
            {hook.enabled ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3 text-green-500" /> Live
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="size-3" /> Disabled
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {hook.last_received_at
              ? `Last received ${formatDistanceToNow(new Date(hook.last_received_at), { addSuffix: true })}`
              : "No submissions yet"}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Switch aria-label={`${hook.enabled ? "Disable" : "Enable"} ${hook.name}`} checked={hook.enabled} onCheckedChange={() => toggle.mutate()} />
          <Button variant="ghost" size="icon" aria-label={`Delete ${hook.name}`} onClick={() => del.mutate()} title="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Webhook URL</Label>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button variant="outline" onClick={() => copy(url, "URL copied")}>
            <Copy className="size-4" />
          </Button>
        </div>
      </div>

      {hook.secret && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">HMAC secret</Label>
            <Button variant="ghost" size="sm" onClick={() => rotate.mutate()} className="h-7">
              <RefreshCw className="size-3 mr-1" /> Rotate
            </Button>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={hook.secret} className="font-mono text-xs" type="password" />
            <Button variant="outline" onClick={() => copy(hook.secret!, "Secret copied")}>
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send header <code>x-wp-signature: sha256=&lt;hex hmac_sha256(raw_body, secret)&gt;</code>.
          </p>
        </div>
      )}

      <LabelMapper hook={hook} subId={subId} />

      <FieldMappingPreview hook={hook} subId={subId} />

      <SetupInstructions url={url} secret={hook.secret} />
    </div>
  );
}

function LabelMapper({ hook, subId }: { hook: WordPressWebhook; subId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FieldMap>(() => (hook.field_map ?? {}) as FieldMap);

  useEffect(() => {
    setDraft((hook.field_map ?? {}) as FieldMap);
  }, [hook.field_map]);

  const submissionsQ = useQuery({
    queryKey: ["wp-webhook-submissions", hook.form_id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("payload, created_at")
        .eq("form_id", hook.form_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Aggregate all unique keys seen recently, with a sample value.
  const seenKeys = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of submissionsQ.data ?? []) {
      const p = (row.payload ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        if (!map.has(k)) {
          const s = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
          map.set(k, s.slice(0, 60));
        }
      }
    }
    return Array.from(map.entries()).map(([key, sample]) => ({ key, sample }));
  }, [submissionsQ.data]);

  // Build alias → std lookup from BUILTIN + current draft.
  const currentTargetFor = (key: string): StandardKey | "extra" => {
    const nk = key.toLowerCase().replace(/[\s\-_.]+/g, "_");
    for (const std of STANDARD_KEYS) {
      if (nk === std.toLowerCase().replace(/[\s\-_.]+/g, "_")) return std;
      for (const a of BUILTIN_ALIASES[std]) {
        if (nk === a.toLowerCase().replace(/[\s\-_.]+/g, "_")) return std;
      }
      for (const a of draft[std] ?? []) {
        if (nk === a.toLowerCase().replace(/[\s\-_.]+/g, "_")) return std;
      }
    }
    return "extra";
  };

  const assign = (rawKey: string, target: StandardKey | "extra") => {
    setDraft((d) => {
      const next: FieldMap = { ...d };
      // Remove this key from every list first.
      for (const std of STANDARD_KEYS) {
        const list = (next[std] ?? []).filter((a) => a !== rawKey);
        next[std] = list;
      }
      if (target !== "extra") {
        const list = next[target] ?? [];
        if (!list.includes(rawKey)) list.push(rawKey);
        next[target] = list;
      }
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    const current = (hook.field_map ?? {}) as FieldMap;
    return JSON.stringify(normalizeMap(current)) !== JSON.stringify(normalizeMap(draft));
  }, [hook.field_map, draft]);

  const save = useMutation({
    mutationFn: () =>
      updateWebhook(hook.id, { field_map: normalizeMap(draft) as Record<string, string[]> }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] });
      toast.success("Label mappings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  if (!open) {
    return (
      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Wand2 className="size-3 mr-1" /> Map form labels
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm flex items-center gap-2">
            <Wand2 className="size-4" /> Form label mappings
          </div>
          <p className="text-xs text-muted-foreground">
            Detected from the last 25 submissions. Assign each label to a contact field — no code
            required. Labels marked <b>payload extra</b> stay on the submission record.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>

      {submissionsQ.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading recent submissions…</div>
      ) : seenKeys.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          No submissions received yet. Submit the WordPress form once so labels appear here, then
          come back to map them.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-background divide-y divide-border text-xs">
          {seenKeys.map(({ key, sample }) => {
            const target = currentTargetFor(key);
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_180px] items-center gap-2 p-2"
              >
                <div className="min-w-0">
                  <div className="font-mono truncate">{key}</div>
                  <div className="text-muted-foreground truncate">{sample || "—"}</div>
                </div>
                <ArrowRight className="size-3 text-muted-foreground" />
                <Select
                  value={target}
                  onValueChange={(v) => assign(key, v as StandardKey | "extra")}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_KEYS.map((k) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {k}
                      </SelectItem>
                    ))}
                    <SelectItem value="extra" className="text-xs">
                      payload extra
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => submissionsQ.refetch()}
          disabled={submissionsQ.isFetching}
        >
          <RefreshCw className="size-3 mr-1" /> Refresh labels
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasChanges || save.isPending}
            onClick={() => setDraft((hook.field_map ?? {}) as FieldMap)}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!hasChanges || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save mappings"}
          </Button>
        </div>
      </div>
    </div>
  );
}



function SetupInstructions({ url, secret }: { url: string; secret: string | null }) {
  const [tab, setTab] = useState("functions");
  const phpSnippet = useMemo(() => buildPhpSnippet(url, secret), [url, secret]);
  const wpformsSnippet = useMemo(() => buildFieldMappingHint("WPForms"), []);
  const gravitySnippet = useMemo(() => buildFieldMappingHint("Gravity Forms Webhooks add-on"), []);
  const cf7Snippet = useMemo(() => buildCf7Snippet(url, secret), [url, secret]);

  return (
    <div className="mt-2">
      <Label className="text-xs">Setup instructions</Label>
      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="functions">functions.php (any form)</TabsTrigger>
          <TabsTrigger value="wpforms">WPForms</TabsTrigger>
          <TabsTrigger value="gravity">Gravity Forms</TabsTrigger>
          <TabsTrigger value="cf7">Contact Form 7</TabsTrigger>
          <TabsTrigger value="elementor">Elementor</TabsTrigger>
        </TabsList>

        <TabsContent value="functions" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Paste this into your active theme's <code>functions.php</code> (or a small custom
            plugin). It forwards every WordPress admin-email notification to the webhook, so
            no plugin is required.
          </p>
          <CodeBlock code={phpSnippet} />
        </TabsContent>

        <TabsContent value="wpforms" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            In WPForms (Pro), open your form → <b>Settings → Webhooks</b> → add a new webhook.
          </p>
          <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
            <li>
              Request URL: <code className="text-foreground">{url}</code>
            </li>
            <li>Request Method: POST</li>
            <li>Format: JSON</li>
            {secret && (
              <li>
                Add header <code>x-wp-signature</code>: only WPForms Elite supports HMAC — if
                yours doesn't, remove the secret from this webhook to skip signature checks.
              </li>
            )}
            <li>Map form fields using the aliases listed below.</li>
          </ol>
          <p className="text-xs text-muted-foreground">{wpformsSnippet}</p>
        </TabsContent>

        <TabsContent value="gravity" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Install the free <b>Gravity Forms Webhooks add-on</b>, then add a feed to your form:
          </p>
          <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
            <li>
              Request URL: <code className="text-foreground">{url}</code>
            </li>
            <li>Request Method: POST · Format: JSON</li>
            <li>Field values: send the form fields as top-level keys.</li>
          </ol>
          <p className="text-xs text-muted-foreground">{gravitySnippet}</p>
        </TabsContent>

        <TabsContent value="cf7" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Contact Form 7 has no built-in webhook. Paste this into <code>functions.php</code> and
            it will fire on every CF7 submit:
          </p>
          <CodeBlock code={cf7Snippet} />
        </TabsContent>

        <TabsContent value="elementor" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Elementor Pro Forms has a native <b>Webhook</b> action — no plugin or code needed.
          </p>
          <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
            <li>Edit your form widget → <b>Content → Actions After Submit</b> → add <b>Webhook</b>.</li>
            <li>Open the new <b>Webhook</b> section below.</li>
            <li>
              Webhook URL: <code className="text-foreground break-all">{url}</code>
            </li>
            <li>Advanced Data: <b>On</b> (sends field IDs and meta as JSON).</li>
            <li>
              In each form field's <b>Advanced</b> tab, set the <b>ID</b> to one of the aliases
              below (e.g. <code>email</code>, <code>first_name</code>, <code>phone</code>). Any
              other field ID is kept on the submission record as-is.
            </li>
            {secret && (
              <li>
                Elementor's built-in webhook can't sign requests. Either delete the HMAC secret on
                this webhook, or use the <b>functions.php</b> snippet instead (it signs the
                payload).
              </li>
            )}
          </ol>
          <p className="text-xs text-muted-foreground">
            Free Elementor doesn't include the Webhook action. If you're on the free version, use
            the <b>functions.php</b> tab — it also catches Elementor form submissions via the{" "}
            <code>elementor_pro/forms/new_record</code> hook when Pro is present, and via the
            generic mail hook otherwise.
          </p>
        </TabsContent>
      </Tabs>


      <div className="mt-4 rounded-md border border-border p-4 text-xs space-y-1">
        <div className="font-medium text-foreground">Recognized field aliases</div>
        <div className="text-muted-foreground">
          <b>email</b>: email, your-email, email-address · <b>first_name</b>: first_name,
          firstname, fname, your-name, name · <b>last_name</b>: last_name, lastname, lname ·{" "}
          <b>phone</b>: phone, telephone, your-phone · <b>company</b>: company, organization ·{" "}
          <b>notes</b>: message, your-message, comments, notes
        </div>
        <div className="text-muted-foreground">
          Any other field is preserved on the submission record.
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-72 whitespace-pre">
        <code>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-7"
        onClick={() => copy(code, "Snippet copied")}
      >
        <Copy className="size-3 mr-1" /> Copy
      </Button>
    </div>
  );
}

function buildFieldMappingHint(plugin: string): string {
  return `In ${plugin}, use the exact field names shown below (email, first_name, phone, etc.) or map your existing field slugs to those keys.`;
}

function buildPhpSnippet(url: string, secret: string | null): string {
  const sig = secret
    ? `
    $sig = hash_hmac('sha256', $body, ${JSON.stringify(secret)});
    $headers['x-wp-signature'] = 'sha256=' . $sig;`
    : "";
  return `<?php
// Forward all form submissions to the CRM.
add_action('wpforms_process_complete', 'crm_send_wpforms', 10, 4);
function crm_send_wpforms($fields, $entry, $form_data, $entry_id) {
    $payload = [];
    foreach ($fields as $f) { $payload[sanitize_key($f['name'] ?? $f['id'])] = $f['value']; }
    crm_send_to_webhook($payload);
}
add_action('gform_after_submission', 'crm_send_gform', 10, 2);
function crm_send_gform($entry, $form) {
    $payload = [];
    foreach ($form['fields'] as $f) { $payload[sanitize_key($f->label)] = rgar($entry, (string)$f->id); }
    crm_send_to_webhook($payload);
}
// Elementor Pro Forms
add_action('elementor_pro/forms/new_record', function ($record, $handler) {
    $payload = [];
    foreach ($record->get('fields') as $id => $f) {
        $payload[sanitize_key($f['id'] ?: $id)] = $f['value'];
    }
    $payload['source_url'] = home_url(add_query_arg(null, null));
    crm_send_to_webhook($payload);
}, 10, 2);
function crm_send_to_webhook($payload) {
    $body = wp_json_encode($payload);
    $headers = ['Content-Type' => 'application/json'];${sig}
    wp_remote_post(${JSON.stringify(url)}, [
        'headers' => $headers,
        'body'    => $body,
        'timeout' => 8,
        'blocking'=> false,
    ]);
}`;
}

function buildCf7Snippet(url: string, secret: string | null): string {
  const sig = secret
    ? `
    $sig = hash_hmac('sha256', $body, ${JSON.stringify(secret)});
    $headers['x-wp-signature'] = 'sha256=' . $sig;`
    : "";
  return `<?php
add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;
    $payload = $submission->get_posted_data();
    $payload['source_url'] = $submission->get_meta('url');
    $body = wp_json_encode($payload);
    $headers = ['Content-Type' => 'application/json'];${sig}
    wp_remote_post(${JSON.stringify(url)}, [
        'headers' => $headers,
        'body'    => $body,
        'timeout' => 8,
        'blocking'=> false,
    ]);
});`;
}

const SAMPLE_JSON = `{
  "your-name": "Jane Doe",
  "your-email": "jane@example.com",
  "your-phone": "+1 415 555 0134",
  "budget": "$5,000",
  "service": "Website redesign",
  "your-message": "Hi, please call me back."
}`;

function parseTestPayload(input: string): { data: Record<string, unknown> | null; error: string | null } {
  const text = input.trim();
  if (!text) return { data: null, error: "Paste a sample payload to preview." };
  // JSON
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { data: parsed as Record<string, unknown>, error: null };
      }
      return { data: null, error: "JSON must be an object, not an array." };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }
  // key=value & querystring
  try {
    const params = new URLSearchParams(text.replace(/\n+/g, "&"));
    const out: Record<string, unknown> = {};
    params.forEach((v, k) => {
      if (k) out[k] = v;
    });
    if (Object.keys(out).length === 0) return { data: null, error: "No key=value pairs found." };
    return { data: out, error: null };
  } catch {
    return { data: null, error: "Could not parse payload." };
  }
}

function FieldMappingPreview({ hook, subId }: { hook: WordPressWebhook; subId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(SAMPLE_JSON);
  const [draft, setDraft] = useState<FieldMap>(() => (hook.field_map ?? {}) as FieldMap);

  useEffect(() => {
    setDraft((hook.field_map ?? {}) as FieldMap);
  }, [hook.field_map]);

  const parsed = useMemo(() => parseTestPayload(input), [input]);
  const preview = useMemo(
    () => (parsed.data ? mapPayload(parsed.data, draft) : null),
    [parsed.data, draft],
  );

  const hasChanges = useMemo(() => {
    const current = (hook.field_map ?? {}) as FieldMap;
    return JSON.stringify(normalizeMap(current)) !== JSON.stringify(normalizeMap(draft));
  }, [hook.field_map, draft]);

  const save = useMutation({
    mutationFn: () => updateWebhook(hook.id, { field_map: normalizeMap(draft) as Record<string, string[]> }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-webhooks", subId] });
      toast.success("Field mapping saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  if (!open) {
    return (
      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Preview field mapping
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Field mapping preview</div>
          <p className="text-xs text-muted-foreground">
            Paste a sample submission (JSON or <code>key=value</code>) to see exactly what will
            happen. Add custom aliases below and re-check.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sample payload</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setInput(SAMPLE_JSON)}
            >
              Reset to sample
            </Button>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            spellCheck={false}
          />
          {parsed.error && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="size-3" /> {parsed.error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Result</Label>
          <div className="rounded-md border border-border bg-background text-xs">
            {!preview ? (
              <div className="p-4 text-muted-foreground">No preview yet.</div>
            ) : preview.rows.length === 0 ? (
              <div className="p-4 text-muted-foreground">Payload has no fields.</div>
            ) : (
              <div className="divide-y divide-border">
                {preview.rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2">
                    <div className="min-w-0">
                      <div className="font-mono truncate">{r.rawKey}</div>
                      <div className="text-muted-foreground truncate">{r.value || "—"}</div>
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <div className="min-w-0">
                      <TargetBadge target={r.target} />
                      <div className="text-muted-foreground text-[10px] mt-0.5 truncate">
                        {r.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preview && preview.splitFullName && (
            <div className="text-xs text-muted-foreground">
              Full name detected — split into first and last name automatically.
            </div>
          )}

          {preview && (
            <div className="text-xs text-muted-foreground pt-1">
              Contact fields:{" "}
              {STANDARD_KEYS.filter((k) => preview.mapped[k]).map((k) => (
                <Badge key={k} variant="secondary" className="mr-1 mb-1 font-normal">
                  {k}: {(preview.mapped[k] ?? "").slice(0, 24)}
                </Badge>
              ))}
              {STANDARD_KEYS.every((k) => !preview.mapped[k]) && (
                <span className="italic">nothing mapped — no contact would be created.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <div className="font-medium text-sm">Custom field aliases</div>
          <p className="text-xs text-muted-foreground">
            Add your form's actual field names so they map to the right contact field. Built-in
            aliases always apply too.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {STANDARD_KEYS.map((k) => (
            <AliasEditor
              key={k}
              stdKey={k}
              custom={draft[k] ?? []}
              onChange={(next) => setDraft((d) => ({ ...d, [k]: next }))}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasChanges || save.isPending}
            onClick={() => setDraft((hook.field_map ?? {}) as FieldMap)}
          >
            Discard
          </Button>
          <Button size="sm" disabled={!hasChanges || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save mapping"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeMap(m: FieldMap): FieldMap {
  const out: FieldMap = {};
  for (const k of STANDARD_KEYS) {
    const arr = (m[k] ?? []).map((s) => s.trim()).filter(Boolean);
    if (arr.length) out[k] = Array.from(new Set(arr));
  }
  return out;
}

function TargetBadge({ target }: { target: StandardKey | "extra" | "ignored" }) {
  if (target === "extra") {
    return (
      <Badge variant="outline" className="font-normal">
        payload extra
      </Badge>
    );
  }
  if (target === "ignored") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        ignored
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-normal gap-1">
      <CheckCircle2 className="size-3 text-green-500" /> {target}
    </Badge>
  );
}

function AliasEditor({
  stdKey,
  custom,
  onChange,
}: {
  stdKey: StandardKey;
  custom: string[];
  onChange: (next: string[]) => void;
}) {
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (custom.includes(v)) {
      setVal("");
      return;
    }
    onChange([...custom, v]);
    setVal("");
  };
  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="text-xs font-medium">{stdKey}</div>
      <div className="text-[10px] text-muted-foreground">
        Built-in: {BUILTIN_ALIASES[stdKey].join(", ")}
      </div>
      <div className="flex flex-wrap gap-1">
        {custom.length === 0 ? (
          <span className="text-[10px] text-muted-foreground italic">No custom aliases</span>
        ) : (
          custom.map((a) => (
            <Badge key={a} variant="secondary" className="gap-1 font-normal">
              {a}
              <button
                type="button"
                onClick={() => onChange(custom.filter((x) => x !== a))}
                className="hover:text-destructive"
                aria-label={`Remove ${a}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-1">
        <Input
          value={val}
          placeholder="e.g. form_field_abc123"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-7 text-xs"
        />
        <Button variant="outline" size="sm" className="h-7" onClick={add} disabled={!val.trim()}>
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

