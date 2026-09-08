import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, MoveRight, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { ErrorState, EmptyState } from "@/components/ui/states";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenancy } from "@/lib/tenancy";
import {
  ensureDefaultPipeline,
  fetchBoard,
  listPipelines,
  moveDeal,
  type Deal,
  type Stage,
} from "@/lib/pipeline";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { formatAmount } from "@/lib/custom-fields";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Lead Convert CRM" },
      {
        name: "description",
        content:
          "See every lead grouped by pipeline stage and move any of them forward or back with one button.",
      },
      { property: "og:title", content: "Pipeline — Lead Convert CRM" },
      {
        property: "og:description",
        content: "Leads grouped by stage with a one-click move-stage button.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PipelinePage,
});

function money(value: number, currency?: string | null) {
  return formatAmount(value, currency);
}

function LeadRow({
  deal,
  stages,
  contactName,
  onMove,
  moving,
}: {
  deal: Deal;
  stages: Stage[];
  contactName?: string;
  onMove: (stageId: string) => void;
  moving: boolean;
}) {
  const currentStage = stages.find((s) => s.id === deal.stage_id);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{deal.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {contactName ? `${contactName} · ` : ""}
          {money(Number(deal.value), deal.currency)}
        </p>
      </div>
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
        {currentStage?.name ?? "No stage"}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={moving || stages.length < 2}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {moving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MoveRight className="size-3.5" />
            )}
            Move stage
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {stages.map((s) => (
            <DropdownMenuItem
              key={s.id}
              disabled={s.id === deal.stage_id}
              onClick={() => onMove(s.id)}
              className={s.id === deal.stage_id ? "font-semibold" : ""}
            >
              {s.name}
              {s.id === deal.stage_id ? " (current)" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PipelinePage() {
  const queryClient = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

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

  const contactsQuery = useQuery({
    queryKey: ["contacts", subId],
    enabled: !!subId,
    queryFn: () => fetchContacts(subId!),
  });
  const contactsById = useMemo(
    () => new Map((contactsQuery.data ?? []).map((c: Contact) => [c.id, c])),
    [contactsQuery.data],
  );

  const stages = boardQuery.data?.stages ?? [];
  const deals = boardQuery.data?.deals ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const contact = d.contact_id ? contactsById.get(d.contact_id) : undefined;
      const name = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}` : "";
      return d.title.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });
  }, [deals, search, contactsById]);

  const grouped = useMemo(
    () =>
      stages.map((stage) => {
        const items = filtered
          .filter((d) => d.stage_id === stage.id)
          .sort((a, b) => a.position - b.position);
        return {
          stage,
          items,
          value: items.reduce((sum, d) => sum + Number(d.value || 0), 0),
        };
      }),
    [stages, filtered],
  );

  const moveMut = useMutation({
    mutationFn: async ({ deal, stageId }: { deal: Deal; stageId: string }) => {
      const inTarget = deals.filter((d) => d.stage_id === stageId);
      const position = inTarget.length
        ? Math.max(...inTarget.map((d) => d.position)) + 1
        : 0;
      return moveDeal(deal.id, stageId, position);
    },
    onMutate: ({ deal }) => setMovingId(deal.id),
    onSuccess: (_r, { stageId }) => {
      const name = stages.find((s) => s.id === stageId)?.name ?? "the new stage";
      toast.success(`Moved to ${name}`);
    },
    onError: (e: Error) => toast.error(e.message || "Could not move this lead"),
    onSettled: () => {
      setMovingId(null);
      queryClient.invalidateQueries({ queryKey: ["board", pipelineId] });
    },
  });

  const loading = defaultQuery.isLoading || pipelinesQuery.isLoading || boardQuery.isLoading;
  const totalValue = filtered.reduce((s, d) => s + Number(d.value || 0), 0);
  const boardCurrency = filtered[0]?.currency;

  return (
    <AppShell
      headerStatus={
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {filtered.length} leads · {money(totalValue, boardCurrency)}
        </span>
      }
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-border px-6 pt-5 pb-4">
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every lead grouped by the stage it is sitting in. Use “Move stage” to push one forward
            or back.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 min-w-[200px] items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-secondary">
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
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads"
                data-page-search
                className="h-9 w-full pl-8 text-xs sm:w-[240px]"
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span className="text-xs">Loading your pipeline…</span>
            </div>
          ) : boardQuery.isError ? (
            <div className="surface-card">
              <ErrorState
                title="Couldn't load your pipeline"
                error={boardQuery.error}
                onRetry={() => boardQuery.refetch()}
                retrying={boardQuery.isFetching}
              />
            </div>
          ) : !stages.length ? (
            <EmptyState
              title="No stages yet"
              description="Add stages to this pipeline from Opportunities → Pipelines, then your leads will show up here grouped by stage."
            />
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
              {grouped.map(({ stage, items, value }) => (
                <section key={stage.id}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider">{stage.name}</h2>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {items.length} · {money(value, items[0]?.currency ?? boardCurrency)}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-4 text-xs text-muted-foreground">
                      No leads in this stage.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {items.map((deal) => {
                        const contact = deal.contact_id ? contactsById.get(deal.contact_id) : undefined;
                        const contactName = contact
                          ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || undefined
                          : undefined;
                        return (
                          <LeadRow
                            key={deal.id}
                            deal={deal}
                            stages={stages}
                            contactName={contactName}
                            moving={movingId === deal.id}
                            onMove={(stageId) => moveMut.mutate({ deal, stageId })}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
