import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Trash2, Webhook, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Webhook className="size-6" /> WordPress
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receive form submissions from any WordPress site as leads. Works with WPForms,
            Gravity Forms, Fluent Forms, Contact Form 7, Elementor Forms, and a plain{" "}
            <code>functions.php</code> snippet.
          </p>
        </div>

        {!subId || !userId ? (
          <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
            Select a workspace to configure WordPress webhooks.
          </div>
        ) : (
          <WebhooksPanel subId={subId} userId={userId} />
        )}
      </div>
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

  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border p-5 space-y-3">
        <h2 className="font-medium">Create webhook</h2>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-56">
            <Label className="text-xs">Site or form name</Label>
            <Input
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
        <p className="text-xs text-muted-foreground">
          An HMAC secret is recommended: WordPress signs each request and the endpoint verifies
          the signature before creating a lead.
        </p>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No webhooks yet. Create one above to get a URL you can paste into WordPress.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((h) => (
            <WebhookRow key={h.id} hook={h} subId={subId} />
          ))}
        </div>
      )}
    </div>
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium flex items-center gap-2">
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
          <Switch checked={hook.enabled} onCheckedChange={() => toggle.mutate()} />
          <Button variant="ghost" size="icon" onClick={() => del.mutate()} title="Delete">
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

      <SetupInstructions url={url} secret={hook.secret} />
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
