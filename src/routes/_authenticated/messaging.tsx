import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MailCheck, MessageSquare, Send, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { useTenancy } from "@/lib/tenancy";
import { useSessionReady } from "@/lib/session-ready";
import {
  deliveryCounts,
  fetchDeliveries,
  filterDeliveries,
  type DeliveryFilter,
} from "@/lib/message-delivery";

export const Route = createFileRoute("/_authenticated/messaging")({
  head: () => ({
    meta: [
      { title: "Message delivery — Lead Convert" },
      {
        name: "description",
        content:
          "Track every text and email your CRM sends: who is waiting, what went out, and what failed.",
      },
      { property: "og:title", content: "Message delivery — Lead Convert" },
      {
        property: "og:description",
        content: "Pending, sent and failed messages per contact, with provider and delivery status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagingPage,
});

const TABS: { key: DeliveryFilter; label: string }[] = [
  { key: "pending", label: "Waiting to send" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "all", label: "Everything" },
];

function when(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "sent"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-amber-500/10 text-amber-600";
  const label = status === "queued" ? "waiting" : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tone}`}>
      {label}
    </span>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
    </div>
  );
}

function MessagingPage() {
  const subAccountId = useTenancy((s) => s.currentSubAccountId);
  const { ready } = useSessionReady();
  const [tab, setTab] = useState<DeliveryFilter>("pending");

  const q = useQuery({
    queryKey: ["message-delivery", subAccountId],
    queryFn: () => fetchDeliveries(subAccountId!),
    enabled: Boolean(subAccountId) && ready,
    refetchInterval: 30_000,
  });

  const rows = q.data ?? [];
  const counts = useMemo(() => deliveryCounts(rows), [rows]);
  const visible = useMemo(() => filterDeliveries(rows, tab), [rows, tab]);


  return (
    <AppShell>
      <PageHeader
        title="Message delivery"
        description="Every text and email the CRM sends — TextMagic, Twilio and email — with its live status."
        crumbs={[{ label: "Communication" }, { label: "Message delivery" }]}
      />
      <PageBody>
        {q.isLoading ? (
          <KpiSkeleton count={4} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Waiting to send" value={counts.pending} icon={Clock} />
            <Kpi label="Sent" value={counts.sent} icon={MailCheck} />
            <Kpi label="Failed" value={counts.failed} icon={TriangleAlert} />
            <Kpi label="Total tracked" value={counts.total} icon={Send} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <section className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          {q.isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={5} />
            </div>
          ) : q.isError ? (
            <div className="p-4">
              <ErrorState
                title="Could not load messages"
                description={(q.error as Error)?.message}
                onRetry={() => q.refetch()}
              />
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageSquare}
                title="Nothing here yet"
                description="Messages appear as soon as a workflow, campaign or new lead reply sends one."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Sent / due</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        {r.contact_id ? (
                          <Link
                            to="/contacts/$id"
                            params={{ id: r.contact_id }}
                            className="font-medium hover:underline"
                          >
                            {r.contact_name ?? "View contact"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block">{r.to_address}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {r.channel}
                          {r.provider ? ` · ${r.provider}` : ""}
                        </span>
                      </td>
                      <td className="max-w-[26rem] px-3 py-2">
                        <span className="line-clamp-2 text-muted-foreground">
                          {r.subject ? `${r.subject} — ` : ""}
                          {r.body_text ?? ""}
                        </span>
                        {r.error ? (
                          <span className="mt-0.5 block text-[10px] text-destructive">
                            {r.error}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={r.status} />
                        {r.attempts > 1 ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {r.attempts} tries
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {r.status === "sent"
                          ? when(r.sent_at)
                          : when(r.scheduled_at ?? r.next_attempt_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageBody>
    </AppShell>
  );
}
