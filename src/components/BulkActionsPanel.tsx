import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, ArrowRightLeft, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchBoard, moveDeal, deleteDeal, listPipelines } from "@/lib/pipeline";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function BulkActionsPanel({ subAccountId }: { subAccountId: string }) {
  const qc = useQueryClient();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [search, setSearch] = useState("");

  const pipelinesQ = useQuery({
    queryKey: ["pipelines", subAccountId],
    queryFn: () => listPipelines(subAccountId),
    enabled: !!subAccountId,
  });
  const currentPipelineId = pipelineId ?? pipelinesQ.data?.[0]?.id ?? null;

  const boardQ = useQuery({
    queryKey: ["board", currentPipelineId],
    queryFn: () => fetchBoard(currentPipelineId!),
    enabled: !!currentPipelineId,
  });

  const stages = boardQ.data?.stages ?? [];
  const deals = boardQ.data?.deals ?? [];
  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? deals.filter((d) => d.title.toLowerCase().includes(q)) : deals;
  }, [deals, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  };

  const clear = () => setSelected(new Set());

  const moveMut = useMutation({
    mutationFn: async (stageId: string) => {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id, idx) => moveDeal(id, stageId, idx)));
    },
    onSuccess: () => {
      toast.success(`Moved ${selected.size} deals`);
      clear();
      qc.invalidateQueries({ queryKey: ["board", currentPipelineId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id) => deleteDeal(id)));
    },
    onSuccess: () => {
      toast.success(`Deleted ${selected.size} deals`);
      clear();
      qc.invalidateQueries({ queryKey: ["board", currentPipelineId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="grid grid-cols-1 gap-2 p-3 border-b border-border sm:flex sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          <Label htmlFor="bulk-pipeline-select" className="sr-only">Pipeline</Label>
          <Select
            value={currentPipelineId ?? ""}
            onValueChange={(v) => {
              setPipelineId(v);
              clear();
            }}
          >
            <SelectTrigger id="bulk-pipeline-select" className="h-8 w-full text-xs sm:w-[220px]">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {(pipelinesQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="bulk-search" className="sr-only">Search opportunities</Label>
          <Input
            id="bulk-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities"
            data-page-search
            className="h-8 text-xs w-full sm:max-w-xs"
          />
        </div>
        <div aria-live="polite" className="text-xs text-muted-foreground sm:ml-auto">
          {selected.size} selected
        </div>
      </div>

      {selected.size > 0 && (
        <div className="grid grid-cols-1 gap-2 p-2 bg-secondary/60 border-b border-border sm:flex sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightLeft className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-xs shrink-0">Move to</span>
            <Label htmlFor="bulk-move-target" className="sr-only">Target stage</Label>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger id="bulk-move-target" className="h-7 w-full text-xs sm:w-[180px]">
                <SelectValue placeholder="Choose stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-9 sm:h-7"
            disabled={!moveTarget || moveMut.isPending}
            onClick={() => moveMut.mutate(moveTarget)}
          >
            Move
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 sm:h-7 sm:ml-auto text-destructive"
            disabled={deleteMut.isPending}
            onClick={() => {
              if (confirm(`Delete ${selected.size} deals? This cannot be undone.`))
                deleteMut.mutate();
            }}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {boardQ.isLoading ? (
        <div className="p-3">
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : boardQ.isError ? (
        <ErrorState onRetry={() => boardQ.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No opportunities in this pipeline"
          description="Try a different pipeline or clear your search."
        />
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[480px]">
          <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider">
            <tr>
              <th className="w-8 p-2">
                <Checkbox
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all opportunities"
                />
              </th>
              <th className="text-left p-2 font-mono">Title</th>
              <th className="text-left p-2 font-mono">Stage</th>
              <th className="text-right p-2 font-mono">Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const stage = stageById.get(d.stage_id);
              return (
                <tr
                  key={d.id}
                  className="border-t border-border hover:bg-secondary/40"
                >
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(d.id)}
                      onCheckedChange={() => toggle(d.id)}
                      aria-label={`Select ${d.title}`}
                    />
                  </td>
                  <td className="p-2 font-medium">{d.title}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: stage?.color ?? "#64748b" }}
                      />
                      {stage?.name ?? "—"}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">
                    ${Number(d.value).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
