import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery } from "@tanstack/react-query";
import type { Deal, Stage } from "@/lib/pipeline";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { User } from "lucide-react";

function formatMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

export function KanbanBoard({
  stages,
  deals,
  onMove,
}: {
  stages: Stage[];
  deals: Deal[];
  onMove: (dealId: string, stageId: string, position: number) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const dealsByStage = useMemo(() => {
    const m = new Map<string, Deal[]>();
    stages.forEach((s) => m.set(s.id, []));
    deals.forEach((d) => {
      const arr = m.get(d.stage_id) ?? [];
      arr.push(d);
      m.set(d.stage_id, arr);
    });
    return m;
  }, [stages, deals]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeDealId = String(active.id);
    const activeDealObj = deals.find((d) => d.id === activeDealId);
    if (!activeDealObj) return;

    const overId = String(over.id);
    const overStage = stages.find((s) => s.id === overId);
    const overDeal = deals.find((d) => d.id === overId);
    const targetStageId = overStage ? overStage.id : overDeal?.stage_id;
    if (!targetStageId) return;

    const target = (dealsByStage.get(targetStageId) ?? []).filter(
      (d) => d.id !== activeDealId,
    );
    let insertIndex = target.length;
    if (overDeal && overDeal.id !== activeDealId) {
      insertIndex = target.findIndex((d) => d.id === overDeal.id);
      if (insertIndex < 0) insertIndex = target.length;
    }
    onMove(activeDealId, targetStageId, insertIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-6 h-full min-w-max">
        {stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? [];
          const total = stageDeals.reduce((s, d) => s + Number(d.value), 0);
          return (
            <Column key={stage.id} stage={stage} count={stageDeals.length} total={total}>
              <SortableContext
                items={stageDeals.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                {stageDeals.length === 0 ? (
                  <EmptyDropzone stageId={stage.id} />
                ) : (
                  <div className="space-y-3 overflow-y-auto pr-1">
                    {stageDeals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} />
                    ))}
                  </div>
                )}
              </SortableContext>
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCardView deal={activeDeal} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  count,
  total,
  children,
}: {
  stage: Stage;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="w-72 flex flex-col">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: stage.color }} />
          <h3 className="text-xs font-bold uppercase tracking-widest">{stage.name}</h3>
          <span className="font-mono text-[10px] bg-secondary px-1.5 rounded">
            {String(count).padStart(2, "0")}
          </span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">{formatMoney(total)}</div>
      </div>
      {children}
    </div>
  );
}

function EmptyDropzone({ stageId }: { stageId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg flex-1 min-h-32 flex items-center justify-center transition-colors ${
        isOver ? "border-accent bg-accent/5" : "border-border"
      }`}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        Drop here
      </span>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCardView deal={deal} />
    </div>
  );
}

function DealCardView({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  return (
    <div
      className={`bg-card p-3 rounded-lg ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing ${
        dragging ? "shadow-lg ring-accent/40" : "hover:ring-accent/40"
      } transition-all`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          #{deal.id.slice(0, 6).toUpperCase()}
        </span>
      </div>
      <h4 className="text-sm font-semibold mb-2">{deal.title}</h4>
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-medium text-accent">
          ${Number(deal.value).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
