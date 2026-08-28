import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Trophy,
  CheckSquare,
  Users,
  AlertCircle,
  ArrowRight,
  Briefcase,
  Activity,
  BarChart3,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, KpiSkeleton, ListSkeleton, SkeletonBlock } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { useTenancy } from "@/lib/tenancy";
import { fetchDashboardStats } from "@/lib/dashboard-stats";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Agency Engine" },
      {
        name: "description",
        content: "Pipeline value, deals won, tasks due, and recent activity at a glance.",
      },
      { property: "og:title", content: "Dashboard — Agency Engine" },
      {
        property: "og:description",
        content: "Pipeline value, deals won, tasks due, and recent activity at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const query = useQuery({
    queryKey: ["dashboard-stats", subId],
    enabled: !!subId,
    queryFn: () => fetchDashboardStats(subId!),
  });
  const { data, isLoading, isError, error, refetch, isFetching } = query;

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="A quick pulse on your pipeline, deals, and tasks."
        crumbs={[{ label: "Sales" }, { label: "Dashboard" }]}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/reports">
              <BarChart3 className="size-3.5" />
              Full reports
            </Link>
          </Button>
        }
      />

      <PageBody>
        {isError ? (
          <div className="surface-card">
            <ErrorState
              title="Couldn't load your dashboard"
              error={error}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          </div>
        ) : isLoading || !data ? (
          <>
            <KpiSkeleton />
            <div className="grid grid-cols-1 density-gap lg:grid-cols-3">
              <div className="surface-card space-y-4 p-5 lg:col-span-2">
                <SkeletonBlock className="h-3 w-32" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <SkeletonBlock className="h-2.5 w-1/3" />
                    <SkeletonBlock className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
              <div className="surface-card p-2">
                <ListSkeleton rows={5} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Pipeline value"
                value={`$${data.pipelineValue.toLocaleString()}`}
                sub={`${data.openDeals} open deals`}
                icon={TrendingUp}
                tone="primary"
              />
              <KpiCard
                label="Won this month"
                value={`$${data.wonValueThisMonth.toLocaleString()}`}
                sub={`${data.wonThisMonth} deals closed`}
                icon={Trophy}
                tone="success"
              />
              <KpiCard
                label="Tasks due today"
                value={String(data.tasksDueToday)}
                sub={data.tasksOverdue > 0 ? `${data.tasksOverdue} overdue` : "Nothing overdue"}
                icon={data.tasksOverdue > 0 ? AlertCircle : CheckSquare}
                tone={data.tasksOverdue > 0 ? "destructive" : "warning"}
              />
              <KpiCard
                label="New contacts / 7d"
                value={String(data.newContactsThisWeek)}
                sub="Last 7 days"
                icon={Users}
                tone="info"
              />
            </div>

            <div className="grid grid-cols-1 density-gap lg:grid-cols-3">
              <section className="surface-card p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold">Pipeline by stage</h2>
                  <Link
                    to="/opportunities"
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open opportunities <ArrowRight className="size-3" />
                  </Link>
                </div>
                {data.stageBreakdown.length === 0 ? (
                  <EmptyState
                    compact
                    icon={BarChart3}
                    title="No pipeline stages yet"
                    description="Create a pipeline and add your first opportunity to see stage values here."
                    action={
                      <Button asChild size="sm">
                        <Link to="/opportunities">Set up pipeline</Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {data.stageBreakdown.map((s) => {
                      const max = Math.max(1, ...data.stageBreakdown.map((x) => x.value));
                      const pct = (s.value / max) * 100;
                      return (
                        <div key={s.stage}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{ background: s.color }}
                              />
                              <span className="font-medium">{s.stage}</span>
                              <span className="text-muted-foreground">· {s.count}</span>
                            </div>
                            <span className="font-mono text-[11px]">
                              ${s.value.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full transition-[width] duration-500"
                              style={{ width: `${pct}%`, background: s.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="surface-card p-5">
                <h2 className="mb-4 font-display text-sm font-bold">Recent activity</h2>
                {data.recentActivity.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Activity}
                    title="No activity yet"
                    description="Deals, tasks, and new contacts will appear here as your team works."
                  />
                ) : (
                  <ul className="space-y-3">
                    {data.recentActivity.map((a) => {
                      const Icon =
                        a.kind === "deal" ? Briefcase : a.kind === "task" ? CheckSquare : Users;
                      return (
                        <li key={`${a.kind}-${a.id}`} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary">
                            <Icon className="size-3 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(a.when).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </PageBody>
    </AppShell>
  );
}

const TONES: Record<string, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/15",
  destructive: "text-destructive bg-destructive/10",
  info: "text-info bg-info/10",
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES | string;
}) {
  return (
    <div className="surface-card group p-4 transition-shadow hover:elevation-raised">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span
          className={`flex size-7 items-center justify-center rounded-md ${
            TONES[tone] ?? TONES["primary"]
          }`}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
