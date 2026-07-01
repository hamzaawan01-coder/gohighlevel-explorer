import { useState } from "react";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPipeline,
  createStage,
  deletePipeline,
  deleteStage,
  listPipelines,
  renamePipeline,
  reorderStages,
  updateStage,
  fetchBoard,
  type Pipeline,
  type Stage,
} from "@/lib/pipeline";
import { toast } from "sonner";

export type PipelinesManagerPanelProps = {
  subAccountId: string;
  userId: string;
  activePipelineId: string | null;
  onSelectPipeline: (id: string) => void;
  className?: string;
};

export function PipelinesManagerPanel({
  subAccountId,
  userId,
  activePipelineId,
  onSelectPipeline,
  className,
}: PipelinesManagerPanelProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(activePipelineId);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageName, setNewStageName] = useState("");

  const pipelinesQ = useQuery({
    queryKey: ["pipelines", subAccountId],
    enabled: !!subAccountId,
    queryFn: () => listPipelines(subAccountId),
  });

  const currentId = selectedId ?? activePipelineId ?? pipelinesQ.data?.[0]?.id ?? null;

  const boardQ = useQuery({
    queryKey: ["board", currentId],
    enabled: !!currentId,
    queryFn: () => fetchBoard(currentId!),
  });
  const stages: Stage[] = boardQ.data?.stages ?? [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["pipelines", subAccountId] });
    if (currentId) qc.invalidateQueries({ queryKey: ["board", currentId] });
  };

  const createPipelineMut = useMutation({
    mutationFn: (name: string) => createPipeline({ name, userId, subAccountId }),
    onSuccess: (p: Pipeline) => {
      setNewPipelineName("");
      setSelectedId(p.id);
      onSelectPipeline(p.id);
      invalidateAll();
      toast.success("Pipeline created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamePipeline(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines", subAccountId] });
      toast.success("Renamed");
    },
  });

  const deletePipelineMut = useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    onSuccess: () => {
      const remaining = (pipelinesQ.data ?? []).filter((p) => p.id !== currentId);
      const next = remaining[0]?.id ?? null;
      setSelectedId(next);
      if (next) onSelectPipeline(next);
      invalidateAll();
      toast.success("Pipeline deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createStageMut = useMutation({
    mutationFn: (name: string) =>
      createStage({
        pipeline_id: currentId!,
        sub_account_id: subAccountId,
        owner_id: userId,
        name,
        position: stages.length,
      }),
    onSuccess: () => {
      setNewStageName("");
      qc.invalidateQueries({ queryKey: ["board", currentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStageMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Stage> }) => updateStage(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", currentId] }),
  });

  const deleteStageMut = useMutation({
    mutationFn: (id: string) => deleteStage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", currentId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: (items: { id: string; position: number }[]) => reorderStages(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", currentId] }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= stages.length) return;
    const a = stages[idx];
    const b = stages[other];
    reorderMut.mutate([
      { id: a.id, position: b.position },
      { id: b.id, position: a.position },
    ]);
  };

  const pipelines = pipelinesQ.data ?? [];
  const current = pipelines.find((p) => p.id === currentId) ?? null;

  return (
    <div className={`grid grid-cols-[240px_1fr] min-h-[440px] border border-border rounded-lg bg-card overflow-hidden ${className ?? ""}`}>
      {/* Pipelines list */}
      <div className="border-r border-border p-3 flex flex-col gap-2">
        <p className="px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Pipelines
        </p>
        {pipelinesQ.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedId(p.id);
                onSelectPipeline(p.id);
              }}
              className={`text-left text-xs px-2 py-1.5 rounded ${
                p.id === currentId
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              {p.name}
            </button>
          ))
        )}
        <div className="mt-auto pt-2 border-t border-border flex gap-1">
          <Input
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="New pipeline"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="h-7 px-2"
            disabled={!newPipelineName.trim() || createPipelineMut.isPending}
            onClick={() => createPipelineMut.mutate(newPipelineName.trim())}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      {/* Detail */}
      <div className="p-4 flex flex-col gap-3">
        {!current ? (
          <div className="text-xs text-muted-foreground">Select or create a pipeline.</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                defaultValue={current.name}
                key={current.id}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== current.name) renameMut.mutate({ id: current.id, name: v });
                }}
                className="h-8 text-sm font-medium"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  if (confirm(`Delete "${current.name}" and all its deals?`))
                    deletePipelineMut.mutate(current.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                Stages
              </p>
              <div className="space-y-1.5">
                {stages.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={s.color}
                      onBlur={(e) =>
                        e.target.value !== s.color &&
                        updateStageMut.mutate({ id: s.id, patch: { color: e.target.value } })
                      }
                      className="size-7 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      defaultValue={s.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== s.name)
                          updateStageMut.mutate({ id: s.id, patch: { name: v } });
                      }}
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="size-7 rounded hover:bg-secondary flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === stages.length - 1}
                      className="size-7 rounded hover:bg-secondary flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete stage "${s.name}"? Its deals must be moved first.`))
                          deleteStageMut.mutate(s.id);
                      }}
                      className="size-7 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-2">
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="New stage"
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 px-2"
                  disabled={!newStageName.trim() || createStageMut.isPending}
                  onClick={() => createStageMut.mutate(newStageName.trim())}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
