import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  Bot,
  Loader2,
  Save,
  Upload,
  Trash2,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Plus,
} from "lucide-react";
import {
  fetchKnowledgeDocs,
  createKnowledgeDoc,
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  fetchDraftFeedback,
  readTextFile,
  KNOWLEDGE_ACCEPT,
} from "@/lib/ai-knowledge";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { useTenancy } from "@/lib/tenancy";
import { fetchBookingPages } from "@/lib/booking";
import {
  fetchAiSettings,
  saveAiSettings,
  defaultAiSettings,
  TONE_OPTIONS,
  type AiAssistantSettings,
} from "@/lib/ai-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/states";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI reply assistant | Click Away CRM" },
      {
        name: "description",
        content:
          "Teach the AI assistant about your business so it can draft replies to customers and opportunities in your inbox.",
      },
      { property: "og:title", content: "AI reply assistant | Click Away CRM" },
      {
        property: "og:description",
        content: "Business knowledge, tone and escalation rules for AI-suggested customer replies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiAssistantSettingsPage,
});

function AiAssistantSettingsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [form, setForm] = useState<AiAssistantSettings | null>(null);

  const settingsQ = useQuery({
    queryKey: ["ai-assistant-settings", subId],
    enabled: !!subId,
    queryFn: () => fetchAiSettings(subId!),
  });

  const pagesQ = useQuery({
    queryKey: ["booking-pages", subId],
    enabled: !!subId,
    queryFn: () => fetchBookingPages(subId!),
  });

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
    else if (subId && settingsQ.isSuccess) setForm(defaultAiSettings(subId));
  }, [settingsQ.data, settingsQ.isSuccess, subId]);

  const saveMut = useMutation({
    mutationFn: async () => saveAiSettings(form!),
    onSuccess: () => {
      toast.success("AI assistant settings saved");
      qc.invalidateQueries({ queryKey: ["ai-assistant-settings", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AiAssistantSettings>(key: K, value: AiAssistantSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <>
      <PageHeader
        title="AI reply assistant"
        description="Drafts replies to customers in your inbox. A teammate always reviews before anything sends."
        actions={
          <Button onClick={() => saveMut.mutate()} disabled={!form || saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1" />
            )}
            Save
          </Button>
        }
      />
      <PageBody>
        {settingsQ.isError ? (
          <ErrorState onRetry={() => settingsQ.refetch()} />
        ) : !form ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-6">
              <section className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-sm font-bold">Assistant enabled</h2>
                    <p className="text-xs text-muted-foreground">
                      When on, an “AI draft” button appears in every inbox thread.
                    </p>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => set("enabled", v)}
                    aria-label="Enable AI reply assistant"
                  />
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div>
                  <Label htmlFor="business-info">What should the assistant know?</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Services, pricing, opening hours, areas you cover, common questions — anything you
                    would tell a new team member. The assistant never invents facts beyond this.
                  </p>
                </div>
                <Textarea
                  id="business-info"
                  rows={12}
                  value={form.business_info}
                  onChange={(e) => set("business_info", e.target.value)}
                  placeholder={"We are Click Away Finance, a UK mortgage broker.\nHours: Mon–Fri 9am–6pm.\nWe do not charge broker fees.\nTypical first call takes 20 minutes."}
                />
              </section>

              <KnowledgeBaseSection subId={subId} />

              <section className="rounded-lg border border-border bg-card p-4 space-y-3">
                <Label htmlFor="extra">Extra instructions (optional)</Label>
                <Textarea
                  id="extra"
                  rows={4}
                  value={form.extra_instructions}
                  onChange={(e) => set("extra_instructions", e.target.value)}
                  placeholder="Always ask for the property value before quoting. Never discuss credit scores over SMS."
                />
                <Label htmlFor="signature">Sign-off (optional)</Label>
                <Input
                  id="signature"
                  value={form.signature}
                  onChange={(e) => set("signature", e.target.value)}
                  placeholder="— Team Click Away"
                />
              </section>

              <FeedbackSection subId={subId} />
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h2 className="font-display text-sm font-bold">Tone</h2>
                <select
                  aria-label="Reply tone"
                  value={form.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </section>

              <section className="rounded-lg border border-border bg-card p-4 space-y-4">
                <h2 className="font-display text-sm font-bold">Context</h2>
                <ToggleRow
                  label="Use contact details"
                  hint="Name, email, phone and lifecycle stage."
                  checked={form.use_contact_context}
                  onChange={(v) => set("use_contact_context", v)}
                />
                <ToggleRow
                  label="Use opportunity details"
                  hint="Their latest deal and pipeline stage."
                  checked={form.use_deal_context}
                  onChange={(v) => set("use_deal_context", v)}
                />
                <ToggleRow
                  label="Escalate to a human"
                  hint="Flag threads the assistant should not answer alone."
                  checked={form.suggest_escalation}
                  onChange={(v) => set("suggest_escalation", v)}
                />
              </section>

              <section className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h2 className="font-display text-sm font-bold">Booking link</h2>
                <ToggleRow
                  label="Offer a booking link"
                  hint="The assistant can invite customers to book a time."
                  checked={form.offer_booking_link}
                  onChange={(v) => set("offer_booking_link", v)}
                />
                <select
                  aria-label="Booking page"
                  disabled={!form.offer_booking_link}
                  value={form.booking_page_id ?? ""}
                  onChange={(e) => set("booking_page_id", e.target.value || null)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="">First enabled booking page</option>
                  {(pagesQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </section>

              <div className="rounded-lg border border-border bg-secondary/40 p-4 text-xs text-muted-foreground flex gap-2">
                <Bot className="size-4 shrink-0 mt-0.5" />
                <p>
                  Drafts are never sent automatically. Open a thread in Conversations, press
                  <strong className="text-foreground"> AI draft</strong>, edit if needed, then send.
                </p>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
