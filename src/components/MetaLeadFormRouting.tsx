import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMetaLeadFormRoutes,
  setMetaLeadFormRoute,
  replayMetaLeadAdTest,
  listMetaLeadAdEvents,
  importPastMetaLeads,
  retryFailedMetaLeads,
} from "@/lib/meta.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ClipboardList, RefreshCw, PlayCircle, ScrollText, DownloadCloud, RotateCcw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";


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
  const importFn = useServerFn(importPastMetaLeads);
  const retryFn = useServerFn(retryFailedMetaLeads);

  type ImportSummary = {
    total: number; imported: number; skipped: number; failed: number; errors: string[];
    pageName?: string; since?: string | null; until?: string | null;
  };
  type ImportJob = {
    status: "queued" | "running" | "completed" | "failed";
    pageName: string;
    formName: string;
    since: string | null;
    until: string | null;
    summary?: ImportSummary;
    error?: string;
  };
  const [jobs, setJobs] = useState<Record<string, ImportJob>>({});
  const [ranges, setRanges] = useState<Record<string, { since: string; until: string }>>({});
  const rangeFor = (formId: string) => ranges[formId] ?? { since: "", until: "" };
  const setRange = (formId: string, patch: Partial<{ since: string; until: string }>) =>
    setRanges((r) => ({ ...r, [formId]: { ...rangeFor(formId), ...patch } }));
  const presetRange = (formId: string, days: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setRange(formId, { since: start.toISOString().slice(0, 10), until: now.toISOString().slice(0, 10) });
  };

  const importLeads = useMutation({
    mutationFn: async (input: { formId: string; formName?: string | null; pageId?: string | null; since?: string | null; until?: string | null }) => {
      const res = (await importFn({ data: { subAccountId: subId, ...input } })) as ImportSummary;
      return { formId: input.formId, res };
    },
    onMutate: (input) => {
      setJobs((j) => ({
        ...j,
        [input.formId]: {
          status: "running",
          pageName: "",
          formName: input.formName ?? input.formId,
          since: input.since ?? null,
          until: input.until ?? null,
        },
      }));
    },
    onSuccess: ({ formId, res }) => {
      setJobs((j) => ({
        ...j,
        [formId]: { ...(j[formId] as ImportJob), status: "completed", pageName: res.pageName ?? "", summary: res },
      }));
      if (res.total === 0) toast.info("Meta returned no past leads in that window");
      else
        toast.success(
          `Imported ${res.imported} of ${res.total} leads · ${res.skipped} already in CRM${res.failed ? ` · ${res.failed} failed` : ""}`,
        );
      if (res.errors?.length) toast.error(res.errors[0]);
      qc.invalidateQueries({ queryKey: ["meta-lead-ad-events", subId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: Error, input) => {
      setJobs((j) => ({ ...j, [input.formId]: { ...(j[input.formId] as ImportJob), status: "failed", error: e.message } }));
      toast.error(e.message);
    },
  });

  const retryFailed = useMutation({
    mutationFn: (input: { formId?: string | null }) => retryFn({ data: { subAccountId: subId, ...input } }),
    onSuccess: (res: { attempted: number; recovered: number; stillFailing: number; errors: string[] }) => {
      if (res.attempted === 0) toast.info("No failed Lead Ad imports to retry");
      else toast.success(`Retried ${res.attempted} leads · ${res.recovered} recovered · ${res.stillFailing} still failing`);
      if (res.errors?.length) toast.error(res.errors[0]);
      qc.invalidateQueries({ queryKey: ["meta-lead-ad-events", subId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



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
                    disabled={jobs[f.formId]?.status === "running"}
                    onClick={() => {
                      const r = rangeFor(f.formId);
                      if (r.since && r.until && r.since > r.until) {
                        toast.error("The start date must be before the end date");
                        return;
                      }
                      setJobs((j) => ({
                        ...j,
                        [f.formId]: {
                          status: "queued",
                          pageName: f.pageName,
                          formName: f.formName,
                          since: r.since || null,
                          until: r.until || null,
                        },
                      }));
                      importLeads.mutate({
                        formId: f.formId,
                        formName: f.formName,
                        pageId: f.pageId,
                        since: r.since || null,
                        until: r.until || null,
                      });
                    }}
                  >
                    <DownloadCloud className={`size-3.5 mr-1 ${jobs[f.formId]?.status === "running" ? "animate-pulse" : ""}`} />
                    {jobs[f.formId]?.status === "running" ? "Importing…" : "Import past leads"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded border border-border bg-muted/20 p-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Import from</label>
                  <Input
                    type="date"
                    className="h-9 w-[150px] text-xs"
                    value={rangeFor(f.formId).since}
                    onChange={(e) => setRange(f.formId, { since: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Import to</label>
                  <Input
                    type="date"
                    className="h-9 w-[150px] text-xs"
                    value={rangeFor(f.formId).until}
                    onChange={(e) => setRange(f.formId, { until: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {[7, 30, 90].map((d) => (
                    <Button key={d} size="sm" variant="ghost" className="text-[11px]" onClick={() => presetRange(f.formId, d)}>
                      Last {d}d
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[11px]"
                    onClick={() => setRange(f.formId, { since: "", until: "" })}
                  >
                    All time
                  </Button>
                </div>
              </div>

              {jobs[f.formId] && (
                <div className="rounded border border-border p-3 text-[11px] space-y-1">
                  <div className="flex items-center gap-2">
                    {jobs[f.formId]!.status === "completed" ? (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    ) : jobs[f.formId]!.status === "failed" ? (
                      <AlertTriangle className="size-3.5 text-destructive" />
                    ) : jobs[f.formId]!.status === "running" ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Clock className="size-3.5" />
                    )}
                    <span className="font-medium capitalize">{jobs[f.formId]!.status}</span>
                    <span className="text-muted-foreground">
                      {jobs[f.formId]!.pageName || f.pageName} · {jobs[f.formId]!.formName}
                      {" · "}
                      {jobs[f.formId]!.since || jobs[f.formId]!.until
                        ? `${jobs[f.formId]!.since ?? "start"} → ${jobs[f.formId]!.until ?? "today"}`
                        : "all time"}
                    </span>
                  </div>
                  {jobs[f.formId]!.status === "completed" && jobs[f.formId]!.summary && (
                    <p className="text-muted-foreground">
                      {jobs[f.formId]!.summary!.total} found · {jobs[f.formId]!.summary!.imported} imported ·{" "}
                      {jobs[f.formId]!.summary!.skipped} already in CRM · {jobs[f.formId]!.summary!.failed} failed
                    </p>
                  )}
                  {jobs[f.formId]!.status === "failed" && <p className="text-destructive">{jobs[f.formId]!.error}</p>}
                  {(jobs[f.formId]!.summary?.failed ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] mt-1"
                      disabled={retryFailed.isPending}
                      onClick={() => retryFailed.mutate({ formId: f.formId })}
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Retry failed leads
                    </Button>
                  )}
                </div>
              )}


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
