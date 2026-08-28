import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMetaLeadFormRoutes, setMetaLeadFormRoute, replayMetaLeadAdTest, listMetaLeadAdEvents } from "@/lib/meta.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, RefreshCw, PlayCircle, ScrollText } from "lucide-react";

type Form = { pageId: string; pageName: string; formId: string; formName: string; status?: string };
type Route = { id: string; page_id: string | null; form_id: string; pipeline_id: string; stage_id: string };
type Pipeline = { id: string; name: string };
type Stage = { id: string; pipeline_id: string; name: string; position: number };

type AuditEvent = {
  id: string;
  page_id: string | null;
  form_id: string | null;
  form_name: string | null;
  leadgen_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  routing_source: string;
  status: string;
  error: string | null;
  is_test: boolean;
  lead_fields: Record<string, unknown>;
  payload: unknown;
  created_at: string;
};

const NONE = "__default__";

export function MetaLeadFormRouting({ subId }: { subId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMetaLeadFormRoutes);
  const setFn = useServerFn(setMetaLeadFormRoute);
  const replayFn = useServerFn(replayMetaLeadAdTest);
  const eventsFn = useServerFn(listMetaLeadAdEvents);

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

  const events = useQuery({
    queryKey: ["meta-lead-ad-events", subId],
    queryFn: () => eventsFn({ data: { subAccountId: subId, limit: 25 } }),
  });

  const replay = useMutation({
    mutationFn: (input: { formId: string; formName?: string | null; pageId?: string | null }) =>
      replayFn({ data: { subAccountId: subId, ...input } }),
    onSuccess: (res: any) => {
      if (res?.error) toast.error(res.error);
      else
        toast.success(
          `${res?.usedSample ? "Sample" : "Last"} lead replayed → ${res?.pipelineName ?? "?"} · ${res?.stageName ?? "?"}` +
            (res?.duplicate ? " (existing opportunity reused)" : ""),
        );
      qc.invalidateQueries({ queryKey: ["meta-lead-ad-events", subId] });
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
                <div className="flex items-center gap-2 shrink-0">
                  {route ? (
                    <Badge variant="secondary">Custom</Badge>
                  ) : (
                    <Badge variant="outline">Default pipeline</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={replay.isPending}
                    onClick={() => replay.mutate({ formId: f.formId, formName: f.formName, pageId: f.pageId })}
                  >
                    <PlayCircle className="size-3.5 mr-1" />
                    Replay last test webhook
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={importing === f.formId}
                    onClick={() => {
                      setImporting(f.formId);
                      importLeads.mutate({ formId: f.formId, formName: f.formName, pageId: f.pageId });
                    }}
                  >
                    <DownloadCloud className={`size-3.5 mr-1 ${importing === f.formId ? "animate-pulse" : ""}`} />
                    {importing === f.formId ? "Importing…" : "Import past leads"}
                  </Button>
                </div>
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

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4" />
            <div>
              <h4 className="text-sm font-medium">Lead Ad audit trail</h4>
              <p className="text-[11px] text-muted-foreground">
                Every lead we received or replayed, the pipeline and stage used, and the webhook payload behind it.
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => events.refetch()}>
            <RefreshCw className={`size-4 ${events.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {(events.data?.events ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No Lead Ad activity recorded yet. Use “Replay last test webhook” above to create a test entry.
          </p>
        ) : (
          <div className="space-y-2">
            {((events.data?.events ?? []) as AuditEvent[]).map((ev) => {
              const pipelineName = ev.pipeline_id ? events.data?.pipelineNames?.[ev.pipeline_id] : null;
              const stageName = ev.stage_id ? events.data?.stageNames?.[ev.stage_id] : null;
              return (
                <details key={ev.id} className="rounded border border-border bg-muted/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ev.form_name ?? ev.form_id ?? "Unknown form"}</span>
                    <Badge variant={ev.status === "ok" ? "secondary" : ev.status === "error" ? "destructive" : "outline"}>
                      {ev.status}
                    </Badge>
                    {ev.is_test && <Badge variant="outline">test</Badge>}
                    <Badge variant="outline">{ev.routing_source === "mapped" ? "custom mapping" : ev.routing_source}</Badge>
                    <span className="text-muted-foreground">
                      {pipelineName ?? "—"} · {stageName ?? "—"}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2 text-[11px]">
                    {ev.error && <p className="text-destructive">{ev.error}</p>}
                    <p className="text-muted-foreground">
                      lead {ev.leadgen_id ?? "—"} · contact {ev.contact_id ?? "—"} · opportunity {ev.deal_id ?? "—"}
                    </p>
                    <div>
                      <p className="text-muted-foreground mb-1">Lead fields</p>
                      <pre className="overflow-auto rounded bg-background p-2">{JSON.stringify(ev.lead_fields, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Webhook payload</p>
                      <pre className="overflow-auto rounded bg-background p-2">{JSON.stringify(ev.payload, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

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
