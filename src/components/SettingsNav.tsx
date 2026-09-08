import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  CreditCard,
  LayoutGrid,
  Palette,
  Phone,
  Receipt,
  PhoneCall,
  Settings as SettingsIcon,
  ShieldCheck,
  ToggleLeft,
  UserCheck,
  UserCircle,
  Users2,
  Webhook,
  SlidersHorizontal,
} from "lucide-react";
import { isModuleEnabled, useModules } from "@/lib/modules";

type Group = "workspace" | "channels" | "billing" | "advanced";

type Item = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
  group: Group;
};

const GROUP_LABELS: { key: Group; label: string }[] = [
  { key: "workspace", label: "Workspace" },
  { key: "channels", label: "Channels" },
  { key: "billing", label: "Billing" },
  { key: "advanced", label: "Configuration" },
];

export const SETTINGS_NAV_ITEMS: Item[] = [
  { label: "Overview", to: "/settings", icon: LayoutGrid, group: "workspace" },
  { label: "Profile & company", to: "/settings/profile", icon: UserCircle, group: "workspace" },
  { label: "Team", to: "/settings/team", icon: Users2, group: "workspace" },
  { label: "Sub-accounts", to: "/settings/sub-accounts", icon: Building2, group: "workspace" },
  { label: "Modules", to: "/settings/modules", icon: ToggleLeft, group: "workspace" },

  { label: "Integrations", to: "/settings/integrations", icon: SettingsIcon, module: "integrations", group: "channels" },
  { label: "Phone numbers", to: "/settings/phone-numbers", icon: Phone, module: "calls", group: "channels" },
  { label: "Call flows", to: "/settings/call-flows", icon: PhoneCall, module: "calls", group: "channels" },
  { label: "Quiet hours", to: "/settings/messaging", icon: Clock, module: "integrations", group: "channels" },
  { label: "AI assistant", to: "/settings/ai-assistant", icon: Bot, module: "conversations", group: "channels" },
  { label: "Booking pages", to: "/settings/booking", icon: Calendar, module: "calendar", group: "channels" },
  { label: "WordPress", to: "/settings/wordpress", icon: Webhook, module: "integrations", group: "channels" },

  { label: "Subscriptions", to: "/settings/subscriptions", icon: CreditCard, group: "billing" },
  { label: "Signups & approvals", to: "/settings/signups", icon: UserCheck, group: "billing" },
  { label: "Invoice branding", to: "/settings/invoices", icon: Receipt, module: "invoices", group: "billing" },

  { label: "Currency & fields", to: "/settings/custom-fields", icon: SlidersHorizontal, group: "advanced" },
  { label: "Appearance", to: "/settings/appearance", icon: Palette, group: "advanced" },
  { label: "App review", to: "/settings/app-review", icon: ShieldCheck, module: "integrations", group: "advanced" },
];

/** Which settings entry a pathname belongs to (longest prefix wins). */
export function activeSettingsItem(pathname: string) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  let best: Item | undefined;
  for (const item of SETTINGS_NAV_ITEMS) {
    if (clean === item.to || clean.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best;
}

function useVisibleItems() {
  const { state } = useModules();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeSettingsItem(pathname);
  const items = SETTINGS_NAV_ITEMS.filter(
    (i) => !i.module || isModuleEnabled(state, i.module) || i.to === active?.to,
  );
  return { items, active, pathname };
}

/**
 * Grouped vertical settings menu. Every section stays reachable without any
 * sideways scrolling, and the current section is highlighted.
 */
export function SettingsNav({ className = "" }: { className?: string }) {
  const { items, active, pathname } = useVisibleItems();
  const scroller = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    const el = scroller.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const list = (
    <nav ref={scroller} aria-label="Settings sections" className="flex flex-col gap-5">
      {GROUP_LABELS.map((g) => {
        const groupItems = items.filter((i) => i.group === g.key);
        if (groupItems.length === 0) return null;
        return (
          <div key={g.key}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {groupItems.map((item) => {
                const isActive = active?.to === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      data-active={isActive ? "true" : "false"}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "border-l-2 border-primary bg-primary/10 pl-2.5 font-semibold text-foreground"
                          : "font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                      ].join(" ")}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={className}>
      {/* Mobile: collapsible picker so the menu never pushes content off screen */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            {active ? <active.icon className="size-4 text-muted-foreground" /> : null}
            {active?.label ?? "Settings"}
          </span>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? <div className="mt-2 rounded-lg border border-border bg-card p-2">{list}</div> : null}
      </div>

      {/* Desktop: persistent grouped sub-menu */}
      <div className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-border bg-card p-3">
          {list}
        </div>
      </div>
    </div>
  );
}

/**
 * Two-column settings layout: grouped sub-menu on the left, page content on the
 * right. Wrap the body of every settings route in this so they share one shape.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <SettingsNav />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}

/** A titled group of settings rows, matching the shape used across settings. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  padded = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Add inner padding when the children are not SettingsRow items. */
  padded?: boolean;
}) {
  return (
    <section>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="font-display text-base font-semibold">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div
        className={`rounded-xl border border-border bg-card shadow-[var(--shadow-card)] ${
          padded ? "p-5" : "divide-y divide-border"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

/** One label/description on the left, control on the right. */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <label htmlFor={htmlFor} className="block text-sm font-semibold">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
