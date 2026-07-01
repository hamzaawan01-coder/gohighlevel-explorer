import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Trophy,
  CheckSquare,
  Users,
  AlertCircle,
  Loader2,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { fetchDashboardStats } from "@/lib/dashboard-stats";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Agency Engine" },
      { name: "description", content: "Pipeline value, deals won, tasks due, and recent activity at a glance." },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", subId],
    enabled: !!subId,
    queryFn: () => fetchDashboardStats(subId!),
  });

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">
              A quick pulse on your pipeline, deals, and tasks.
            </p>
          </div>

          {isLoading || !data ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-xs">Loading stats…</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Pipeline value"
                  value={`$${data.pipelineValue.toLocaleString()}`}
                  sub={`${data.openDeals} open deals`}
                  icon={TrendingUp}
                  tint="text-blue-500"
                />
                <KpiCard
                  label="Won this month"
                  value={`$${data.wonValueThisMonth.toLocaleString()}`}
                  sub={`${data.wonThisMonth} deals closed`}
                  icon={Trophy}
                  tint="text-emerald-500"
                />
                <KpiCard
                  label="Tasks due today"
                  value={String(data.tasksDueToday)}
                  sub={
                    data.tasksOverdue > 0
                      ? `${data.tasksOverdue} overdue`
                      : "Nothing overdue"
                  }
                  icon={data.tasksOverdue > 0 ? AlertCircle : CheckSquare}
                  tint={data.tasksOverdue > 0 ? "text-red-500" : "text-amber-500"}
                />
                <KpiCard
                  label="New contacts / 7d"
                  value={String(data.newContactsThisWeek)}
                  sub="Last 7 days"
                  icon={Users}
                  tint="text-violet-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-card ring-1 ring-black/5 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">Pipeline by stage</h2>
                    <Link
                      to="/opportunities"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      Open opportunities <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  {data.stageBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      No stages yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data.stageBreakdown.map((s) => {
                        const max = Math.max(
                          1,
                          ...data.stageBreakdown.map((x) => x.value),
                        );
                        const pct = (s.value / max) * 100;
                        return (
                          <div key={s.stage}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ background: s.color }}
                                />
                                <span className="font-medium">{s.stage}</span>
                                <span className="text-muted-foreground">
                                  · {s.count}
                                </span>
                              </div>
                              <span className="font-mono text-[11px]">
                                ${s.value.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: s.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-card ring-1 ring-black/5 rounded-lg p-5">
                  <h2 className="text-sm font-semibold mb-4">Recent activity</h2>
                  {data.recentActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      Nothing yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.recentActivity.map((a) => {
                        const Icon =
                          a.kind === "deal"
                            ? Briefcase
                            : a.kind === "task"
                              ? CheckSquare
                              : Users;
                        return (
                          <li key={`${a.kind}-${a.id}`} className="flex items-start gap-2">
                            <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">
                                {a.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(a.when).toLocaleString()}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <div className="bg-card ring-1 ring-black/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className={`size-4 ${tint}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
