import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Calendar,
  ScrollText,
  MessageSquare,
  Workflow,
  Settings,
  CheckSquare,
  BarChart3,
  FileText,
  Receipt,
  Inbox,
  CalendarClock,
  Megaphone,
  PhoneCall,
  Compass,
  ChevronDown,
  ChevronRight,
  Star,
  Search,
  History,
  Pin,
  X,
} from "lucide-react";
import { isModuleEnabled, useModules } from "@/lib/modules";
import { useNavPrefs } from "@/lib/nav-prefs";
import { useNavBadges, type NavBadges } from "@/lib/nav-badges";

export type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  /** Module key gating this item; omit for always-visible items. */
  module?: string;
  /** Which live counter to show next to the item, if any. */
  badge?: keyof NavBadges;
  /** Extra words that should match the sidebar filter. */
  keywords?: string;
};

export type NavSection = { label: string; items: NavItem[] };

/**
 * Day-to-day navigation only. Settings lives behind a single hub entry
 * (`/settings`) so the sidebar stays short and scannable.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Sales",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", module: "dashboard", keywords: "home overview" },
      { label: "Opportunities", icon: LayoutGrid, to: "/opportunities", module: "opportunities", keywords: "deals pipeline kanban" },
      { label: "Contacts", icon: Users, to: "/contacts", module: "contacts", keywords: "people leads customers" },
      { label: "Tasks", icon: CheckSquare, to: "/tasks", module: "tasks", badge: "tasks", keywords: "todo follow up" },
      { label: "Invoices", icon: Receipt, to: "/invoices", module: "invoices", keywords: "billing invoice payments quote" },
      { label: "Reports", icon: BarChart3, to: "/reports", module: "reports", keywords: "analytics metrics" },
      { label: "Attribution", icon: Compass, to: "/attribution", module: "attribution", keywords: "roi roas ad spend source revenue call analytics" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Inbox", icon: Inbox, to: "/inbox", module: "conversations", badge: "inbox", keywords: "messages unread" },
      { label: "Conversations", icon: MessageSquare, to: "/conversations", module: "conversations", keywords: "sms whatsapp chat" },
      { label: "Message delivery", icon: Send, to: "/messaging", module: "conversations", keywords: "textmagic twilio sms status pending sent failed" },

      { label: "Calls", icon: PhoneCall, to: "/calls", module: "calls", keywords: "phone voice history" },
      { label: "Calendar", icon: Calendar, to: "/calendar", module: "calendar", keywords: "appointments bookings" },
      { label: "Appointment log", icon: ScrollText, to: "/appointment-log", module: "calendar", keywords: "audit reschedule reminders history" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Campaigns", icon: Megaphone, to: "/marketing", module: "marketing", keywords: "blast broadcast" },
      { label: "Workflows", icon: Workflow, to: "/workflows", module: "workflows", keywords: "automation triggers" },
      { label: "Templates", icon: FileText, to: "/templates", module: "templates", keywords: "email sms snippets" },
      { label: "Forms", icon: FileText, to: "/forms", module: "forms", keywords: "lead capture" },
      { label: "Booking pages", icon: CalendarClock, to: "/settings/booking", module: "calendar", keywords: "scheduling links" },
    ],
  },
];

/** Items reachable from the settings hub — used for filtering and pinning. */
export const SETTINGS_ITEMS: NavItem[] = [
  { label: "Settings", icon: Settings, to: "/settings", keywords: "configuration preferences admin" },
  { label: "Module explorer", icon: Compass, to: "/modules-explorer", keywords: "features catalog" },
];

const ALL_ITEMS: NavItem[] = [...NAV_SECTIONS.flatMap((s) => s.items), ...SETTINGS_ITEMS];

/**
 * A nav row is active for its own path and any nested path beneath it, so the
 * left menu keeps highlighting the section while you browse inside it. The
 * longest matching entry wins, so `/settings/booking` highlights "Booking
 * pages" rather than the generic "Settings" hub row.
 */
export function isNavActive(pathname: string, to: string) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const match = (p: string) => clean === p || clean.startsWith(`${p}/`);
  if (!match(to)) return false;
  const better = ALL_ITEMS.some((i) => i.to !== to && i.to.startsWith(to) && match(i.to));
  return !better;
}

function matches(item: NavItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(q);
}

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useModules();
  const badges = useNavBadges();
  const { pinned, recents, groups, setGroupOpen, pushRecent, markInboxSeen } = useNavPrefs();
  const [query, setQuery] = useState("");

  // Track visited pages and clear the Inbox badge once the Inbox is opened.
  useEffect(() => {
    if (ALL_ITEMS.some((i) => i.to === pathname)) pushRecent(pathname);
    if (pathname === "/inbox") markInboxSeen();
  }, [pathname, pushRecent, markInboxSeen]);

  const allowed = (item: NavItem) => !item.module || isModuleEnabled(state, item.module);

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((i) => allowed(i) && matches(i, query)),
      })).filter((s) => s.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, query],
  );

  const pinnedItems = pinned
    .map((p) => ALL_ITEMS.find((i) => i.to === p))
    .filter((i): i is NavItem => !!i && allowed(i) && matches(i, query));

  const recentItems = recents
    .filter((p) => !pinned.includes(p) && p !== pathname)
    .map((p) => ALL_ITEMS.find((i) => i.to === p))
    .filter((i): i is NavItem => !!i && allowed(i))
    .slice(0, 3);

  const settingsItems = SETTINGS_ITEMS.filter((i) => matches(i, query));
  const nothingFound =
    !!query.trim() && sections.length === 0 && pinnedItems.length === 0 && settingsItems.length === 0;

  if (collapsed) {
    return (
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3">
        {pinnedItems.length > 0 ? (
          <NavRailGroup label="Pinned" items={pinnedItems} badges={badges} pathname={pathname} />
        ) : null}
        {sections.map((section) => (
          <NavRailGroup
            key={section.label}
            label={section.label}
            items={section.items}
            badges={badges}
            pathname={pathname}
          />
        ))}
        <NavRailGroup label="Configure" items={SETTINGS_ITEMS} badges={badges} pathname={pathname} />
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            aria-label="Filter navigation"
            placeholder="Filter menu…"
            className="w-full rounded-md border border-border bg-secondary/60 py-1.5 pl-8 pr-7 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear navigation filter"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {pinnedItems.length > 0 ? (
          <NavGroup
            label="Pinned"
            icon={Pin}
            items={pinnedItems}
            badges={badges}
            pathname={pathname}
            open={groups["Pinned"] ?? true}
            onOpenChange={(o) => setGroupOpen("Pinned", o)}
          />
        ) : null}

        {!query && recentItems.length > 0 ? (
          <NavGroup
            label="Recent"
            icon={History}
            items={recentItems}
            badges={badges}
            pathname={pathname}
            open={groups["Recent"] ?? false}
            onOpenChange={(o) => setGroupOpen("Recent", o)}
          />
        ) : null}

        {sections.map((section) => {
          const hasActive = section.items.some((i) => isNavActive(pathname, i.to));
          const open = query.trim() ? true : (groups[section.label] ?? hasActive);
          return (
            <NavGroup
              key={section.label}
              label={section.label}
              items={section.items}
              badges={badges}
              pathname={pathname}
              open={open}
              onOpenChange={(o) => setGroupOpen(section.label, o)}
            />
          );
        })}

        {nothingFound ? (
          <p className="px-6 py-4 text-xs text-muted-foreground">
            No menu items match “{query}”.
          </p>
        ) : null}
      </div>

      {settingsItems.length > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <div className="space-y-0.5">
            {settingsItems.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                active={isNavActive(pathname, item.to)}
                badges={badges}
              />
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavRow({
  item,
  active,
  badges,
}: {
  item: NavItem;
  active: boolean;
  badges: NavBadges;
}) {
  const { pinned, togglePin } = useNavPrefs();
  const isPinned = pinned.includes(item.to);
  const Icon = item.icon;
  const count = item.badge ? badges[item.badge] : 0;

  return (
    <div className="group/nav relative flex items-center">
      <Link
        to={item.to}
        className={[
          "flex min-w-0 flex-1 items-center gap-3 rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
        ].join(" ")}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary"
          />
        ) : null}
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{item.label}</span>
        <Badge count={count} />
      </Link>
      <button
        type="button"
        onClick={() => togglePin(item.to)}
        aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
        aria-pressed={isPinned}
        className={[
          "ml-0.5 flex size-6 shrink-0 items-center justify-center rounded transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isPinned
            ? "text-primary opacity-100"
            : "text-muted-foreground opacity-0 hover:text-foreground group-hover/nav:opacity-100",
        ].join(" ")}
      >
        <Star className={`size-3 ${isPinned ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}

function NavGroup({
  label,
  icon: GroupIcon,
  items,
  badges,
  pathname,
  open,
  onOpenChange,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  badges: NavBadges;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groupCount = items.reduce((sum, i) => sum + (i.badge ? badges[i.badge] : 0), 0);
  return (
    <div className="mb-3 px-3">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded px-3 py-1 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        {GroupIcon ? <GroupIcon className="size-3 shrink-0 text-muted-foreground" /> : null}
        <span className="eyebrow">{label}</span>
        {!open ? <Badge count={groupCount} /> : null}
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavRow
              key={`${label}-${item.to}`}
              item={item}
              active={isNavActive(pathname, item.to)}
              badges={badges}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Collapsed rail: icon-only column where hovering (or focusing) a group opens a
 * flyout with the full labels, so the collapsed sidebar stays navigable.
 */
function NavRailGroup({
  label,
  items,
  badges,
  pathname,
}: {
  label: string;
  items: NavItem[];
  badges: NavBadges;
  pathname: string;
}) {
  return (
    <div className="group/rail relative mb-3 px-2">
      <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.to);
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={[
                "relative flex items-center justify-center rounded-md px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="size-4" />
              {count > 0 ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="pointer-events-none absolute left-full top-0 z-50 hidden pl-2 group-hover/rail:block group-focus-within/rail:block lg:block lg:opacity-0 lg:transition-opacity group-hover/rail:lg:opacity-100 group-focus-within/rail:lg:opacity-100">
        <div className="pointer-events-auto w-52 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <p className="mb-1 px-2 eyebrow">{label}</p>
          <div className="space-y-0.5">
            {items.map((item) => {
              const active = isNavActive(pathname, item.to);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <Link
                  key={`fly-${item.to}`}
                  to={item.to}
                  className={[
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  ].join(" ")}
                >
                  <item.icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <Badge count={count} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
