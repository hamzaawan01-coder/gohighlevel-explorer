import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Trash2, Send, Copy, ExternalLink, Mail, MessageSquare, Link2, Share2, DollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  fetchTemplates, upsertTemplate, deleteTemplate, type MessageTemplate, type TemplateChannel,
  fetchCampaigns, upsertCampaign, deleteCampaign, type Campaign,
  fetchTriggerLinks, createTriggerLink, updateTriggerLink, deleteTriggerLink, type TriggerLink,
  fetchSocialPosts, upsertSocialPost, deleteSocialPost, type SocialPost, type SocialPlatform,
  fetchAdCampaigns, upsertAdCampaign, deleteAdCampaign, type AdCampaign, type AdPlatform, type AdCampaignStatus,
} from "@/lib/marketing";
import { sendCampaign } from "@/lib/marketing.functions";
import { LIFECYCLE_STAGES } from "@/lib/contacts";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Agency Engine" },
      { name: "description", content: "Email & SMS campaigns, templates, trigger links, social posts, ads." },
    ],
  }),
  component: MarketingPage,
});

function MarketingPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  if (!subId || !userId) {
    return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="p-6 overflow-y-auto h-full">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Marketing</h1>
          <p className="text-xs text-muted-foreground">Campaigns, templates, trackable links, social & ads — all in one place.</p>
        </div>
        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns"><Send className="size-3.5 mr-1.5" />Campaigns</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="size-3.5 mr-1.5" />Templates</TabsTrigger>
            <TabsTrigger value="links"><Link2 className="size-3.5 mr-1.5" />Trigger Links</TabsTrigger>
            <TabsTrigger value="social"><Share2 className="size-3.5 mr-1.5" />Social</TabsTrigger>
            <TabsTrigger value="ads"><DollarSign className="size-3.5 mr-1.5" />Ads</TabsTrigger>
          </TabsList>
          <TabsContent value="campaigns" className="mt-4"><CampaignsTab subId={subId} userId={userId} /></TabsContent>
          <TabsContent value="templates" className="mt-4"><TemplatesTab subId={subId} userId={userId} /></TabsContent>
          <TabsContent value="links" className="mt-4"><LinksTab subId={subId} userId={userId} /></TabsContent>
          <TabsContent value="social" className="mt-4"><SocialTab subId={subId} userId={userId} /></TabsContent>
          <TabsContent value="ads" className="mt-4"><AdsTab subId={subId} userId={userId} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ============================= CAMPAIGNS =============================
function CampaignsTab({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const send = useServerFn(sendCampaign);

  const q = useQuery({ queryKey: ["campaigns", subId], queryFn: () => fetchCampaigns(subId) });
  const del = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Deleted"); },
  });
  const sendMut = useMutation({
    mutationFn: (id: string) => send({ data: { campaignId: id } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success(`Enqueued ${r.enqueued} messages`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted-foreground">Bulk email or SMS to a segment of contacts.</p>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-3.5 mr-1.5" />New campaign
        </Button>
      </div>

      <div className="border border-border rounded-md divide-y">
        {q.isLoading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div> :
         !q.data?.length ? <div className="p-6 text-center text-sm text-muted-foreground">No campaigns yet.</div> :
         q.data.map((c) => (
          <div key={c.id} className="p-3 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {c.channel === "email" ? <Mail className="size-3.5 text-muted-foreground" /> : <MessageSquare className="size-3.5 text-muted-foreground" />}
                <span className="font-medium text-sm truncate">{c.name}</span>
                <Badge variant={c.status === "sent" ? "default" : c.status === "sending" ? "secondary" : "outline"} className="text-[10px]">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.sent_count}/{c.total_recipients} sent · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-1">
              {c.status === "draft" && (
                <Button size="sm" variant="outline" onClick={() => sendMut.mutate(c.id)} disabled={sendMut.isPending}>
                  <Send className="size-3.5 mr-1" />Send now
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setDialogOpen(true); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      <CampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} subId={subId} userId={userId} />
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, editing, subId, userId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Campaign | null; subId: string; userId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("email");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [stage, setStage] = useState<string>("__any");
  const [tagsInput, setTagsInput] = useState("");
  const [templateId, setTemplateId] = useState<string>("__none");

  const tplQ = useQuery({ queryKey: ["templates", subId], queryFn: () => fetchTemplates(subId) });

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setChannel(editing?.channel ?? "email");
      setSubject(editing?.subject ?? "");
      setBodyText(editing?.body_text ?? "");
      setBodyHtml(editing?.body_html ?? "");
      setStage((editing?.segment?.stage as string) ?? "__any");
      setTagsInput(((editing?.segment?.tags as string[]) ?? []).join(", "));
      setTemplateId(editing?.template_id ?? "__none");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const segment: Record<string, unknown> = {};
      if (stage !== "__any") segment.stage = stage;
      if (tags.length) segment.tags = tags;
      return upsertCampaign({
        id: editing?.id,
        sub_account_id: subId,
        created_by: userId,
        name,
        channel,
        subject: channel === "email" ? subject : null,
        body_text: bodyText || null,
        body_html: channel === "email" ? (bodyHtml || null) : null,
        segment,
        template_id: templateId === "__none" ? null : templateId,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === "__none") return;
    const t = tplQ.data?.find((x) => x.id === id);
    if (!t) return;
    setChannel(t.channel);
    setSubject(t.subject ?? "");
    setBodyText(t.body_text ?? "");
    setBodyHtml(t.body_html ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Load template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {(tplQ.data ?? []).filter((t) => t.channel === channel).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {channel === "email" && (
            <>
              <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div><Label>HTML body (optional)</Label><Textarea rows={4} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} /></div>
            </>
          )}
          <div><Label>{channel === "email" ? "Plain text body" : "Message"}</Label><Textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} /></div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Segment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lifecycle stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any stage</SelectItem>
                    {LIFECYCLE_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tags (comma-separated)</Label><Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, warm" /></div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Contacts must also have a valid {channel === "email" ? "email" : "phone"} address.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name}>Save as draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================= TEMPLATES =============================
function TemplatesTab({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const q = useQuery({ queryKey: ["templates", subId], queryFn: () => fetchTemplates(subId) });
  const del = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted-foreground">Reusable email & SMS content for campaigns and workflows.</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-3.5 mr-1.5" />New template</Button>
      </div>
      <div className="border border-border rounded-md divide-y">
        {q.isLoading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div> :
         !q.data?.length ? <div className="p-6 text-center text-sm text-muted-foreground">No templates yet.</div> :
         q.data.map((t) => (
          <div key={t.id} className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {t.channel === "email" ? <Mail className="size-3.5 text-muted-foreground" /> : <MessageSquare className="size-3.5 text-muted-foreground" />}
                <span className="font-medium text-sm">{t.name}</span>
              </div>
              {t.subject && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      <TemplateDialog open={open} onOpenChange={setOpen} editing={editing} subId={subId} userId={userId} />
    </div>
  );
}

function TemplateDialog({ open, onOpenChange, editing, subId, userId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: MessageTemplate | null; subId: string; userId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("email");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setChannel(editing?.channel ?? "email");
      setSubject(editing?.subject ?? "");
      setBodyText(editing?.body_text ?? "");
      setBodyHtml(editing?.body_html ?? "");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => upsertTemplate({
      id: editing?.id, sub_account_id: subId, created_by: userId, name, channel,
      subject: channel === "email" ? subject : null,
      body_text: bodyText || null,
      body_html: channel === "email" ? (bodyHtml || null) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {channel === "email" && (
            <>
              <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div><Label>HTML body</Label><Textarea rows={5} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} /></div>
            </>
          )}
          <div><Label>{channel === "email" ? "Plain text body" : "Message"}</Label><Textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================= TRIGGER LINKS =============================
function LinksTab({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("https://");
  const q = useQuery({ queryKey: ["trigger-links", subId], queryFn: () => fetchTriggerLinks(subId) });
  const create = useMutation({
    mutationFn: () => createTriggerLink({ name, target_url: target, sub_account_id: subId, created_by: userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trigger-links"] }); setOpen(false); setName(""); setTarget("https://"); toast.success("Link created"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: deleteTriggerLink,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trigger-links"] }); toast.success("Deleted"); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateTriggerLink(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trigger-links"] }),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted-foreground">Trackable short links. Each click fires the <code className="text-[10px]">link.clicked</code> workflow trigger.</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5 mr-1.5" />New link</Button>
      </div>
      <div className="border border-border rounded-md divide-y">
        {q.isLoading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div> :
         !q.data?.length ? <div className="p-6 text-center text-sm text-muted-foreground">No links yet.</div> :
         q.data.map((l) => {
          const shortUrl = `${origin}/api/public/l/${l.slug}`;
          return (
            <div key={l.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{l.name}</span>
                  <Badge variant="outline" className="text-[10px]">{l.click_count} clicks</Badge>
                  {!l.enabled && <Badge variant="secondary" className="text-[10px]">disabled</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded truncate">{shortUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground">
                    <Copy className="size-3" />
                  </button>
                  <a href={l.target_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-3" /></a>
                  <span className="text-[10px] text-muted-foreground truncate">→ {l.target_url}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: l.id, enabled: !l.enabled })}>{l.enabled ? "Disable" : "Enable"}</Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(l.id)}><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New trigger link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Book a demo" /></div>
            <div><Label>Target URL</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://…" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !name || !target}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================= SOCIAL =============================
const SOCIAL_LABELS: Record<SocialPlatform, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", twitter: "X (Twitter)" };

function SocialTab({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SocialPost | null>(null);
  const q = useQuery({ queryKey: ["social-posts", subId], queryFn: () => fetchSocialPosts(subId) });
  const del = useMutation({
    mutationFn: deleteSocialPost,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social-posts"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted-foreground">Plan and schedule posts. Connect a platform later to auto-publish; today posts are tracked as a content calendar.</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-3.5 mr-1.5" />New post</Button>
      </div>
      <div className="border border-border rounded-md divide-y">
        {q.isLoading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div> :
         !q.data?.length ? <div className="p-6 text-center text-sm text-muted-foreground">No posts yet.</div> :
         q.data.map((p) => (
          <div key={p.id} className="p-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{SOCIAL_LABELS[p.platform]}</Badge>
                <Badge variant={p.status === "published" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge>
                {p.scheduled_at && <span className="text-[10px] text-muted-foreground">{new Date(p.scheduled_at).toLocaleString()}</span>}
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-3">{p.content}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      <SocialDialog open={open} onOpenChange={setOpen} editing={editing} subId={subId} userId={userId} />
    </div>
  );
}

function SocialDialog({ open, onOpenChange, editing, subId, userId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: SocialPost | null; subId: string; userId: string }) {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<SocialPost["status"]>("draft");

  useEffect(() => {
    if (open) {
      setPlatform(editing?.platform ?? "facebook");
      setContent(editing?.content ?? "");
      setMediaUrl(editing?.media_url ?? "");
      setScheduledAt(editing?.scheduled_at ? new Date(editing.scheduled_at).toISOString().slice(0, 16) : "");
      setStatus(editing?.status ?? "draft");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => upsertSocialPost({
      id: editing?.id, sub_account_id: subId, created_by: userId,
      platform, content, media_url: mediaUrl || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social-posts"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit post" : "New social post"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SOCIAL_LABELS) as SocialPlatform[]).map((k) => <SelectItem key={k} value={k}>{SOCIAL_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Content</Label><Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div><Label>Media URL (optional)</Label><Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Schedule for</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SocialPost["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !content}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================= ADS =============================
const AD_LABELS: Record<AdPlatform, string> = { google: "Google Ads", meta: "Meta (Facebook/IG)", linkedin: "LinkedIn Ads", tiktok: "TikTok Ads", other: "Other" };

function AdsTab({ subId, userId }: { subId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdCampaign | null>(null);
  const q = useQuery({ queryKey: ["ad-campaigns", subId], queryFn: () => fetchAdCampaigns(subId) });
  const del = useMutation({
    mutationFn: deleteAdCampaign,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ad-campaigns"] }); toast.success("Deleted"); },
  });

  const totals = useMemo(() => {
    const rows = q.data ?? [];
    return rows.reduce((acc, r) => ({
      spend: acc.spend + Number(r.spend || 0),
      budget: acc.budget + Number(r.budget || 0),
      clicks: acc.clicks + (r.clicks || 0),
      impressions: acc.impressions + (r.impressions || 0),
      conversions: acc.conversions + (r.conversions || 0),
    }), { spend: 0, budget: 0, clicks: 0, impressions: 0, conversions: 0 });
  }, [q.data]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-muted-foreground">Track ad spend across platforms. Enter numbers manually or wire up an API later.</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-3.5 mr-1.5" />New campaign</Button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          ["Spend", `$${totals.spend.toFixed(2)}`],
          ["Budget", `$${totals.budget.toFixed(2)}`],
          ["Impressions", totals.impressions.toLocaleString()],
          ["Clicks", totals.clicks.toLocaleString()],
          ["Conversions", totals.conversions.toLocaleString()],
        ].map(([label, val]) => (
          <div key={label} className="border border-border rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold mt-1">{val}</p>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-md divide-y">
        {q.isLoading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div> :
         !q.data?.length ? <div className="p-6 text-center text-sm text-muted-foreground">No ad campaigns yet.</div> :
         q.data.map((a) => (
          <div key={a.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{a.name}</span>
                <Badge variant="outline" className="text-[10px]">{AD_LABELS[a.platform]}</Badge>
                <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                ${Number(a.spend).toFixed(2)} / ${Number(a.budget).toFixed(2)} · {a.impressions.toLocaleString()} imp · {a.clicks.toLocaleString()} clicks · {a.conversions} conv
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      <AdDialog open={open} onOpenChange={setOpen} editing={editing} subId={subId} userId={userId} />
    </div>
  );
}

function AdDialog({ open, onOpenChange, editing, subId, userId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: AdCampaign | null; subId: string; userId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<AdPlatform>("google");
  const [status, setStatus] = useState<AdCampaignStatus>("draft");
  const [budget, setBudget] = useState("0");
  const [spend, setSpend] = useState("0");
  const [impressions, setImpressions] = useState("0");
  const [clicks, setClicks] = useState("0");
  const [conversions, setConversions] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setPlatform(editing?.platform ?? "google");
      setStatus(editing?.status ?? "draft");
      setBudget(String(editing?.budget ?? 0));
      setSpend(String(editing?.spend ?? 0));
      setImpressions(String(editing?.impressions ?? 0));
      setClicks(String(editing?.clicks ?? 0));
      setConversions(String(editing?.conversions ?? 0));
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => upsertAdCampaign({
      id: editing?.id, sub_account_id: subId, created_by: userId, name, platform, status,
      budget: Number(budget), spend: Number(spend),
      impressions: Number(impressions), clicks: Number(clicks), conversions: Number(conversions),
      notes: notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ad-campaigns"] }); onOpenChange(false); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit ad campaign" : "New ad campaign"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as AdPlatform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(AD_LABELS) as AdPlatform[]).map((k) => <SelectItem key={k} value={k}>{AD_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AdCampaignStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Budget ($)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div><Label>Spend ($)</Label><Input type="number" value={spend} onChange={(e) => setSpend(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Impressions</Label><Input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} /></div>
            <div><Label>Clicks</Label><Input type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} /></div>
            <div><Label>Conversions</Label><Input type="number" value={conversions} onChange={(e) => setConversions(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
