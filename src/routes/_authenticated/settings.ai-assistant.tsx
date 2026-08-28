import { SettingsNav } from "@/components/SettingsNav";
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
        <SettingsNav />
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

function KnowledgeBaseSection({ subId }: { subId: string | null }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const docsQ = useQuery({
    queryKey: ["ai-knowledge", subId],
    enabled: !!subId,
    queryFn: () => fetchKnowledgeDocs(subId!),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ai-knowledge", subId] });

  const addMut = useMutation({
    mutationFn: async (input: { title: string; content: string; sourceName?: string | null }) => {
      if (!subId) throw new Error("Pick a workspace first");
      if (!input.content.trim()) throw new Error("Add some text before saving");
      await createKnowledgeDoc({ subAccountId: subId, ...input });
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      invalidate();
      toast.success("Added to the knowledge base");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => updateKnowledgeDoc(v.id, { enabled: v.enabled }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeDoc(id),
    onSuccess: () => {
      invalidate();
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const text = await readTextFile(file);
        if (!text) {
          toast.error(`${file.name} looks empty`);
          continue;
        }
        await addMut.mutateAsync({
          title: file.name.replace(/\.[^.]+$/, ""),
          content: text,
          sourceName: file.name,
        });
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-display text-sm font-bold">Knowledge base</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload FAQs, price lists, policies or service notes. The assistant answers from these
          documents and treats them as the source of truth. Text files (.txt, .md, .csv, .json,
          .html) — for PDFs or Word docs, copy the text and paste it below.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={KNOWLEDGE_ACCEPT}
          className="hidden"
          aria-label="Upload knowledge files"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!subId || addMut.isPending}>
          {addMut.isPending ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Upload className="size-3.5 mr-1" />
          )}
          Upload files
        </Button>
        <span className="text-xs text-muted-foreground">
          {(docsQ.data ?? []).length} document{(docsQ.data ?? []).length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <Label htmlFor="kb-title">Or paste text</Label>
        <Input
          id="kb-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Pricing FAQ"
        />
        <Textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Q: Do you charge broker fees? A: No, we never charge broker fees."
          aria-label="Knowledge document text"
        />
        <Button
          size="sm"
          onClick={() => addMut.mutate({ title, content })}
          disabled={!subId || !content.trim() || addMut.isPending}
        >
          <Plus className="size-3.5 mr-1" /> Add document
        </Button>
      </div>

      {docsQ.isError ? (
        <ErrorState onRetry={() => docsQ.refetch()} />
      ) : (docsQ.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No documents yet — the assistant will rely only on the business information above.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(docsQ.data ?? []).map((d) => (
            <li key={d.id} className="flex items-start gap-3 p-3">
              <FileText className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{d.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.source_name ? `${d.source_name} · ` : ""}
                  {d.content.length.toLocaleString()} characters
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.content.slice(0, 200)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={d.enabled}
                  onCheckedChange={(v) => toggleMut.mutate({ id: d.id, enabled: v })}
                  aria-label={`Use ${d.title} when drafting`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${d.title}`}
                  onClick={() => removeMut.mutate(d.id)}
                  disabled={removeMut.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackSection({ subId }: { subId: string | null }) {
  const fbQ = useQuery({
    queryKey: ["ai-draft-feedback", subId],
    enabled: !!subId,
    queryFn: () => fetchDraftFeedback(subId!),
  });
  const rows = fbQ.data ?? [];
  const up = rows.filter((r) => r.rating === "up").length;
  const down = rows.length - up;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="font-display text-sm font-bold">Draft feedback</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Rate drafts in Conversations with thumbs up or down. Recent ratings are fed back into the
          assistant so it copies what worked and avoids what didn't.
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-primary">
          <ThumbsUp className="size-3.5" /> {up}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <ThumbsDown className="size-3.5" /> {down}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No ratings yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-2">
                {r.rating === "up" ? (
                  <ThumbsUp className="size-3 text-primary" />
                ) : (
                  <ThumbsDown className="size-3 text-destructive" />
                )}
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                  {r.channel ? ` · ${r.channel}` : ""}
                </span>
              </div>
              {r.note && <p className="mt-1 text-foreground">“{r.note}”</p>}
              <p className="mt-1 text-muted-foreground line-clamp-2">{r.draft}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
