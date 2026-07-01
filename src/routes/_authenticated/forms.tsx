import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ExternalLink, Trash2, Copy, Eye, EyeOff, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import {
  createForm,
  deleteForm,
  fetchForms,
  fetchSubmissions,
  updateForm,
  DEFAULT_FIELDS,
  type FormField,
  type LeadForm,
} from "@/lib/lead-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({
    meta: [
      { title: "Forms — Agency Engine" },
      { name: "description", content: "Hosted lead-capture forms." },
    ],
  }),
  component: FormsPage,
});

function FormsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<LeadForm | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms", subId],
    enabled: !!subId,
    queryFn: () => fetchForms(subId!),
  });

  const createMut = useMutation({
    mutationFn: () => createForm({ name: newName, subAccountId: subId!, ownerId: userId! }),
    onSuccess: (f) => {
      setNewOpen(false);
      setNewName("");
      qc.invalidateQueries({ queryKey: ["forms", subId] });
      setEditing(f);
      toast.success("Form created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteForm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms", subId] });
      toast.success("Form deleted");
    },
  });

  return (
    <AppShell
      headerActions={
        <button
          onClick={() => setNewOpen(true)}
          disabled={!subId || !userId}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="size-3.5" /> New Form
        </button>
      }
    >
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Forms</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Hosted lead-capture forms. Each submission creates or updates a contact and triggers the
              <span className="font-mono"> form.submitted</span> workflow.
            </p>
          </div>

          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : forms.length === 0 ? (
            <div className="bg-card ring-1 ring-black/5 rounded-lg p-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">No forms yet.</p>
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Create your first form
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forms.map((f) => {
                const url = `${window.location.origin}/f/${f.slug}`;
                return (
                  <div key={f.id} className="bg-card ring-1 ring-black/5 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold truncate">{f.name}</h3>
                          {f.enabled ? (
                            <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">LIVE</span>
                          ) : (
                            <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">OFF</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{url}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied");
                          }}
                          className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="Copy link"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <Link
                          to="/f/$slug"
                          params={{ slug: f.slug }}
                          target="_blank"
                          className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="Open"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm("Delete this form and all its submissions?"))
                              deleteMut.mutate(f.id);
                          }}
                          className="size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">
                        {f.fields.length} field{f.fields.length === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => setEditing(f)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Edit & submissions →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Form name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Website contact"
              maxLength={80}
            />
            <Button
              onClick={() => createMut.mutate()}
              disabled={!newName.trim() || createMut.isPending}
              className="w-full"
            >
              {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          {editing && <FormEditor form={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["forms", subId] })} />}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function FormEditor({ form, onSaved }: { form: LeadForm; onSaved: () => void }) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? "");
  const [successMessage, setSuccessMessage] = useState(form.success_message);
  const [redirectUrl, setRedirectUrl] = useState(form.redirect_url ?? "");
  const [enabled, setEnabled] = useState(form.enabled);
  const [fields, setFields] = useState<FormField[]>(form.fields.length ? form.fields : DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);

  const { data: submissions = [], isLoading: subLoading } = useQuery({
    queryKey: ["submissions", form.id],
    queryFn: () => fetchSubmissions(form.id),
  });

  async function save() {
    setSaving(true);
    try {
      await updateForm(form.id, {
        name,
        description: description || null,
        success_message: successMessage,
        redirect_url: redirectUrl || null,
        enabled,
        fields,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateField(i: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addField() {
    setFields((prev) => [...prev, { key: `custom_${prev.length + 1}`, label: "New field", type: "text", required: false }]);
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span>Edit form</span>
          <div className="flex items-center gap-2 text-xs font-normal">
            <span className="text-muted-foreground">{enabled ? "Live" : "Off"}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
          </div>
          <div>
            <Label className="text-xs">Success message</Label>
            <Textarea value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} rows={2} maxLength={300} />
          </div>
          <div>
            <Label className="text-xs">Redirect URL (optional)</Label>
            <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://…" maxLength={500} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Fields</Label>
              <button onClick={addField} className="text-[11px] text-primary hover:underline">
                + Add field
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="bg-secondary/50 rounded p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs flex-1"
                      value={f.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      placeholder="Label"
                      maxLength={60}
                    />
                    <select
                      value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value as FormField["type"] })}
                      className="h-7 text-xs bg-background border border-input rounded px-2"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                    </select>
                    <button
                      onClick={() => removeField(i)}
                      className="size-6 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-6 text-[11px] flex-1 font-mono"
                      value={f.key}
                      onChange={(e) => updateField(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })}
                      placeholder="key"
                      maxLength={40}
                    />
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                      required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            {enabled ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            Submissions ({submissions.length})
          </h3>
          {subLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No submissions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {submissions.map((s) => (
                <div key={s.id} className="bg-secondary/50 rounded p-2 text-[11px]">
                  <p className="text-muted-foreground mb-1">
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                  <div className="space-y-0.5">
                    {Object.entries(s.payload).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
                        <span className="truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-border">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : (<><Save className="size-3.5 mr-1" /> Save changes</>)}
        </Button>
      </div>
    </div>
  );
}
