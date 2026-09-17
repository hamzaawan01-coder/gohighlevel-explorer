import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Trophy,
  Clock,
  Target,
  DollarSign,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { CardGridSkeleton, KpiSkeleton } from "@/components/ui/states";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { fetchReports } from "@/lib/reports";
import { useSessionReady } from "@/lib/session-ready";
import { fetchDefaultCurrency, formatAmount } from "@/lib/custom-fields";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Lead Convert" },
      { name: "description", content: "Win rate, cycle time, source attribution, and per-rep activity." },
      { property: "og:title", content: "Reports — Lead Convert" },
      { property: "og:description", content: "Win rate, cycle time, source attribution, and per-rep activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const { ready: sessionReady } = useSessionReady();
  const { data, isLoading } = useQuery({
    queryKey: ["reports", subId],
    // Reports resolve teammate names through a signed-in-only function.
    enabled: !!subId && sessionReady,
    queryFn: () => fetchReports(subId!),
  });
  const { data: currency } = useQuery({
    queryKey: ["default-currency", subId],
    enabled: !!subId,
    queryFn: () => fetchDefaultCurrency(subId!),
  });
  const cash = (v: number) => formatAmount(v, currency);

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Sales performance across your pipeline, sources, and team."
        crumbs={[{ label: "Sales" }, { label: "Reports" }]}
      />
      <PageBody>
        <div className="space-y-6">
          {!sessionReady ? (
            <>
              <p className="text-xs text-muted-foreground">Checking your session…</p>
              <KpiSkeleton />
              <CardGridSkeleton count={2} />
            </>
          ) : isLoading || !data ? (
            <>
              <KpiSkeleton />
              <CardGridSkeleton count={2} />
            </>
          ) : (
            <>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Win rate" value={`${data.winRate}%`} sub={`${data.wonCount} won · ${data.lostCount} lost`} icon={Target} tint="text-emerald-500" />
                <Kpi label="Won value" value={cash(data.totalWonValue)} sub={`${data.wonCount} deals`} icon={Trophy} tint="text-amber-500" />
                <Kpi label="Avg cycle" value={data.avgCycleDays == null ? "—" : `${data.avgCycleDays}d`} sub="Created → won" icon={Clock} tint="text-blue-500" />
                <Kpi label="Pipeline sources" value={String(data.sourceBreakdown.length)} sub="Attributed channels" icon={DollarSign} tint="text-violet-500" />
              </div>

              <div className="surface-card p-5">
                <h2 className="text-sm font-semibold mb-4">Deals over time (last 8 weeks)</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dealsByWeek}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                      <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} name="Created" dot={false} />
                      <Line type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2} name="Won" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="surface-card p-5">
                  <h2 className="text-sm font-semibold mb-4">Source attribution</h2>
                  {data.sourceBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No sources yet.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.sourceBreakdown} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="source" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }} width={80} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => cash(v)} />
                          <Bar dataKey="value" fill="#8b5cf6" name="Deal value" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="surface-card p-5">
                  <h2 className="text-sm font-semibold mb-4">Per-rep activity</h2>
                  {data.repActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No activity yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                          <th className="text-left py-2 font-mono">Rep</th>
                          <th className="text-right py-2 font-mono">Deals</th>
                          <th className="text-right py-2 font-mono">Value</th>
                          <th className="text-right py-2 font-mono">Tasks done</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.repActivity.map((r, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 font-medium truncate max-w-[140px]">{r.name}</td>
                            <td className="py-2 text-right font-mono">{r.deals}</td>
                            <td className="py-2 text-right font-mono">{cash(r.value)}</td>
                            <td className="py-2 text-right font-mono">{r.tasksDone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </PageBody>

    </AppShell>
  );
}

function Kpi({
  label, value, sub, icon: Icon, tint,
}: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>; tint: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${tint}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
