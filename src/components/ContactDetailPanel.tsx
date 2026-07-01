import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  Mail,
  Phone,
  Building2,
  Pencil,
  Trash2,
  ExternalLink,
  Plus,
  Check,
  Circle,
  Calendar as CalendarIcon,
  DollarSign,
  Upload,
  File as FileIcon,
  ImageIcon,
  Download,
} from "lucide-react";
import {
  fetchContactFiles,
  uploadContactFile,
  deleteContactFile,
  getContactFileUrl,
  formatBytes,
  isImage,
  type ContactFile,
} from "@/lib/contact-files";
import { ContactDialog } from "@/components/ContactDialog";
import {
  fetchContact,
  updateContact,
  deleteContact,
  LIFECYCLE_STAGES,
  type ContactInput,
} from "@/lib/contacts";
import { fetchTasks, updateTask, type Task } from "@/lib/tasks";
import { fetchEvents } from "@/lib/calendar";
import {
  ensureConversation,
  fetchMessages,
  postNote,
} from "@/lib/conversations";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { initials, stringHue } from "@/lib/initials";

export function ContactDetailPanel({
  contactId,
  onClose,
}: {
  contactId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const contactQ = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => fetchContact(contactId),
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", subId],
    queryFn: () => fetchTasks(subId!),
    enabled: !!subId,
  });

  const dealsQ = useQuery({
    queryKey: ["deals-by-contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, value, currency, stage_id, expected_close_date, pipeline_id")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stagesQ = useQuery({
    queryKey: ["stages", subId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color")
        .eq("sub_account_id", subId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!subId,
  });

  const eventsQ = useQuery({
    queryKey: ["events-by-contact", contactId, subId],
    queryFn: async () => {
      if (!subId) return [];
      const from = new Date();
      from.setMonth(from.getMonth() - 6);
      const to = new Date();
      to.setMonth(to.getMonth() + 12);
      const all = await fetchEvents(subId, from.toISOString(), to.toISOString());
      return all.filter((e) => e.contact_id === contactId);
    },
    enabled: !!subId,
  });

  const convoQ = useQuery({
    queryKey: ["conversation-by-contact", contactId, subId],
    queryFn: () => ensureConversation(subId!, contactId),
    enabled: !!subId,
  });

  const msgsQ = useQuery({
    queryKey: ["messages", convoQ.data?.id],
    queryFn: () => fetchMessages(convoQ.data!.id),
    enabled: !!convoQ.data?.id,
  });

  const filesQ = useQuery({
    queryKey: ["contact-files", contactId],
    queryFn: () => fetchContactFiles(contactId),
  });



  const updateContactMut = useMutation({
    mutationFn: (input: ContactInput) => updateContact(contactId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteContact(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTaskMut = useMutation({
    mutationFn: (t: Task) => updateTask(t.id, { status: t.status === "done" ? "open" : "done" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (contactQ.isLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }
  if (!contactQ.data) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
        Contact not found.
      </div>
    );
  }

  const c = contactQ.data;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
  const hue = stringHue(c.id);
  const contactTasks = (tasksQ.data ?? []).filter((t) => t.contact_id === contactId);
  const openTasks = contactTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const deals = dealsQ.data ?? [];
  const stagesById = new Map((stagesQ.data ?? []).map((s) => [s.id, s]));
  const events = eventsQ.data ?? [];
  const messages = msgsQ.data ?? [];
  const files = filesQ.data ?? [];

  return (
    <div className="flex flex-col overflow-hidden max-h-[80vh]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border flex items-start gap-4">
        <span
          className="size-14 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
          style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
        >
          {initials(name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold truncate">{name}</h2>
            <span className="inline-block bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-mono uppercase">
              {LIFECYCLE_STAGES.find((s) => s.value === c.lifecycle_stage)?.label ?? c.lifecycle_stage}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap text-[11px] text-muted-foreground">
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-3" /> {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Phone className="size-3" /> {c.phone}
              </a>
            )}
            {c.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3" /> {c.company}
              </span>
            )}
          </div>
          {(c.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {c.tags.map((t) => (
                <span key={t} className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-mono">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 bg-secondary rounded-md py-1.5 px-3 text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${name}"?`)) deleteMut.mutate(); }}
            className="size-8 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden min-h-0">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">Deals · {deals.length}</TabsTrigger>
          <TabsTrigger value="tasks">Tasks · {openTasks.length}</TabsTrigger>
          <TabsTrigger value="notes">Notes · {messages.length}</TabsTrigger>
          <TabsTrigger value="events">Events · {events.length}</TabsTrigger>
          <TabsTrigger value="files">Files · {files.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-auto px-6 py-4 space-y-4">
          <OverviewGrid
            email={c.email}
            phone={c.phone}
            company={c.company}
            leadSource={c.lead_source}
            createdAt={c.created_at}
            notes={c.notes}
            openTaskCount={openTasks.length}
            dealCount={deals.length}
          />
        </TabsContent>

        <TabsContent value="deals" className="flex-1 overflow-auto px-6 py-4">
          {dealsQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : deals.length === 0 ? (
            <EmptyState label="No deals linked to this contact yet." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {deals.map((d) => {
                const stage = stagesById.get(d.stage_id);
                return (
                  <li key={d.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/40">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: stage?.color ?? "#6b7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {stage?.name ?? "—"}
                        {d.expected_close_date && ` · closes ${format(new Date(d.expected_close_date), "MMM d")}`}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-mono">
                      <DollarSign className="size-3 text-muted-foreground" />
                      {Number(d.value).toLocaleString()}
                    </span>
                    <Link
                      to="/opportunities"
                      className="text-muted-foreground hover:text-foreground"
                      title="Open in pipeline"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 overflow-auto px-6 py-4">
          {tasksQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : contactTasks.length === 0 ? (
            <EmptyState
              label="No tasks for this contact yet."
              action={
                <Link to="/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Plus className="size-3" /> Create task
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {contactTasks.map((t) => {
                const done = t.status === "done";
                return (
                  <li key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/40">
                    <button
                      onClick={() => toggleTaskMut.mutate(t)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title={done ? "Reopen" : "Mark done"}
                    >
                      {done ? <Check className="size-4 text-accent" /> : <Circle className="size-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={"text-sm truncate " + (done ? "line-through text-muted-foreground" : "font-medium")}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="uppercase font-mono">{t.priority}</span>
                        {t.due_at && ` · due ${format(new Date(t.due_at), "MMM d")}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <NotesTab
            contactId={contactId}
            subId={subId}
            userId={userId}
            messages={messages}
            loading={msgsQ.isLoading || convoQ.isLoading}
            onPosted={() => {
              qc.invalidateQueries({ queryKey: ["messages"] });
              qc.invalidateQueries({ queryKey: ["conversations"] });
            }}
          />
        </TabsContent>

        <TabsContent value="events" className="flex-1 overflow-auto px-6 py-4">
          {eventsQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <EmptyState
              label="No events linked to this contact yet."
              action={
                <Link to="/calendar" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Plus className="size-3" /> Schedule event
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {events.map((ev) => (
                <li key={ev.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/40">
                  <CalendarIcon className="size-3.5 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(ev.starts_at), "EEE MMM d · h:mma")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <FilesTab
            contactId={contactId}
            subId={subId}
            userId={userId}
            files={files}
            loading={filesQ.isLoading}
            onChanged={() => qc.invalidateQueries({ queryKey: ["contact-files", contactId] })}
          />
        </TabsContent>
      </Tabs>

      <ContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={c}
        onSubmit={async (input) => { await updateContactMut.mutateAsync(input); }}
      />
    </div>
  );
}

function OverviewGrid({
  email, phone, company, leadSource, createdAt, notes, openTaskCount, dealCount,
}: {
  email: string | null; phone: string | null; company: string | null;
  leadSource: string | null; createdAt: string; notes: string | null;
  openTaskCount: number; dealCount: number;
}) {
  const fields: [string, React.ReactNode][] = [
    ["Email", email ?? "—"],
    ["Phone", phone ?? "—"],
    ["Company", company ?? "—"],
    ["Lead source", leadSource ?? "—"],
    ["Added", formatDistanceToNow(new Date(createdAt), { addSuffix: true })],
    ["Open tasks", openTaskCount],
    ["Deals", dealCount],
  ];
  return (
    <>
      <div className="rounded-md border border-border">
        <dl className="divide-y divide-border">
          {fields.map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 grid grid-cols-[120px_1fr] gap-4 text-xs">
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground self-center">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {notes && (
        <div className="rounded-md border border-border p-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
          <p className="text-xs whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </>
  );
}

function NotesTab({
  contactId, subId, userId, messages, loading, onPosted,
}: {
  contactId: string;
  subId: string | null;
  userId: string | null;
  messages: { id: string; body: string; created_at: string }[];
  loading: boolean;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const sendMut = useMutation({
    mutationFn: async () => {
      if (!userId || !subId) throw new Error("Not ready");
      const convo = await ensureConversation(subId, contactId);
      return postNote({
        conversation_id: convo.id,
        sub_account_id: subId,
        author_user_id: userId,
        body: body.trim(),
      });
    },
    onSuccess: () => { setBody(""); onPosted(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3 min-h-0">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center">No notes yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-md bg-secondary/60 px-3 py-2">
              <p className="text-xs whitespace-pre-wrap">{m.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border p-4 flex gap-2">
        <Textarea
          rows={2}
          placeholder="Add an internal note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
              e.preventDefault();
              sendMut.mutate();
            }
          }}
          className="flex-1 resize-none"
        />
        <Button
          onClick={() => sendMut.mutate()}
          disabled={!body.trim() || sendMut.isPending}
          className="self-end"
        >
          Post
        </Button>
      </div>
    </>
  );
}

function EmptyState({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
      <p className="text-xs">{label}</p>
      {action}
    </div>
  );
}

function FilesTab({
  contactId,
  subId,
  userId,
  files,
  loading,
  onChanged,
}: {
  contactId: string;
  subId: string | null;
  userId: string | null;
  files: ContactFile[];
  loading: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!subId || !userId) {
      toast.error("Not ready");
      return;
    }
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const f of arr) {
        if (f.size > 25 * 1024 * 1024) {
          toast.error(`${f.name} exceeds 25 MB limit`);
          continue;
        }
        await uploadContactFile({ file: f, contactId, subAccountId: subId, userId });
      }
      toast.success(arr.length === 1 ? "File uploaded" : `${arr.length} files uploaded`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (f: ContactFile) => {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await deleteContactFile(f);
      toast.success("File deleted");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleOpen = async (f: ContactFile) => {
    try {
      const url = await getContactFileUrl(f.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={
          "mx-6 mt-4 mb-3 rounded-md border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center gap-2 transition-colors " +
          (dragOver ? "border-primary bg-primary/5" : "border-border")
        }
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">
          Drop files here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-primary hover:underline font-medium"
            disabled={uploading}
          >
            browse
          </button>
        </p>
        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          Max 25 MB · Images, PDFs, docs
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Loader2 className="size-3 animate-spin" /> Uploading…
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            No files attached yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {files.map((f) => (
              <li
                key={f.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/40"
              >
                <FileThumb file={f} />
                <button
                  onClick={() => handleOpen(f)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium truncate hover:text-primary">
                    {f.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(f.size)} ·{" "}
                    {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                  </p>
                </button>
                <button
                  onClick={() => handleOpen(f)}
                  className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Open"
                >
                  <Download className="size-3.5" />
                </button>
                {f.uploaded_by === userId && (
                  <button
                    onClick={() => handleDelete(f)}
                    className="size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileThumb({ file }: { file: ContactFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = isImage(file.content_type);

  useEffect(() => {
    let cancelled = false;
    if (image) {
      getContactFileUrl(file.storage_path)
        .then((u) => {
          if (!cancelled) setUrl(u);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [file.storage_path, image]);

  if (image && url) {
    return (
      <img
        src={url}
        alt={file.name}
        className="size-10 rounded object-cover bg-secondary shrink-0"
      />
    );
  }
  return (
    <span className="size-10 rounded bg-secondary flex items-center justify-center shrink-0">
      {image ? (
        <ImageIcon className="size-4 text-muted-foreground" />
      ) : (
        <FileIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
