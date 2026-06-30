import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
};

const salesNav: NavItem[] = [
  { label: "Pipelines", icon: LayoutGrid, to: "/dashboard" },
  { label: "Contacts", icon: Users, to: "/contacts" },
  { label: "Calendar", icon: Calendar, to: "/calendar" },
  { label: "Conversations", icon: MessageSquare, to: "/conversations" },
];

const automationNav: NavItem[] = [
  { label: "Workflows", icon: Workflow, to: "/workflows" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

export function AppShell({
  children,
  rightPane,
  headerStatus,
  headerActions,
}: {
  children: ReactNode;
  rightPane?: ReactNode;
  headerStatus?: ReactNode;
  headerActions?: ReactNode;
}) {
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
            {headerStatus}
            <div className="h-4 w-px bg-border" />
            <button className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
              <Bell className="size-3.5 text-muted-foreground" />
            </button>
            {headerActions}
          </div>
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>

      {rightPane ? (
        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">{rightPane}</aside>
      ) : null}
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="px-3 mb-4">
      <p className="px-3 mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={
                active
                  ? "flex items-center gap-3 px-3 py-1.5 text-sm font-medium rounded-md bg-sidebar-accent text-sidebar-accent-foreground"
                  : "flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 rounded-md transition-colors"
              }
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
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
