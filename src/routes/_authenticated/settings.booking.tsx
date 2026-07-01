import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ExternalLink, Trash2, Copy, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchBookingPages,
  upsertBookingPage,
  deleteBookingPage,
  DEFAULT_AVAILABILITY,
  DAY_LABELS,
  type BookingPage,
  type DayKey,
  type Availability,
} from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/booking")({
  head: () => ({
    meta: [
      { title: "Booking pages — Agency Engine" },
      { name: "description", content: "Create public booking links for clients." },
    ],
  }),
  component: BookingSettingsPage,
});

const DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function BookingSettingsPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editing, setEditing] = useState<BookingPage | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["booking-pages", subId],
    enabled: !!subId,
    queryFn: () => fetchBookingPages(subId!),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const slug = (newSlug || newName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return upsertBookingPage({
        sub_account_id: subId!,
        owner_user_id: userId!,
        slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        name: newName,
        duration_minutes: 30,
        buffer_minutes: 0,
        advance_days: 14,
        min_notice_minutes: 60,
        availability: DEFAULT_AVAILABILITY,
        enabled: true,
      });
    },
    onSuccess: (p) => {
      setNewOpen(false);
      setNewName("");
      setNewSlug("");
      qc.invalidateQueries({ queryKey: ["booking-pages", subId] });
      setEditing(p);
      toast.success("Booking page created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBookingPage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-pages", subId] });
      toast.success("Deleted");
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
          <Plus className="size-3.5" /> New booking page
        </button>
      }
    >
      <div className="p-8 max-w-4xl overflow-y-auto h-full">
        <h1 className="text-2xl font-bold mb-1">Booking pages</h1>
        <p className="text-sm text-muted-foreground mb-6">Share a public link so people can pick a time from your availability.</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : pages.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">No booking pages yet.</p>
            <Button onClick={() => setNewOpen(true)} disabled={!subId || !userId}>
              <Plus className="size-3.5" /> Create your first page
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((p) => {
              const url = `${window.location.origin}/b/${p.slug}`;
              return (
                <div key={p.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{p.name}</h3>
                      {!p.enabled && <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">Disabled</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{url}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.duration_minutes} min · buffer {p.buffer_minutes}m · {p.advance_days} days ahead</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }} className="p-2 hover:bg-secondary rounded-md" title="Copy link">
                    <Copy className="size-3.5" />
                  </button>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-secondary rounded-md" title="Open">
                    <ExternalLink className="size-3.5" />
                  </a>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
                  <button onClick={() => { if (confirm("Delete this page?")) deleteMut.mutate(p.id); }} className="p-2 hover:bg-destructive/10 text-destructive rounded-md">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New booking page</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Name</Label>
                <Input placeholder="30-minute intro call" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Slug (optional)</Label>
                <Input placeholder="intro-call" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={!newName || createMut.isPending} className="w-full">
                {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {editing && <EditDialog page={editing} onClose={() => setEditing(null)} subId={subId!} />}
      </div>
    </AppShell>
  );
}

function EditDialog({ page, onClose, subId }: { page: BookingPage; onClose: () => void; subId: string }) {
  const qc = useQueryClient();
  const [state, setState] = useState<BookingPage>(page);

  const saveMut = useMutation({
    mutationFn: () => upsertBookingPage({
      ...state,
      sub_account_id: subId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-pages", subId] });
      toast.success("Saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setAvail(day: DayKey, windows: { start: string; end: string }[]) {
    setState({ ...state, availability: { ...state.availability, [day]: windows } as Availability });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit booking page</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Slug</Label>
              <Input value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Description</Label>
            <Textarea rows={2} value={state.description ?? ""} onChange={(e) => setState({ ...state, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Duration (min)</Label>
              <Input type="number" value={state.duration_minutes} onChange={(e) => setState({ ...state, duration_minutes: parseInt(e.target.value) || 30 })} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Buffer (min)</Label>
              <Input type="number" value={state.buffer_minutes} onChange={(e) => setState({ ...state, buffer_minutes: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Days ahead</Label>
              <Input type="number" value={state.advance_days} onChange={(e) => setState({ ...state, advance_days: parseInt(e.target.value) || 14 })} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Min notice (min)</Label>
              <Input type="number" value={state.min_notice_minutes} onChange={(e) => setState({ ...state, min_notice_minutes: parseInt(e.target.value) || 60 })} />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Weekly availability</Label>
            <div className="space-y-2 border border-border rounded-md p-3">
              {DAYS.map((d) => {
                const windows = state.availability[d] ?? [];
                return (
                  <div key={d} className="flex items-start gap-3">
                    <div className="w-24 pt-1.5 text-xs font-medium">{DAY_LABELS[d]}</div>
                    <div className="flex-1 space-y-1.5">
                      {windows.length === 0 ? (
                        <p className="text-xs text-muted-foreground pt-1.5">Unavailable</p>
                      ) : windows.map((w, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input type="time" value={w.start} onChange={(e) => {
                            const nw = [...windows]; nw[i] = { ...w, start: e.target.value }; setAvail(d, nw);
                          }} className="w-32" />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input type="time" value={w.end} onChange={(e) => {
                            const nw = [...windows]; nw[i] = { ...w, end: e.target.value }; setAvail(d, nw);
                          }} className="w-32" />
                          <button onClick={() => setAvail(d, windows.filter((_, j) => j !== i))} className="p-1 hover:bg-destructive/10 text-destructive rounded">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setAvail(d, [...windows, { start: "09:00", end: "17:00" }])} className="text-[11px] text-primary hover:underline">
                        + Add window
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={state.enabled} onCheckedChange={(v) => setState({ ...state, enabled: v })} />
            <Label className="text-xs">Enabled (accepting bookings)</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1">
              {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-3.5" /> Save</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
