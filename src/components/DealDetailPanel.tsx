import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  Trash2,
  DollarSign,
  Calendar as CalendarIcon,
  User,
  Check,
  Circle,
  Upload,
  File as FileIcon,
  ImageIcon,
  Download,
  Save,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { fetchDeal, updateDeal, deleteDeal, type Deal, type Stage } from "@/lib/pipeline";
import { fetchTasks, updateTask, type Task } from "@/lib/tasks";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { fetchContactMessages } from "@/lib/contact-messages";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import {
  fetchDealFiles,
  uploadDealFile,
  deleteDealFile,
  getDealFileUrl,
  type DealFile,
} from "@/lib/deal-files";
import { formatBytes, isImage } from "@/lib/contact-files";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function DealDetailPanel({
  dealId,
  stages,
  onClose,
}: {
  dealId: string;
  stages: Stage[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const dealQ = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => fetchDeal(dealId),
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", subId],
    queryFn: () => fetchTasks(subId!),
    enabled: !!subId,
  });

  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });

  const filesQ = useQuery({
    queryKey: ["deal-files", dealId],
    queryFn: () => fetchDealFiles(dealId),
  });

  const updateMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateDeal>[1]) => updateDeal(dealId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      qc.invalidateQueries({ queryKey: ["board"] });
      toast.success("Deal updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteDeal(dealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
      toast.success("Deal deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTaskMut = useMutation({
    mutationFn: (t: Task) => updateTask(t.id, { status: t.status === "done" ? "open" : "done" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (dealQ.isLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }
  if (!dealQ.data) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
        Deal not found.
      </div>
    );
  }

  const d = dealQ.data;
  const stage = stages.find((s) => s.id === d.stage_id) ?? null;
  const contact = contactsQ.data?.find((c) => c.id === d.contact_id) ?? null;
  const dealTasks = (tasksQ.data ?? []).filter((t) => t.deal_id === dealId);
  const openTasks = dealTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const files = filesQ.data ?? [];

  return (
    <div className="flex flex-col overflow-hidden max-h-[80vh]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border flex items-start gap-4">
        <span
          className="size-2 mt-2 rounded-full shrink-0"
          style={{ backgroundColor: stage?.color ?? "#6b7280" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold truncate">{d.title}</h2>
            {stage && (
              <span className="inline-block bg-secondary rounded px-1.5 py-0.5 text-[10px] font-mono uppercase">
                {stage.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <DollarSign className="size-3" />
              {Number(d.value).toLocaleString()} {d.currency}
            </span>
            {d.expected_close_date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="size-3" />
                Closes {format(new Date(d.expected_close_date), "MMM d, yyyy")}
              </span>
            )}
            {contact && (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3" />
                {[contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                  contact.email ||
                  "Contact"}
              </span>
            )}
            <span className="font-mono">#{d.id.slice(0, 6).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (confirm(`Delete "${d.title}"?`)) deleteMut.mutate();
            }}
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
          <TabsTrigger value="tasks">Tasks · {openTasks.length}</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="files">Files · {files.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-auto px-6 py-4">
          <OverviewTab
            deal={d}
            stages={stages}
            contacts={contactsQ.data ?? []}
            onSave={(patch) => updateMut.mutate(patch)}
            saving={updateMut.isPending}
          />
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 overflow-auto px-6 py-4">
          {tasksQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : dealTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No tasks linked to this deal yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {dealTasks.map((t) => {
                const done = t.status === "done";
                return (
                  <li key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/40">
                    <button
                      onClick={() => toggleTaskMut.mutate(t)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {done ? (
                        <Check className="size-4 text-accent" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={
                          "text-sm truncate " +
                          (done ? "line-through text-muted-foreground" : "font-medium")
                        }
                      >
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

        <TabsContent value="notes" className="flex-1 overflow-auto px-6 py-4">
          <NotesTab
            initial={d.notes ?? ""}
            onSave={(notes) => updateMut.mutate({ notes })}
            saving={updateMut.isPending}
          />
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <FilesTab
            dealId={dealId}
            subId={subId}
            userId={userId}
            files={files}
            loading={filesQ.isLoading}
            onChanged={() => qc.invalidateQueries({ queryKey: ["deal-files", dealId] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({
  deal,
  stages,
  contacts,
  onSave,
  saving,
}: {
  deal: Deal;
  stages: Stage[];
  contacts: Contact[];
  onSave: (patch: Parameters<typeof updateDeal>[1]) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(String(deal.value));
  const [stageId, setStageId] = useState(deal.stage_id);
  const [contactId, setContactId] = useState<string>(deal.contact_id ?? "__none");
  const [closeDate, setCloseDate] = useState(deal.expected_close_date ?? "");

  useEffect(() => {
    setTitle(deal.title);
    setValue(String(deal.value));
    setStageId(deal.stage_id);
    setContactId(deal.contact_id ?? "__none");
    setCloseDate(deal.expected_close_date ?? "");
  }, [deal.id, deal.title, deal.value, deal.stage_id, deal.contact_id, deal.expected_close_date]);

  const dirty =
    title !== deal.title ||
    Number(value) !== Number(deal.value) ||
    stageId !== deal.stage_id ||
    (contactId === "__none" ? null : contactId) !== deal.contact_id ||
    (closeDate || null) !== (deal.expected_close_date ?? null);

  return (
    <div className="space-y-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Value">
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Expected close">
          <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stage">
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Contact">
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No contact</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    c.email ||
                    c.company ||
                    "Contact"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="rounded-md border border-border p-4 text-xs text-muted-foreground">
        Added {formatDistanceToNow(new Date((deal as unknown as { created_at: string }).created_at ?? Date.now()), { addSuffix: true })}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          disabled={!dirty || saving}
          onClick={() =>
            onSave({
              title: title.trim(),
              value: Number(value) || 0,
              stage_id: stageId,
              contact_id: contactId === "__none" ? null : contactId,
              expected_close_date: closeDate || null,
            })
          }
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function NotesTab({
  initial,
  onSave,
  saving,
}: {
  initial: string;
  onSave: (notes: string) => void;
  saving: boolean;
}) {
  const [body, setBody] = useState(initial);
  useEffect(() => setBody(initial), [initial]);
  const dirty = body !== initial;
  return (
    <div className="space-y-3">
      <Textarea
        rows={12}
        placeholder="Deal notes, meeting recaps, next steps…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          disabled={!dirty || saving}
          onClick={() => onSave(body)}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save notes
        </button>
      </div>
    </div>
  );
}

function FilesTab({
  dealId,
  subId,
  userId,
  files,
  loading,
  onChanged,
}: {
  dealId: string;
  subId: string | null;
  userId: string | null;
  files: DealFile[];
  loading: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!subId || !userId) throw new Error("Not ready");
      if (file.size > 25 * 1024 * 1024) throw new Error("File too large (25MB max)");
      return uploadDealFile({ file, dealId, subAccountId: subId, userId });
    },
    onSuccess: () => {
      onChanged();
      toast.success("File uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (f: DealFile) => deleteDealFile(f),
    onSuccess: () => {
      onChanged();
      toast.success("File deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      await uploadMut.mutateAsync(f).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col overflow-hidden min-h-0 flex-1">
      <div className="px-6 pt-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-lg px-4 py-6 flex items-center justify-center gap-3 transition-colors ${
            dragOver ? "border-accent bg-accent/5" : "border-border"
          }`}
        >
          <Upload className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drop files here or{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-primary underline underline-offset-2"
            >
              browse
            </button>
            {uploadMut.isPending && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> uploading…
              </span>
            )}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No files attached yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {files.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                canDelete={userId === f.uploaded_by}
                onDelete={() => {
                  if (confirm(`Delete "${f.name}"?`)) deleteMut.mutate(f);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileCard({
  file,
  canDelete,
  onDelete,
}: {
  file: DealFile;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDealFileUrl(file.storage_path)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [file.storage_path]);

  const image = isImage(file.content_type);

  return (
    <li className="rounded-md border border-border overflow-hidden bg-card group flex flex-col">
      <div className="aspect-video bg-secondary/40 flex items-center justify-center overflow-hidden">
        {image && url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" />
        ) : image ? (
          <ImageIcon className="size-6 text-muted-foreground" />
        ) : (
          <FileIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className="text-xs font-medium truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {formatBytes(file.size)} · {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {url && (
            <a
              href={url}
              download={file.name}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3" /> Download
            </a>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="ml-auto inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
