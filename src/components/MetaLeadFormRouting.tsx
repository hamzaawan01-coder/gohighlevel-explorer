import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMetaLeadFormRoutes, setMetaLeadFormRoute } from "@/lib/meta.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, RefreshCw } from "lucide-react";

type Form = { pageId: string; pageName: string; formId: string; formName: string; status?: string };
type Route = { id: string; page_id: string | null; form_id: string; pipeline_id: string; stage_id: string };
type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string; position: number };

const NONE = "__default__";

export function MetaLeadFormRouting({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMetaLeadFormRoutes);
  const setFn = useServerFn(setMetaLeadFormRoute);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["meta-lead-form-routes", subId],
    queryFn: () => listFn({ data: { subAccountId: subId } }),
  });

  const save = useMutation({
    mutationFn: (input: {
      formId: string;
      formName?: string | null;
      pageId?: string | null;
      pipelineId: string | null;
      stageId: string | null;
    }) => setFn({ data: { subAccountId: subId, ...input } }),
    onSuccess: (res: { cleared?: boolean }) => {
      toast.success(res?.cleared ? "Form now uses the default pipeline" : "Lead Ad form routing saved");
      qc.invalidateQueries({ queryKey: ["meta-lead-form-routes", subId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forms = (data?.forms ?? []) as Form[];
  const routes = (data?.routes ?? []) as Route[];
  const pipelines = (data?.pipelines ?? []) as Pipeline[];
  const stages = (data?.stages ?? []) as Stage[];
  const errors = (data?.errors ?? []) as Array<{ pageName: string; error: string }>;

  const routeFor = (formId: string) => routes.find((r) => r.form_id === formId);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4" />
          <div>
            <h3 className="font-medium text-sm">Lead Ad form routing</h3>
            <p className="text-[11px] text-muted-foreground">
              Choose which pipeline and stage new opportunities land in, per Lead Ad form.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => qc.invalidateQueries({ queryKey: ["meta-lead-form-routes", subId] })}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <p className="p-4 text-xs text-muted-foreground">Loading Lead Ad forms…</p>
      ) : pipelines.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          Create a pipeline with at least one stage first, then come back to map your forms.
        </p>
      ) : forms.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          No Lead Ad forms found on your connected Pages yet. Create a lead form in Meta, then refresh.
        </p>
      ) : (
        forms.map((f) => {
          const route = routeFor(f.formId);
          const pipelineId = route?.pipeline_id ?? NONE;
          const pipelineStages = stages.filter((s) => s.pipeline_id === route?.pipeline_id);
          return (
            <div key={f.formId} className="p-4 border-t border-border first:border-t-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.formName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {f.pageName} · form {f.formId}
                  </p>
                </div>
                {route ? (
                  <Badge variant="secondary">Custom</Badge>
                ) : (
                  <Badge variant="outline">Default pipeline</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Pipeline</label>
                  <Select
                    value={pipelineId}
                    onValueChange={(v) => {
                      if (v === NONE) {
                        save.mutate({ formId: f.formId, formName: f.formName, pageId: f.pageId, pipelineId: null, stageId: null });
                        return;
                      }
                      const first = stages.filter((s) => s.pipeline_id === v)[0];
                      if (!first) {
                        toast.error("That pipeline has no stages yet");
                        return;
                      }
                      save.mutate({
                        formId: f.formId,
                        formName: f.formName,
                        pageId: f.pageId,
                        pipelineId: v,
                        stageId: first.id,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Default pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Use default pipeline</SelectItem>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Stage</label>
                  <Select
                    value={route?.stage_id ?? ""}
                    disabled={!route}
                    onValueChange={(v) =>
                      save.mutate({
                        formId: f.formId,
                        formName: f.formName,
                        pageId: f.pageId,
                        pipelineId: route!.pipeline_id,
                        stageId: v,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="First stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })
      )}

      {errors.length > 0 && (
        <div className="p-4 border-t border-border space-y-1">
          {errors.map((e) => (
            <p key={e.pageName} className="text-[11px] text-destructive">
              {e.pageName}: {e.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
