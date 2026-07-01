import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
      title="Deal"
      headerActions={
        <Link
          to="/pipeline"
          className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to pipeline
        </Link>
      }
    >
      <div className="h-full overflow-auto">
        {dealQ.isLoading || stagesQ.isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : dealQ.error || !dealQ.data ? (
          <div className="p-6 text-sm text-destructive">Deal not found.</div>
        ) : (
          <DealDetailPanel
            dealId={id}
            stages={stagesQ.data ?? []}
            onClose={() => navigate({ to: "/pipeline" })}
          />
        )}
      </div>
    </AppShell>
  );
}
