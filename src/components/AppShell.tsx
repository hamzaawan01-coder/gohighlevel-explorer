import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  Workflow,
  Settings,
  Search,
  LogOut,
  CheckSquare,
  BarChart3,
  FileText,
  Inbox,
  CalendarClock,
  Megaphone,
  Webhook,
  Phone,
  PhoneCall,
  ToggleLeft,
  Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SubAccountSwitcher } from "@/components/SubAccountSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { Softphone } from "@/components/Softphone";
import { isModuleEnabled, moduleForPath, useModules } from "@/lib/modules";
import { SiteFooter } from "@/components/SiteFooter";

function openPalette() {
  (window as unknown as { __openPalette?: () => void }).__openPalette?.();
}

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  /** Module key gating this item; omit for always-visible items. */
  module?: string;
};

const salesNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", module: "dashboard" },
  { label: "Opportunities", icon: LayoutGrid, to: "/opportunities", module: "opportunities" },
  { label: "Contacts", icon: Users, to: "/contacts", module: "contacts" },
  { label: "Tasks", icon: CheckSquare, to: "/tasks", module: "tasks" },
  { label: "Calendar", icon: Calendar, to: "/calendar", module: "calendar" },
  { label: "Conversations", icon: MessageSquare, to: "/conversations", module: "conversations" },
  { label: "Calls", icon: PhoneCall, to: "/calls", module: "calls" },
  { label: "Reports", icon: BarChart3, to: "/reports", module: "reports" },
  { label: "Inbox", icon: Inbox, to: "/inbox", module: "conversations" },
];

const automationNav: NavItem[] = [
  { label: "Marketing", icon: Megaphone, to: "/marketing", module: "marketing" },
  { label: "Workflows", icon: Workflow, to: "/workflows", module: "workflows" },
  { label: "Templates", icon: FileText, to: "/templates", module: "templates" },
  { label: "Forms", icon: FileText, to: "/forms", module: "forms" },
  { label: "WordPress", icon: Webhook, to: "/settings/wordpress", module: "integrations" },
  { label: "Booking pages", icon: CalendarClock, to: "/settings/booking", module: "calendar" },
  { label: "Phone numbers", icon: Phone, to: "/settings/phone-numbers", module: "calls" },
  { label: "Call flows", icon: PhoneCall, to: "/settings/call-flows", module: "calls" },
  { label: "Integrations", icon: Settings, to: "/settings/integrations", module: "integrations" },
  { label: "Quiet hours", icon: Settings, to: "/settings/messaging", module: "integrations" },
  { label: "Modules", icon: ToggleLeft, to: "/settings/modules" },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state, isLoading: modulesLoading } = useModules();
  const visible = (items: NavItem[]) =>
    items.filter((i) => !i.module || isModuleEnabled(state, i.module));

  const currentModule = moduleForPath(pathname);
  const blocked =
    !modulesLoading &&
    !!currentModule &&
    !isModuleEnabled(state, currentModule.key) &&
    !pathname.startsWith("/settings/modules");

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <SubAccountSwitcher />
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <NavGroup label="Sales" items={visible(salesNav)} />
          <NavGroup label="Automations" items={visible(automationNav)} />
        </nav>
        <div className="p-4 border-t border-border">
          <UserMenu />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button
              type="button"
              onClick={openPalette}
              className="w-full max-w-md relative text-left"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <span className="block w-full bg-secondary border border-border rounded-md py-1.5 pl-9 pr-3 text-xs text-muted-foreground hover:bg-secondary/70 transition-colors">
                Search contacts, deals, tasks…
              </span>
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground bg-card border border-border rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-4">
            {headerStatus}
            <div className="h-4 w-px bg-border" />
            <NotificationBell />
            {headerActions}
          </div>
        </header>
        <div className="flex-1 overflow-auto min-h-0">
          {blocked ? <ModuleDisabled label={currentModule!.label} /> : children}
        </div>
        <SiteFooter />
      </main>


      {rightPane && !blocked ? (
        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">{rightPane}</aside>
      ) : null}
      <CommandPalette />
      <Softphone />
    </div>
  );
}

function ModuleDisabled({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center p-10">
      <div className="max-w-sm text-center space-y-3">
        <div className="mx-auto size-10 rounded-full bg-secondary flex items-center justify-center">
          <Ban className="size-4 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-bold">{label} is turned off</h2>
        <p className="text-xs text-muted-foreground">
          This module is disabled for the current workspace. Nothing has been deleted — a workspace
          admin can switch it back on at any time.
        </p>
        <Link
          to="/settings/modules"
          className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
        >
          <ToggleLeft className="size-3.5" />
          Manage modules
        </Link>
      </div>
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
