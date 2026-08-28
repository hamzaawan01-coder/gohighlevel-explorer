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
  ShieldCheck,
  Palette,
  Sun,
  Moon,
  Rows3,
  Rows4,
  PanelLeftClose,
  PanelLeftOpen,
  Users2,
  Clock,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SubAccountSwitcher } from "@/components/SubAccountSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { Compass } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";
import { CommandPalette } from "@/components/CommandPalette";
import { Softphone } from "@/components/Softphone";
import { isModuleEnabled, moduleForPath, useModules } from "@/lib/modules";
import { SiteFooter } from "@/components/SiteFooter";
import { useAppearance } from "@/lib/appearance";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/SidebarNav";

function openPalette() {
  (window as unknown as { __openPalette?: () => void }).__openPalette?.();
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useGlobalShortcuts();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentModule = moduleForPath(pathname);
  const blocked =
    !modulesLoading &&
    !!currentModule &&
    !isModuleEnabled(state, currentModule.key) &&
    !pathname.startsWith("/settings/modules");

  const sidebar = (isCollapsed: boolean) => (
    <>
      <div className={`border-b border-border ${isCollapsed ? "p-2" : "p-4"}`}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <span className="gradient-primary flex size-9 items-center justify-center rounded-lg text-[11px] font-bold text-primary-foreground">
              AE
            </span>
          </div>
        ) : (
          <SubAccountSwitcher />
        )}
      </div>

      <SidebarNav collapsed={isCollapsed} />


      <div className={`border-t border-border ${isCollapsed ? "p-2" : "p-3"}`}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mb-2 hidden w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={isCollapsed}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <>
              <PanelLeftClose className="size-3.5" />
              Collapse
            </>
          )}
        </button>
        <UserMenu collapsed={isCollapsed} />
      </div>
    </>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[4.25rem]" : "w-64"
        }`}
      >
        {sidebar(collapsed)}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[17rem] flex-col gap-0 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebar(false)}
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:gap-4 sm:px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <Menu className="size-4" />
            </button>
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search contacts, deals and tasks"
              className="relative hidden w-full max-w-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <span className="block w-full rounded-md border border-border bg-secondary py-1.5 pl-9 pr-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/70">
                Search contacts, deals, tasks…
              </span>
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search"
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
            >
              <Search className="size-4" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {headerStatus}
            <AppearanceQuickToggles />
            <div className="hidden h-4 w-px bg-border sm:block" />
            <NotificationBell />
            {headerActions}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {blocked ? <ModuleDisabled label={currentModule!.label} /> : children}
        </div>
        <SiteFooter />
      </main>

      {rightPane && !blocked ? (
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card xl:flex">
          {rightPane}
        </aside>
      ) : null}
      <CommandPalette />
      <Softphone />
      <OnboardingTour />
      <ShortcutsDialog />
    </div>
  );
}

/**
 * Keyboard-first navigation: `g` then a letter jumps between areas, and `/`
 * focuses the page search input (falling back to the command palette).
 */
function useGlobalShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let pendingG = 0;
    const routes: Record<string, string> = {
      d: "/dashboard",
      o: "/opportunities",
      c: "/contacts",
      t: "/tasks",
      i: "/inbox",
      s: "/settings/integrations",
    };
    function isTyping(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "/") {
        const input = document.querySelector<HTMLInputElement>("[data-page-search]");
        e.preventDefault();
        if (input) input.focus();
        else openPalette();
        return;
      }
      if (key === "g") {
        pendingG = Date.now();
        return;
      }
      if (pendingG && Date.now() - pendingG < 1200 && routes[key]) {
        pendingG = 0;
        e.preventDefault();
        navigate({ to: routes[key] });
        return;
      }
      pendingG = 0;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

function AppearanceQuickToggles() {
  const { isDark, density, toggleMode, setDensity } = useAppearance();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleMode}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
        title={density === "compact" ? "Comfortable density" : "Compact density"}
        aria-label="Toggle data density"
        aria-pressed={density === "compact"}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {density === "compact" ? <Rows3 className="size-3.5" /> : <Rows4 className="size-3.5" />}
      </button>
    </div>
  );
}

function ModuleDisabled({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm space-y-3 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-secondary">
          <Ban className="size-4 text-muted-foreground" />
        </div>
        <h2 className="font-display text-sm font-bold">{label} is turned off</h2>
        <p className="text-xs text-muted-foreground">
          This module is disabled for the current workspace. Nothing has been deleted — a workspace
          admin can switch it back on at any time.
        </p>
        <Link
          to="/settings/modules"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <ToggleLeft className="size-3.5" />
          Manage modules
        </Link>
      </div>
    </div>
  );
}

function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
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

  if (collapsed) {
    return (
      <button
        onClick={signOut}
        title={`Sign out ${email}`}
        className="gradient-primary mx-auto flex size-8 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
      >
        {initials}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="gradient-primary flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{name || "Operator"}</p>
        <p className="truncate text-[10px] text-muted-foreground">{email}</p>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
