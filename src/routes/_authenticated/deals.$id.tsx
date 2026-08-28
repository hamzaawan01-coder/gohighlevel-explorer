import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ErrorState, PanelSkeleton } from "@/components/ui/states";
import { DealDetailPanel } from "@/components/DealDetailPanel";
import { supabase } from "@/integrations/supabase/client";
import { fetchDeal, type Stage } from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  head: () => ({
    meta: [{ title: "Deal — Agency Engine" }],
  }),
  component: DealDetailPage,
});

function DealDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const dealQ = useQuery({
    queryKey: ["deal", id],
    queryFn: () => fetchDeal(id),
  });

  const stagesQ = useQuery({
    queryKey: ["pipeline-stages", dealQ.data?.pipeline_id],
    enabled: !!dealQ.data?.pipeline_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", dealQ.data!.pipeline_id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Stage[];
    },
  });

  return (
    <AppShell
      headerActions={
        <Link
          to="/opportunities"
          aria-label="Back to opportunities"
          className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors min-h-11 sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5 shrink-0" /> <span className="truncate">Back to opportunities</span>
        </Link>
      }
    >
      <h1 className="sr-only">Deal details</h1>
      <div className="h-full overflow-auto">
        {dealQ.isLoading || stagesQ.isLoading ? (
          <PanelSkeleton />
        ) : dealQ.error || !dealQ.data ? (
          <ErrorState
            title="Deal not found"
            description="This deal may have been deleted, or failed to load."
            onRetry={() => dealQ.refetch()}
          />
        ) : (
          <DealDetailPanel
            dealId={id}
            stages={stagesQ.data ?? []}
            onClose={() => navigate({ to: "/opportunities" })}
          />
        )}
      </div>
    </AppShell>
  );
}
