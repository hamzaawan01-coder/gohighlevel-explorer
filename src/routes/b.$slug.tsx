import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { fetchPublicBookingPage, submitBooking } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/b/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Book a time — ${params.slug}` },
      { name: "description", content: "Pick a time that works for you." },
    ],
  }),
  component: BookingPublicPage,
});

function BookingPublicPage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-booking", slug],
    queryFn: () => fetchPublicBookingPage(slug),
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    (data?.slots ?? []).forEach((iso) => {
      const key = iso.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(iso);
    });
    return map;
  }, [data]);

  const days = useMemo(() => Array.from(slotsByDay.keys()).slice(0, 21), [slotsByDay]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Booking link unavailable</h1>
          <p className="text-sm text-muted-foreground">This booking page is disabled or does not exist.</p>
        </div>
      </div>
    );
  }

  const { page } = data;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setErrMsg(null);
    setSubmitting(true);
    try {
      await submitBooking(slug, {
        starts_at: selectedSlot,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      });
      setDone(true);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Could not book");
      await refetch();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/40 p-6">
        <div className="w-full max-w-md surface-card p-8 text-center">
          <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">You're booked</h1>
          <p className="text-sm text-muted-foreground">
            {selectedSlot && new Date(selectedSlot).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
          </p>
          <p className="text-xs text-muted-foreground mt-4">A confirmation is on the way.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40 p-6">
      <div className="max-w-4xl mx-auto surface-card overflow-hidden">
        <div className="p-8 border-b border-border">
          <h1 className="text-2xl font-bold mb-1">{page.name}</h1>
          {page.description && (
            <p className="text-sm text-muted-foreground mb-3">{page.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {page.duration_minutes} min</span>
            <span className="inline-flex items-center gap-1"><CalendarIcon className="size-3.5" /> Next {page.advance_days} days</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-3">Pick a day</h2>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">No availability in the next {page.advance_days} days.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                {days.map((d) => {
                  const dt = new Date(d + "T12:00:00");
                  const active = d === selectedDate;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                      className={
                        active
                          ? "rounded-md border border-primary bg-primary text-primary-foreground px-2 py-2 text-xs font-medium"
                          : "rounded-md border border-border bg-background hover:bg-secondary px-2 py-2 text-xs"
                      }
                    >
                      <div className="font-semibold">{dt.toLocaleDateString([], { weekday: "short" })}</div>
                      <div>{dt.toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6">
            <h2 className="text-sm font-semibold mb-3">Pick a time</h2>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">Select a day to see available times.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                {(slotsByDay.get(selectedDate) ?? []).map((iso) => {
                  const active = iso === selectedSlot;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedSlot(iso)}
                      className={
                        active
                          ? "rounded-md border border-primary bg-primary text-primary-foreground px-2 py-2 text-xs font-medium"
                          : "rounded-md border border-border bg-background hover:bg-secondary px-2 py-2 text-xs"
                      }
                    >
                      {new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {selectedSlot && (
          <form onSubmit={onSubmit} className="p-6 border-t border-border space-y-3 bg-secondary/30">
            <h2 className="text-sm font-semibold">Your details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Name *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Email *</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Phone</Label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : `Confirm ${new Date(selectedSlot).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
