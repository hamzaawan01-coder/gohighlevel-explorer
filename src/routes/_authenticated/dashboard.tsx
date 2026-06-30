import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Users,
  Calendar,
  MessageSquare,
  Workflow,
  Settings,
  Search,
  Bell,
  ChevronsUpDown,
  Plus,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureDefaultPipeline,
  fetchBoard,
  createDeal,
  moveDeal,
  type Deal,
} from "@/lib/pipeline";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NewDealDialog } from "@/components/NewDealDialog";
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

type NavItem = { label: string; icon: React.ComponentType<{ className?: string }>; active?: boolean };

const salesNav: NavItem[] = [
  { label: "Pipelines", icon: LayoutGrid, active: true },
  { label: "Contacts", icon: Users },
  { label: "Calendar", icon: Calendar },
  { label: "Conversations", icon: MessageSquare },
];

const automationNav: NavItem[] = [
  { label: "Workflows", icon: Workflow },
  { label: "Settings", icon: Settings },
];

function Dashboard() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pipelineQuery = useQuery({
    queryKey: ["pipeline", userId],
    enabled: !!userId,
    queryFn: () => ensureDefaultPipeline(userId!),
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
    mutationFn: async (input: { title: string; value: number; stage_id: string }) => {
      if (!userId || !pipelineId) throw new Error("Not ready");
      return createDeal({
        ...input,
        pipeline_id: pipelineId,
        owner_id: userId,
      });
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
    () => [...deals].sort((a, b) => b.position - a.position).slice(0, 4),
    [deals],
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <button className="w-full flex items-center gap-3 px-2 py-1.5 bg-card ring-1 ring-black/5 rounded-md hover:bg-card/80 transition-colors text-left">
            <div className="size-6 bg-accent rounded flex items-center justify-center text-[10px] text-accent-foreground font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">Agency Engine</p>
              <p className="text-[10px] text-muted-foreground truncate">Workspace: Global</p>
            </div>
            <ChevronsUpDown className="size-3 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <NavGroup label="Sales" items={salesNav} />
          <NavGroup label="Automations" items={automationNav} />
        </nav>

        <div className="p-4 border-t border-border">
          <UserMenu />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-full max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search records…"
                className="w-full bg-secondary border border-border rounded-md py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground bg-card border border-border rounded px-1.5 py-0.5">
                /
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2 bg-accent rounded-full animate-pulse" />
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                {totalDeals} deals
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <button className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
              <Bell className="size-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setNewDealOpen(true)}
              disabled={!stages.length}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              New Deal
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-xs">Loading your pipeline…</span>
            </div>
          ) : (
            <KanbanBoard
              stages={stages}
              deals={deals}
              onMove={(dealId, stageId, position) =>
                moveMut.mutate({ dealId, stageId, position })
              }
            />
          )}
        </div>
      </main>

      <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
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
      </aside>

      <NewDealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        stages={stages}
        onCreate={async (input) => {
          await createDealMut.mutateAsync(input);
        }}
      />
    </div>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      setName((u.user_metadata?.full_name as string) ?? u.email?.split("@")[0] ?? "User");
    });
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (name || email || "U")
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-2">
      <div className="size-8 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center text-[10px] font-semibold text-accent-foreground">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{name || "Operator"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{email}</p>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="px-3 mb-4">
      <p className="px-3 mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href="#"
              className={
                item.active
                  ? "flex items-center gap-3 px-3 py-1.5 text-sm font-medium rounded-md bg-sidebar-accent text-sidebar-accent-foreground"
                  : "flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 rounded-md transition-colors"
              }
            >
              <Icon className="size-3.5" />
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
