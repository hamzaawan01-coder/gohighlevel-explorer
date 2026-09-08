import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  ArrowUpRight,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureDefaultPipeline,
  fetchBoard,
  createDeal,
  moveDeal,
  listPipelines,
  type Deal,
} from "@/lib/pipeline";
import { useTenancy } from "@/lib/tenancy";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NewDealDialog } from "@/components/NewDealDialog";
import { DealDetailPanel } from "@/components/DealDetailPanel";
import { PipelinesManagerPanel } from "@/components/PipelinesManagerPanel";
import { BulkActionsPanel } from "@/components/BulkActionsPanel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/DataTable";
import { ErrorState } from "@/components/ui/states";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { toast } from "sonner";
import { formatAmount } from "@/lib/custom-fields";

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — Agency Engine" },
      {
        name: "description",
        content:
          "Manage sales opportunities across pipelines, stages, and bulk actions — GHL-style operator dashboard.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

type TabKey = "opportunities" | "pipelines" | "bulk";

const TABS: { key: TabKey; label: string }[] = [
  { key: "opportunities", label: "Opportunities" },
  { key: "pipelines", label: "Pipelines" },
  { key: "bulk", label: "Bulk Actions" },
];

type SavedView = "all" | "mine" | "closing_week" | "stale";

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My deals" },
  { key: "closing_week", label: "Closing this week" },
  { key: "stale", label: "Stale > 14d" },
];

function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("opportunities");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [savedView, setSavedView] = useState<SavedView>("all");
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [activityMinimized, setActivityMinimized] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const subId = useTenancy((s) => s.currentSubAccountId);

  const defaultQuery = useQuery({
    queryKey: ["default-pipeline", userId, subId],
    enabled: !!userId && !!subId,
    queryFn: () => ensureDefaultPipeline(userId!, subId!),
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", subId],
    enabled: !!subId && !!defaultQuery.data,
    queryFn: () => listPipelines(subId!),
  });

  const pipelines = pipelinesQuery.data ?? [];
  const pipelineId =
    selectedPipelineId && pipelines.some((p) => p.id === selectedPipelineId)
      ? selectedPipelineId
      : pipelines[0]?.id ?? defaultQuery.data?.id ?? undefined;
  const currentPipeline = pipelines.find((p) => p.id === pipelineId);

  const boardQuery = useQuery({
    queryKey: ["board", pipelineId],
    enabled: !!pipelineId,
    queryFn: () => fetchBoard(pipelineId!),
  });

  const stages = boardQuery.data?.stages ?? [];
  const deals = boardQuery.data?.deals ?? [];

  const contactsQuery = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });
  const contactsById = useMemo(
    () => new Map((contactsQuery.data ?? []).map((c: Contact) => [c.id, c])),
    [contactsQuery.data],
  );

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    return deals.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q)) return false;
      if (savedView === "mine" && d.owner_id !== userId) return false;
      if (savedView === "closing_week") {
        if (!d.expected_close_date) return false;
        const t = new Date(d.expected_close_date).getTime();
        if (isNaN(t) || t < now || t > weekAhead) return false;
      }
      if (savedView === "stale") {
        const t = new Date(d.updated_at ?? d.created_at ?? 0).getTime();
        if (!t || t > fourteenDaysAgo) return false;
      }
      return true;
    });
  }, [deals, search, savedView, userId]);

  const totalValue = useMemo(
    () => filteredDeals.reduce((s, d) => s + Number(d.value), 0),
    [filteredDeals],
  );

  const createDealMut = useMutation({
    mutationFn: async (input: {
      title: string;
      value: number;
      currency?: string;
      stage_id: string;
      contact_id: string | null;
    }) => {
      if (!userId || !pipelineId || !subId) throw new Error("Not ready");
      return createDeal({ ...input, pipeline_id: pipelineId, owner_id: userId, sub_account_id: subId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", pipelineId] });
      toast.success("Opportunity added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: ({ dealId, stageId, position }: { dealId: string; stageId: string; position: number }) =>
      moveDeal(dealId, stageId, position),
    onMutate: async ({ dealId, stageId, position }) => {
      await queryClient.cancelQueries({ queryKey: ["board", pipelineId] });
      const prev = queryClient.getQueryData<{ stages: typeof stages; deals: Deal[] }>([
        "board",
        pipelineId,
      ]);
      if (prev) {
        const next = prev.deals.map((d) => ({ ...d }));
        const moving = next.find((d) => d.id === dealId);
        if (moving) {
          moving.stage_id = stageId;
          moving.position = position;
        }
        queryClient.setQueryData(["board", pipelineId], { ...prev, deals: next });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["board", pipelineId], ctx.prev);
      toast.error("Move failed");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["board", pipelineId] }),
  });

  const loading = defaultQuery.isLoading || pipelinesQuery.isLoading || boardQuery.isLoading;
  const totalDeals = filteredDeals.length;
  const unreadInbox = 2;

  const recentDeals = useMemo(
    () => [...deals].sort((a, b) => b.position - a.position).slice(0, 6),
    [deals],
  );

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {totalDeals} opportunities
          </span>
        </div>
      }
      headerActions={
        <>
          {activityMinimized && (
            <button
              onClick={() => setActivityMinimized(false)}
              title="Show activity"
              className="size-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <PanelRightOpen className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setNewDealOpen(true)}
            disabled={!stages.length || tab !== "opportunities"}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Add opportunity
          </button>
        </>
      }
      rightPane={
        activityMinimized ? null : (
          <>
            <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider">Activity</h2>
                <span className="font-mono text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {unreadInbox} new
                </span>
              </div>
              <button
                onClick={() => setActivityMinimized(true)}
                title="Minimize"
                className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose className="size-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {recentDeals.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No activity yet. Add your first opportunity to get started.
                  </p>
                </div>
              ) : (
                recentDeals.map((d) => (
                  <div key={d.id} className="p-4 border-b border-border">
                    <p className="text-xs font-semibold mb-1">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatAmount(d.value, d.currency)} ·{" "}
                      {stages.find((s) => s.id === d.stage_id)?.name ?? "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Page title + tabs */}
        <div className="px-6 pt-5 border-b border-border">
          <h1 className="text-xl font-bold mb-3">Opportunities</h1>
          <div className="flex items-center gap-6">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative py-3 text-sm transition-colors ${
                    active
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab body */}
        <div className="flex-1 min-h-0 overflow-auto p-6">
          {tab === "opportunities" && (
            <div className="flex flex-col gap-4 h-full min-h-0">
              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm font-medium min-w-[200px] justify-between">
                      {currentPipeline?.name ?? "Select pipeline"}
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {pipelines.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setSelectedPipelineId(p.id)}
                        className={p.id === pipelineId ? "font-semibold" : ""}
                      >
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onClick={() => setTab("pipelines")}>
                      Manage pipelines…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {totalDeals} opportunities · {formatAmount(totalValue, deals[0]?.currency)}
                </span>

                <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
                  {SAVED_VIEWS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setSavedView(v.key)}
                      className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
                        savedView === v.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>


                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search opportunities"
                      data-page-search
                      className="h-9 w-full pl-8 text-xs sm:w-[240px]"
                    />
                  </div>
                  <div className="flex items-center border border-border rounded-md p-0.5 bg-card">
                    <button
                      onClick={() => setView("kanban")}
                      title="Kanban view"
                      aria-label="Kanban view"
                      aria-pressed={view === "kanban"}
                      className={`size-7 rounded flex items-center justify-center ${
                        view === "kanban"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayoutGrid className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setView("list")}
                      title="Table view"
                      aria-label="Table view"
                      aria-pressed={view === "list"}
                      className={`size-7 rounded flex items-center justify-center ${
                        view === "list"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <List className="size-3.5" />
                    </button>
                  </div>
                  <button
                    disabled
                    title="Coming soon"
                    className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-medium text-muted-foreground disabled:opacity-60"
                  >
                    <Upload className="size-3.5" />
                    Import
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span className="text-xs">Loading your pipeline…</span>
                  </div>
                ) : boardQuery.isError ? (
                  <div className="surface-card h-full">
                    <ErrorState
                      title="Couldn't load opportunities"
                      error={boardQuery.error}
                      onRetry={() => boardQuery.refetch()}
                      retrying={boardQuery.isFetching}
                    />
                  </div>
                ) : view === "kanban" ? (
                  <div className="h-full overflow-x-auto overflow-y-hidden">
                    <KanbanBoard
                      stages={stages}
                      deals={filteredDeals}
                      onMove={(dealId, stageId, position) =>
                        moveMut.mutate({ dealId, stageId, position })
                      }
                      onOpenDeal={(id) => setOpenDealId(id)}
                    />
                  </div>
                ) : (
                  <div className="h-full overflow-auto">
                    <OpportunitiesTable
                      deals={filteredDeals}
                      stages={stages}
                      contactsById={contactsById}
                      currentUserId={userId}
                      onOpen={(id) => setOpenDealId(id)}
                      onAddDeal={() => setNewDealOpen(true)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "pipelines" && (
            <div className="max-w-4xl">
              {userId && subId ? (
                <PipelinesManagerPanel
                  subAccountId={subId}
                  userId={userId}
                  activePipelineId={pipelineId ?? null}
                  onSelectPipeline={setSelectedPipelineId}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
            </div>
          )}

          {tab === "bulk" && (
            <div className="max-w-6xl">
              {subId ? (
                <BulkActionsPanel subAccountId={subId} />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NewDealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        stages={stages}
        onCreate={async (input) => {
          await createDealMut.mutateAsync(input);
        }}
      />

      <Dialog open={!!openDealId} onOpenChange={(o) => !o && setOpenDealId(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0">
          <VisuallyHidden>
            <DialogTitle>Opportunity details</DialogTitle>
            <DialogDescription>View and edit opportunity details</DialogDescription>
          </VisuallyHidden>
          {openDealId && (
            <>
              <div className="flex justify-end px-4 pt-3">
                <Link
                  to="/deals/$id"
                  params={{ id: openDealId }}
                  onClick={() => setOpenDealId(null)}
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open full page <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <DealDetailPanel
                dealId={openDealId}
                stages={stages}
                onClose={() => setOpenDealId(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function OpportunitiesTable({
  deals,
  stages,
  contactsById,
  currentUserId,
  onOpen,
  onAddDeal,
}: {
  deals: Deal[];
  stages: { id: string; name: string; color: string }[];
  contactsById: Map<string, Contact>;
  currentUserId: string | null;
  onOpen: (id: string) => void;
  onAddDeal: () => void;
}) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const columns: Column<Deal>[] = [
    {
      key: "title",
      header: "Name",
      locked: true,
      sortValue: (d) => d.title.toLowerCase(),
      cell: (d) => <span className="min-w-0 truncate font-medium">{d.title}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      sortValue: (d) => {
        const c = d.contact_id ? contactsById.get(d.contact_id) : undefined;
        return c ? [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase() : "";
      },
      cell: (d) => {
        const c = d.contact_id ? contactsById.get(d.contact_id) : undefined;
        const name = c ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email : null;
        return <span className="min-w-0 truncate text-muted-foreground">{name ?? "—"}</span>;
      },
    },
    {
      key: "stage",
      header: "Stage",
      sortValue: (d) => stageById.get(d.stage_id)?.name ?? "",
      cell: (d) => {
        const stage = stageById.get(d.stage_id);
        return (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: stage?.color ?? "#64748b" }}
            />
            <span className="truncate">{stage?.name ?? "—"}</span>
          </span>
        );
      },
    },
    {
      key: "value",
      header: "Value",
      sortValue: (d) => Number(d.value),
      cell: (d) => <span className="font-mono">{formatAmount(d.value, d.currency)}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      sortValue: (d) => (d.owner_id === currentUserId ? "you" : d.owner_id ?? ""),
      cell: (d) => (
        <span className="text-muted-foreground">
          {d.owner_id ? (d.owner_id === currentUserId ? "You" : "Teammate") : "—"}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortValue: (d) => new Date(d.updated_at ?? d.created_at ?? 0).getTime(),
      cell: (d) => {
        const t = d.updated_at ?? d.created_at;
        return (
          <span className="text-xs text-muted-foreground">
            {t ? new Date(t).toLocaleDateString() : "—"}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable<Deal>
      tableKey="opportunities"
      caption="Opportunities"
      rows={deals}
      columns={columns}
      rowKey={(d) => d.id}
      onRowClick={(d) => onOpen(d.id)}
      emptyTitle="No opportunities yet"
      emptyDescription="Add your first opportunity to start tracking your pipeline."
      emptyAction={
        <Button size="sm" onClick={onAddDeal}>
          <Plus className="size-3.5" />
          Add opportunity
        </Button>
      }
    />
  );
}
