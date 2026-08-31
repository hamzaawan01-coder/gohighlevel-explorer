import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgePoundSterling,
  Coins,
  Compass,
  Loader2,
  PhoneCall,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/ui/states";
import { useTenancy } from "@/lib/tenancy";
import { useSessionReady } from "@/lib/session-ready";
import {
  CALL_OUTCOMES,
  deleteAdSpend,
  fetchAdRoi,
  fetchAttribution,
  fetchCallAnalytics,
  listAdSpend,
  rangeDays,
  saveAdSpend,
  type AdSpendRow,
  type AttributionModel,
} from "@/lib/attribution";

export const Route = createFileRoute("/_authenticated/attribution")({
  head: () => ({
    meta: [
      { title: "Attribution — Lead Convert" },
      {
        name: "description",
        content:
          "See which sources produce revenue, track return on ad spend by platform, and measure call performance.",
      },
      { property: "og:title", content: "Attribution — Lead Convert" },
      {
        property: "og:description",
        content: "Source-to-revenue attribution, ad spend ROI and call analytics in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttributionPage,
});

type Tab = "sources" | "roi" | "calls";
const RANGES = [7, 30, 90] as const;

function money(v: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${Math.round(v)}`;
  }
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 className="font-display text-sm font-bold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const chartAxis = { stroke: "hsl(var(--muted-foreground))", fontSize: 10 } as const;

function chartTooltip() {
  return {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 11,
    },
  };
}

function AttributionPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const { ready } = useSessionReady();
  const [tab, setTab] = useState<Tab>("sources");
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { from, to } = useMemo(() => rangeDays(days), [days]);

  return (
    <AppShell>
      <PageHeader
        title="Attribution"
        description="Where your leads and revenue actually come from — by source, by ad platform, and by phone call."
        crumbs={[{ label: "Sales" }, { label: "Attribution" }]}
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
        meta={
          <div className="flex items-center gap-1">
            {(
              [
                ["sources", "Source → revenue"],
                ["roi", "Ad spend ROI"],
                ["calls", "Call analytics"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tab === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <PageBody>
        {!subId ? (
          <EmptyState
            icon={Compass}
            title="Pick a workspace"
            description="Choose a workspace in the sidebar to see its attribution data."
          />
        ) : !ready ? (
          <KpiSkeleton />
        ) : tab === "sources" ? (
          <SourcesTab subId={subId} from={from} to={to} />
        ) : tab === "roi" ? (
          <RoiTab subId={subId} from={from} to={to} />
        ) : (
          <CallsTab subId={subId} from={from} to={to} />
        )}
      </PageBody>
    </AppShell>
  );
}

/* ------------------------- Source → revenue ------------------------- */

function SourcesTab({ subId, from, to }: { subId: string; from: string; to: string }) {
  const [model, setModel] = useState<AttributionModel>("first");
  const q = useQuery({
    queryKey: ["attribution", subId, from, to, model],
    queryFn: () => fetchAttribution(subId, from, to, model),
  });

  if (q.isLoading) return <KpiSkeleton />;
  if (q.isError)
    return <ErrorState title="Couldn't load attribution" error={q.error} onRetry={() => q.refetch()} />;

  const r = q.data!;
  const cur = r.currency;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="New leads" value={String(r.totals.leads)} icon={Users} hint={`${r.unknownLeads} untracked`} />
        <Kpi
          label="Won deals"
          value={String(r.totals.wonDeals)}
          icon={TrendingUp}
          hint={money(r.totals.wonValue, cur)}
        />
        <Kpi label="Collected revenue" value={money(r.totals.paidRevenue, cur)} icon={BadgePoundSterling} hint="From paid invoices" />
        <Kpi
          label="Return on ad spend"
          value={r.totals.roas != null ? `${r.totals.roas.toFixed(2)}x` : "—"}
          icon={Coins}
          hint={`${money(r.totals.spend, cur)} spend logged`}
        />
      </div>

      <Panel
        title="Source to revenue"
        description="Every lead created in this window, credited to the source that brought them in."
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {(
              [
                ["first", "First touch"],
                ["last", "Last touch"],
              ] as [AttributionModel, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setModel(key)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  model === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {r.rows.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No leads in this window"
            description="Once contacts come in from forms, ads or imports, their sources appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 text-right font-medium">Leads</th>
                  <th className="py-2 pr-3 text-right font-medium">Deals</th>
                  <th className="py-2 pr-3 text-right font-medium">Won</th>
                  <th className="py-2 pr-3 text-right font-medium">Won value</th>
                  <th className="py-2 pr-3 text-right font-medium">Collected</th>
                  <th className="py-2 pr-3 text-right font-medium">Spend</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost / lead</th>
                  <th className="py-2 pr-3 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{row.source}</td>
                    <td className="py-2 pr-3 text-right">{row.leads}</td>
                    <td className="py-2 pr-3 text-right">{row.deals}</td>
                    <td className="py-2 pr-3 text-right">{row.wonDeals}</td>
                    <td className="py-2 pr-3 text-right">{money(row.wonValue, cur)}</td>
                    <td className="py-2 pr-3 text-right">{money(row.paidRevenue, cur)}</td>
                    <td className="py-2 pr-3 text-right">{row.spend ? money(row.spend, cur) : "—"}</td>
                    <td className="py-2 pr-3 text-right">{row.cpl != null ? money(row.cpl, cur) : "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {row.roas != null ? `${row.roas.toFixed(2)}x` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {r.rows.length > 0 ? (
        <Panel title="Revenue by source" description="Collected revenue, falling back to won deal value.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.rows.slice(0, 8).map((x) => ({ source: x.source, revenue: x.paidRevenue || x.wonValue, leads: x.leads }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="source" {...chartAxis} />
                <YAxis {...chartAxis} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/* ---------------------------- Ad spend ROI ---------------------------- */

const PLATFORMS: AdSpendRow["platform"][] = ["meta", "google", "tiktok", "linkedin", "other"];

function RoiTab({ subId, from, to }: { subId: string; from: string; to: string }) {
  const qc = useQueryClient();
  const roi = useQuery({
    queryKey: ["ad-roi", subId, from, to],
    queryFn: () => fetchAdRoi(subId, from, to),
  });
  const rows = useQuery({
    queryKey: ["ad-spend", subId, from, to],
    queryFn: () => listAdSpend(subId, from, to),
  });

  const [form, setForm] = useState({
    spend_date: new Date().toISOString().slice(0, 10),
    platform: "meta" as AdSpendRow["platform"],
    campaign_name: "",
    spend: "",
    clicks: "",
    impressions: "",
    leads: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ad-roi", subId] });
    qc.invalidateQueries({ queryKey: ["ad-spend", subId] });
    qc.invalidateQueries({ queryKey: ["attribution", subId] });
  };

  const add = useMutation({
    mutationFn: () =>
      saveAdSpend({
        sub_account_id: subId,
        spend_date: form.spend_date,
        platform: form.platform,
        campaign_name: form.campaign_name || null,
        spend: Number(form.spend || 0),
        clicks: Number(form.clicks || 0),
        impressions: Number(form.impressions || 0),
        leads: Number(form.leads || 0),
      }),
    onSuccess: () => {
      toast.success("Ad spend saved");
      setForm((f) => ({ ...f, campaign_name: "", spend: "", clicks: "", impressions: "", leads: "" }));
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save that spend entry"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAdSpend(id),
    onSuccess: () => {
      toast.success("Entry removed");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't remove entry"),
  });

  if (roi.isLoading) return <KpiSkeleton />;
  if (roi.isError)
    return <ErrorState title="Couldn't load ad ROI" error={roi.error} onRetry={() => roi.refetch()} />;

  const r = roi.data!;
  const cur = r.currency;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ad spend" value={money(r.totals.spend, cur)} icon={Coins} />
        <Kpi label="Revenue collected" value={money(r.totals.revenue, cur)} icon={BadgePoundSterling} />
        <Kpi
          label="ROAS"
          value={r.totals.roas != null ? `${r.totals.roas.toFixed(2)}x` : "—"}
          icon={TrendingUp}
          hint="Revenue per £1 of spend"
        />
        <Kpi
          label="Clicks"
          value={r.totals.clicks.toLocaleString()}
          icon={Users}
          hint={`${r.totals.impressions.toLocaleString()} impressions`}
        />
      </div>

      <Panel title="Spend vs revenue" description="Daily ad spend against revenue collected on the same day.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={r.series.map((p) => ({ ...p, date: p.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...chartTooltip()} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="By platform" description="Leads counted from the CRM's own first-touch data, not the ad platform's.">
        {r.platforms.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No spend logged yet"
            description="Add spend below to unlock cost per lead, cost per acquisition and ROAS."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Platform</th>
                  <th className="py-2 pr-3 text-right font-medium">Spend</th>
                  <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-3 text-right font-medium">CPC</th>
                  <th className="py-2 pr-3 text-right font-medium">CRM leads</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost / lead</th>
                  <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                  <th className="py-2 pr-3 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {r.platforms.map((p) => (
                  <tr key={p.platform} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium capitalize">{p.platform}</td>
                    <td className="py-2 pr-3 text-right">{money(p.spend, cur)}</td>
                    <td className="py-2 pr-3 text-right">{p.clicks.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">{p.cpc != null ? money(p.cpc, cur) : "—"}</td>
                    <td className="py-2 pr-3 text-right">{p.crmLeads}</td>
                    <td className="py-2 pr-3 text-right">{p.cpl != null ? money(p.cpl, cur) : "—"}</td>
                    <td className="py-2 pr-3 text-right">{money(p.paidRevenue || p.wonValue, cur)}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {p.roas != null ? `${p.roas.toFixed(2)}x` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Log ad spend"
        description="Enter spend manually until the ad platform sync fills it in for you."
      >
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <label className="space-y-1">
            <span className="eyebrow">Date</span>
            <input
              type="date"
              value={form.spend_date}
              onChange={(e) => setForm((f) => ({ ...f, spend_date: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">Platform</span>
            <select
              value={form.platform}
              onChange={(e) =>
                setForm((f) => ({ ...f, platform: e.target.value as AdSpendRow["platform"] }))
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs capitalize"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="eyebrow">Campaign (optional)</span>
            <input
              value={form.campaign_name}
              onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))}
              placeholder="Spring leads"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">Spend</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.spend}
              onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">Clicks</span>
            <input
              type="number"
              min="0"
              value={form.clicks}
              onChange={(e) => setForm((f) => ({ ...f, clicks: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">Impressions</span>
            <input
              type="number"
              min="0"
              value={form.impressions}
              onChange={(e) => setForm((f) => ({ ...f, impressions: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={add.isPending || !form.spend}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add spend
        </button>

        <div className="mt-5">
          {rows.isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : (rows.data ?? []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No spend entries in this window yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Platform</th>
                    <th className="py-2 pr-3 font-medium">Campaign</th>
                    <th className="py-2 pr-3 text-right font-medium">Spend</th>
                    <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{row.spend_date}</td>
                      <td className="py-2 pr-3 capitalize">{row.platform}</td>
                      <td className="py-2 pr-3">{row.campaign_name || "—"}</td>
                      <td className="py-2 pr-3 text-right">{money(Number(row.spend), row.currency)}</td>
                      <td className="py-2 pr-3 text-right">{row.clicks}</td>
                      <td className="py-2 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove.mutate(row.id)}
                          aria-label={`Delete spend entry for ${row.spend_date}`}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* --------------------------- Call analytics --------------------------- */

function CallsTab({ subId, from, to }: { subId: string; from: string; to: string }) {
  const q = useQuery({
    queryKey: ["call-analytics", subId, from, to],
    queryFn: () => fetchCallAnalytics(subId, from, to),
  });

  if (q.isLoading) return <KpiSkeleton />;
  if (q.isError)
    return <ErrorState title="Couldn't load call analytics" error={q.error} onRetry={() => q.refetch()} />;

  const c = q.data!;
  if (c.total === 0)
    return (
      <EmptyState
        icon={PhoneCall}
        title="No calls in this window"
        description="Once calls are made or received on your numbers, volume, answer rate and outcomes appear here."
      />
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Calls"
          value={String(c.total)}
          icon={PhoneCall}
          hint={`${c.inbound} in · ${c.outbound} out`}
        />
        <Kpi label="Answer rate" value={`${c.answerRate.toFixed(0)}%`} icon={TrendingUp} hint={`${c.missed} missed`} />
        <Kpi
          label="Talk time"
          value={`${c.totalMinutes} min`}
          icon={Users}
          hint={`avg ${Math.round(c.avgDurationSeconds)}s per answered call`}
        />
        <Kpi
          label="Untagged calls"
          value={String(c.untagged)}
          icon={Compass}
          hint="Tag outcomes on the Calls page"
        />
      </div>

      <Panel title="Call volume" description="Inbound and outbound calls per day, with answered calls overlaid.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.byDay.map((d) => ({ ...d, date: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis {...chartAxis} allowDecimals={false} />
              <Tooltip {...chartTooltip()} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inbound" name="Inbound" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="outbound" name="Outbound" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Outcomes" description="How calls ended, based on the tags your team applies.">
          <div className="space-y-2">
            {c.byOutcome.map((o) => {
              const pct = c.total ? (o.count / c.total) * 100 : 0;
              return (
                <div key={o.outcome}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{o.outcome}</span>
                    <span className="text-muted-foreground">
                      {o.count} · {Math.round(o.minutes)} min
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-[11px] text-muted-foreground">
              Available tags: {CALL_OUTCOMES.join(", ")}.
            </p>
          </div>
        </Panel>

        <Panel title="Best time to call" description="Call volume by hour of day, in your local time.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hour" {...chartAxis} interval={2} />
                <YAxis {...chartAxis} allowDecimals={false} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="calls" name="Calls" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
