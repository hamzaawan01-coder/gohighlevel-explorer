import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleTips, StatusPill } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Workflow } from "lucide-react";
import { useTenancy } from "@/lib/tenancy";
import { getCallFlow, saveCallFlow, listMyNumbers } from "@/lib/twilio.functions";
import { EmptyState, PanelSkeleton } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/settings/call-flows")({
  head: () => ({
    meta: [
      { title: "Call flows — Settings" },
      { name: "description", content: "Configure IVR greeting, agent ringing, and voicemail per phone number." },
    ],
  }),
  component: CallFlowsPage,
});

function CallFlowsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const listNumbers = useServerFn(listMyNumbers);
  const fetchFlow = useServerFn(getCallFlow);
  const save = useServerFn(saveCallFlow);
  const qc = useQueryClient();

  const [numberId, setNumberId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: null as string | null,
    name: "Default flow",
    greetingText: "Thank you for calling. Please hold while we connect you.",
    voiceLanguage: "en-US",
    voiceGender: "alice",
    ringTimeoutSeconds: 20,
    voicemailEnabled: true,
    voicemailPrompt: "Please leave a message after the tone.",
    isDefault: true,
  });

  const numbers = useQuery({
    queryKey: ["twilio-numbers", subId],
    queryFn: () => listNumbers({ data: { subAccountId: subId! } }),
    enabled: !!subId,
  });

  const flow = useQuery({
    queryKey: ["call-flow", subId, numberId],
    queryFn: () => fetchFlow({ data: { subAccountId: subId!, twilioNumberId: numberId } }),
    enabled: !!subId,
  });

  useEffect(() => {
    if (flow.data) {
      setForm({
        id: flow.data.id,
        name: flow.data.name,
        greetingText: flow.data.greeting_text ?? "",
        voiceLanguage: flow.data.voice_language ?? "en-US",
        voiceGender: flow.data.voice_gender ?? "alice",
        ringTimeoutSeconds: flow.data.ring_timeout_seconds ?? 20,
        voicemailEnabled: flow.data.voicemail_enabled ?? true,
        voicemailPrompt: flow.data.voicemail_prompt ?? "",
        isDefault: flow.data.is_default ?? false,
      });
    } else if (flow.isFetched && !flow.data) {
      setForm((f) => ({ ...f, id: null }));
    }
  }, [flow.data, flow.isFetched]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          subAccountId: subId!,
          id: form.id,
          name: form.name,
          twilioNumberId: numberId,
          greetingText: form.greetingText,
          voiceLanguage: form.voiceLanguage,
          voiceGender: form.voiceGender,
          ringTimeoutSeconds: form.ringTimeoutSeconds,
          voicemailEnabled: form.voicemailEnabled,
          voicemailPrompt: form.voicemailPrompt,
          isDefault: form.isDefault,
        },
      }),
    onSuccess: () => {
      toast.success("Call flow saved");
      qc.invalidateQueries({ queryKey: ["call-flow", subId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <AppShell>
      <PageHeader
        title="Call flows"
        description="Greeting, ringing behavior, and voicemail — per number or workspace default."
        crumbs={[{ label: "Settings" }, { label: "Call flows" }]}
        meta={form.id ? <StatusPill ok label="Saved" /> : <StatusPill ok={false} label="Unsaved" />}
        actions={
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !subId}>
            {mut.isPending ? "Saving…" : "Save call flow"}
          </Button>
        }
      />
      <PageBody width="full">
        <SettingsShell>
        {!subId ? (
          <EmptyState icon={Workflow} title="Select a workspace" description="Choose a workspace to configure call flows." />
        ) : flow.isLoading ? (
          <PanelSkeleton />
        ) : (
          <ConsoleSplit
            main={
              <ConsoleSection title="Call flow" icon={Workflow} hint={numberId ? "This number" : "Workspace default"}>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-applies">Applies to</Label>
                    <Select value={numberId ?? "default"} onValueChange={(v) => setNumberId(v === "default" ? null : v)}>
                      <SelectTrigger id="cf-applies"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Workspace default (all numbers)</SelectItem>
                        {(numbers.data ?? []).map((n: any) => (
                          <SelectItem key={n.id} value={n.id}>{n.friendly_name} · {n.phone_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cf-name">Flow name</Label>
                    <Input id="cf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cf-greeting">Greeting (Text-to-Speech)</Label>
                    <Textarea
                      id="cf-greeting"
                      rows={3}
                      value={form.greetingText}
                      onChange={(e) => setForm({ ...form, greetingText: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cf-voice">Voice</Label>
                      <Select value={form.voiceGender} onValueChange={(v) => setForm({ ...form, voiceGender: v })}>
                        <SelectTrigger id="cf-voice"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alice">Alice (female)</SelectItem>
                          <SelectItem value="man">Man</SelectItem>
                          <SelectItem value="woman">Woman</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cf-lang">Language</Label>
                      <Select value={form.voiceLanguage} onValueChange={(v) => setForm({ ...form, voiceLanguage: v })}>
                        <SelectTrigger id="cf-lang"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="en-GB">English (UK)</SelectItem>
                          <SelectItem value="es-ES">Spanish</SelectItem>
                          <SelectItem value="fr-FR">French</SelectItem>
                          <SelectItem value="de-DE">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cf-timeout">Ring timeout (seconds)</Label>
                    <Input
                      id="cf-timeout"
                      type="number"
                      min={5}
                      max={120}
                      value={form.ringTimeoutSeconds}
                      onChange={(e) => setForm({ ...form, ringTimeoutSeconds: parseInt(e.target.value) || 20 })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      All workspace members with the softphone open will be rung simultaneously.
                    </p>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4 sm:flex sm:justify-between">
                    <div className="min-w-0">
                      <Label>Voicemail</Label>
                      <p className="text-[11px] text-muted-foreground">Record &amp; transcribe when no agent answers.</p>
                    </div>
                    <Switch
                      aria-label="Enable voicemail"
                      checked={form.voicemailEnabled}
                      onCheckedChange={(v) => setForm({ ...form, voicemailEnabled: v })}
                    />
                  </div>

                  {form.voicemailEnabled && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cf-vm-prompt">Voicemail prompt</Label>
                      <Textarea
                        id="cf-vm-prompt"
                        rows={2}
                        value={form.voicemailPrompt}
                        onChange={(e) => setForm({ ...form, voicemailPrompt: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4 sm:flex sm:justify-between">
                    <div className="min-w-0">
                      <Label>Default flow</Label>
                      <p className="text-[11px] text-muted-foreground">Used for any number without its own flow.</p>
                    </div>
                    <Switch
                      aria-label="Set as default flow"
                      checked={form.isDefault}
                      onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                    />
                  </div>
                </div>
              </ConsoleSection>
            }
            side={
              <ConsoleTips
                items={[
                  "Numbers without their own flow fall back to the workspace default.",
                  "Ring timeout applies before falling through to voicemail (if enabled).",
                  "Greeting text is read with Twilio's text-to-speech — keep it short and clear.",
                ]}
              />
            }
          />
        )}
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
