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
import { useTenancy } from "@/lib/tenancy";
import {
  User,
  Phone,
  MessageSquare,
  Heart,
  StickyNote,
  CheckSquare,
  CalendarDays,
} from "lucide-react";

function formatMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

export function KanbanBoard({
  stages,
  deals,
  onMove,
  onOpenDeal,
}: {
  stages: Stage[];
  deals: Deal[];
  onMove: (dealId: string, stageId: string, position: number) => void;
  onOpenDeal?: (dealId: string) => void;
}) {

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const subId = useTenancy((s) => s.currentSubAccountId);
  const contactsQuery = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });
  const contactsById = useMemo(() => {
    const m = new Map<string, Contact>();
    (contactsQuery.data ?? []).forEach((c: Contact) => m.set(c.id, c));
    return m;
  }, [contactsQuery.data]);

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
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        contact={deal.contact_id ? contactsById.get(deal.contact_id) ?? null : null}
                        onOpen={onOpenDeal}
                      />

                    ))}
                  </div>
                )}

              </SortableContext>
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <DealCardView
            deal={activeDeal}
            dragging
            contact={activeDeal.contact_id ? contactsById.get(activeDeal.contact_id) ?? null : null}
          />
        ) : null}
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
    <div className="flex w-72 flex-col">
      <div
        className="sticky top-0 z-10 mb-3 rounded-lg border border-border bg-card/85 px-2.5 py-2 backdrop-blur-sm"
        style={{ borderTopColor: stage.color, borderTopWidth: 2 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: stage.color }} />
            <h3 className="truncate font-display text-[11px] font-bold uppercase tracking-widest">
              {stage.name}
            </h3>
            <span className="rounded bg-secondary px-1.5 font-mono text-[10px] tabular-nums">
              {String(count).padStart(2, "0")}
            </span>
          </div>
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatMoney(total)}
          </div>
        </div>
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

function DealCard({
  deal,
  contact,
  onOpen,
}: {
  deal: Deal;
  contact: Contact | null;
  onOpen?: (dealId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(deal.id)}
    >
      <DealCardView deal={deal} contact={contact} onOpen={() => onOpen?.(deal.id)} />
    </div>
  );
}



function contactLabel(c: Contact) {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.company || "Contact"
  );
}

function DealCardView({
  deal,
  dragging,
  contact,
  onOpen,
}: {
  deal: Deal;
  dragging?: boolean;
  contact?: Contact | null;
  onOpen?: () => void;
}) {
  const source = contact?.lead_source ?? "—";
  const business = contact?.company ?? "—";
  const phone = contact?.phone ?? null;
  const email = contact?.email ?? null;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };
  const act = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  const iconBtn =
    "size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors";

  return (
    <div
      className={`bg-card p-3.5 rounded-xl ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing ${
        dragging ? "shadow-lg ring-accent/40" : "hover:ring-accent/40"
      } transition-all`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold leading-snug flex-1">{deal.title}</h4>
        <div
          className="size-7 rounded-full border border-border flex items-center justify-center text-muted-foreground shrink-0"
          title={contact ? contactLabel(contact) : "No contact"}
        >
          <User className="size-3.5" />
        </div>
      </div>

      <dl className="space-y-1.5 text-xs mb-3">
        <div className="grid grid-cols-[92px_1fr] gap-2">
          <dt className="text-muted-foreground">Business name:</dt>
          <dd className="text-foreground truncate">{business}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-2">
          <dt className="text-muted-foreground">Phone:</dt>
          <dd className="text-foreground truncate">{phone ?? "—"}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-2">
          <dt className="text-muted-foreground">Email:</dt>
          <dd className="text-foreground truncate">{email ?? "—"}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-2">
          <dt className="text-muted-foreground">Source:</dt>
          <dd className="text-foreground truncate">{source}</dd>
        </div>

        <div className="grid grid-cols-[92px_1fr] gap-2">
          <dt className="text-muted-foreground">Value:</dt>
          <dd className="font-medium text-foreground">
            ${Number(deal.value).toLocaleString()}
          </dd>
        </div>
      </dl>

      <div
        className="flex items-center gap-1 pt-2 border-t border-border/60"
        onPointerDown={stop}
      >
        <a
          href={phone ? `tel:${phone}` : undefined}
          onClick={phone ? stop : (e) => act(e, () => onOpen?.())}
          aria-disabled={!phone}
          title={phone ? `Call ${phone}` : "No phone on contact"}
          className={iconBtn}
        >
          <Phone className="size-3.5" />
        </a>
        <a
          href={email ? `mailto:${email}` : phone ? `sms:${phone}` : undefined}
          onClick={email || phone ? stop : (e) => act(e, () => onOpen?.())}
          aria-disabled={!email && !phone}
          title={email ? `Email ${email}` : phone ? `Text ${phone}` : "No contact info"}
          className={iconBtn}
        >
          <MessageSquare className="size-3.5" />
        </a>
        <button
          type="button"
          onClick={(e) => act(e, () => onOpen?.())}
          title="Open deal"
          className={iconBtn}
        >
          <Heart className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => act(e, () => onOpen?.())}
          title="Notes"
          className={iconBtn}
        >
          <StickyNote className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => act(e, () => onOpen?.())}
          title="Tasks"
          className={iconBtn}
        >
          <CheckSquare className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => act(e, () => onOpen?.())}
          title="Schedule"
          className={iconBtn}
        >
          <CalendarDays className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

