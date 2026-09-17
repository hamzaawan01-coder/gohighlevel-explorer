import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useTenancy } from "@/lib/tenancy";
import {
  AUDIT_ACTIONS,
  fetchAppointmentAudit,
  filterAuditRows,
  type AuditAction,
} from "@/lib/appointments";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/appointment-log")({
  head: () => ({
    meta: [
      { title: "Appointment activity log — Lead Convert" },
      {
        name: "description",
        content:
          "Filterable audit trail of bookings, reschedules, edits, cancellations and reminder sends.",
      },
      { property: "og:title", content: "Appointment activity log — Lead Convert" },
      {
        property: "og:description",
        content: "Every booking, reschedule, cancellation and reminder send in one filterable log.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentLogPage,
});

function AppointmentLogPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const auditQ = useQuery({
    queryKey: ["appointment-audit", subId, actions.join(","), from, to],
    queryFn: () =>
      fetchAppointmentAudit(subId!, {
        actions,
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
      }),
    enabled: !!subId,
  });

  const rows = useMemo(() => filterAuditRows(auditQ.data ?? [], search), [auditQ.data, search]);
  const dirty = actions.length > 0 || !!search || !!from || !!to;

  const toggleAction = (a: AuditAction) =>
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  return (
    <AppShell>
      <PageHeader
        title="Appointment activity log"
        description="Bookings, reschedules, edits, cancellations and reminder sends."
      />

      <div className="px-4 sm:px-6 py-3 border-b border-border space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by action">
          {AUDIT_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={actions.includes(a.key)}
              onClick={() => toggleAction(a.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                actions.includes(a.key)
                  ? "bg-primary/10 text-primary font-medium"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search detail, actor or channel"
              aria-label="Search log"
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs"
            />
          </div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground" htmlFor="log-from">From</label>
          <input
            id="log-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
          <label className="text-[10px] font-mono uppercase text-muted-foreground" htmlFor="log-to">To</label>
          <input
            id="log-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
          <button
            type="button"
            disabled={!dirty}
            onClick={() => { setActions([]); setSearch(""); setFrom(""); setTo(""); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" /> Reset filters
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {auditQ.isLoading ? (
          <div className="p-4 sm:p-6">
            <ListSkeleton rows={6} />
          </div>
        ) : auditQ.isError ? (
          <div className="p-4 sm:p-6">
            <ErrorState onRetry={() => auditQ.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No matching activity"
            description="Bookings, reschedules, cancellations and reminder sends appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-start gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                    r.action.includes("failed")
                      ? "bg-destructive/10 text-destructive"
                      : r.action === "cancelled"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {r.action.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs">{r.detail ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                    {r.actor_label ? ` · ${r.actor_label}` : ""}
                    {r.channel ? ` · ${r.channel}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
