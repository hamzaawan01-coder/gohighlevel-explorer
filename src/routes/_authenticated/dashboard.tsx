import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureDefaultPipeline,
  fetchBoard,
  createDeal,
  moveDeal,
  type Deal,
} from "@/lib/pipeline";
import { useTenancy } from "@/lib/tenancy";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NewDealDialog } from "@/components/NewDealDialog";
import { DealDetailPanel } from "@/components/DealDetailPanel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Agency Engine — CRM, Pipelines, Conversations" },
      {
        name: "description",
        content:
          "Multi-tenant CRM, sales pipelines, email/SMS conversations and calendar bookings — all in one operator dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const subId = useTenancy((s) => s.currentSubAccountId);

  const pipelineQuery = useQuery({
    queryKey: ["pipeline", userId, subId],
    enabled: !!userId && !!subId,
    queryFn: () => ensureDefaultPipeline(userId!, subId!),
  });

  const pipelineId = pipelineQuery.data?.id;

  const boardQuery = useQuery({
    queryKey: ["board", pipelineId],
    enabled: !!pipelineId,
    queryFn: () => fetchBoard(pipelineId!),
  });

  const stages = boardQuery.data?.stages ?? [];
  const deals = boardQuery.data?.deals ?? [];

  const createDealMut = useMutation({
    mutationFn: async (input: {
      title: string;
      value: number;
      stage_id: string;
      contact_id: string | null;
    }) => {
      if (!userId || !pipelineId || !subId) throw new Error("Not ready");
      return createDeal({ ...input, pipeline_id: pipelineId, owner_id: userId, sub_account_id: subId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", pipelineId] });
      toast.success("Deal added");
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

  const loading = pipelineQuery.isLoading || boardQuery.isLoading;
  const totalDeals = deals.length;
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
            {totalDeals} deals
          </span>
        </div>
      }
      headerActions={
        <button
          onClick={() => setNewDealOpen(true)}
          disabled={!stages.length}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          New Deal
        </button>
      }
      rightPane={
        <>
          <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wider">Activity</h2>
            <span className="font-mono text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              {unreadInbox} new
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {recentDeals.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No activity yet. Add your first deal to get started.
                </p>
              </div>
            ) : (
              recentDeals.map((d) => (
                <div key={d.id} className="p-4 border-b border-border">
                  <p className="text-xs font-semibold mb-1">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    ${Number(d.value).toLocaleString()} ·{" "}
                    {stages.find((s) => s.id === d.stage_id)?.name ?? "—"}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 bg-secondary/50 border-t border-border">
            <div className="bg-card ring-1 ring-black/5 rounded p-3">
              <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">
                Quick Note
              </p>
              <textarea
                placeholder="Draft internal note…"
                className="w-full text-xs bg-transparent border-none resize-none focus:outline-none min-h-[60px]"
              />
            </div>
          </div>
        </>
      }
    >
      <div className="h-full overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            <span className="text-xs">Loading your pipeline…</span>
          </div>
        ) : (
          <KanbanBoard
            stages={stages}
            deals={deals}
            onMove={(dealId, stageId, position) => moveMut.mutate({ dealId, stageId, position })}
            onOpenDeal={(id) => setOpenDealId(id)}
          />
        )}
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
          {openDealId && (
            <DealDetailPanel
              dealId={openDealId}
              stages={stages}
              onClose={() => setOpenDealId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

