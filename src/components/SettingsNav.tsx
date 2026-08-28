import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  Bot,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  LayoutGrid,
  Palette,
  Phone,
  PhoneCall,
  Settings as SettingsIcon,
  ShieldCheck,
  ToggleLeft,
  Users2,
  Webhook,
} from "lucide-react";
import { isModuleEnabled, useModules } from "@/lib/modules";

type Item = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
};

export const SETTINGS_NAV_ITEMS: Item[] = [
  { label: "Overview", to: "/settings", icon: LayoutGrid },
  { label: "Integrations", to: "/settings/integrations", icon: SettingsIcon, module: "integrations" },
  { label: "Phone numbers", to: "/settings/phone-numbers", icon: Phone, module: "calls" },
  { label: "Call flows", to: "/settings/call-flows", icon: PhoneCall, module: "calls" },
  { label: "Quiet hours", to: "/settings/messaging", icon: Clock, module: "integrations" },
  { label: "WordPress", to: "/settings/wordpress", icon: Webhook, module: "integrations" },
  { label: "AI assistant", to: "/settings/ai-assistant", icon: Bot, module: "conversations" },
  { label: "Booking pages", to: "/settings/booking", icon: Calendar, module: "calendar" },
  { label: "Team", to: "/settings/team", icon: Users2 },
  { label: "Sub-accounts", to: "/settings/sub-accounts", icon: Building2 },
  { label: "Modules", to: "/settings/modules", icon: ToggleLeft },
  { label: "Subscriptions", to: "/settings/subscriptions", icon: CreditCard },
  { label: "Appearance", to: "/settings/appearance", icon: Palette },
  { label: "App review", to: "/settings/app-review", icon: ShieldCheck, module: "integrations" },
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

/**
 * Horizontal, scrollable settings menu shown at the top of every settings
 * screen. The current section is highlighted and scrolled into view, so the
 * menu stays usable on narrow phones where it overflows sideways.
 */
export function SettingsNav({ className = "" }: { className?: string }) {
  const { state } = useModules();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeSettingsItem(pathname);
  const scroller = useRef<HTMLElement | null>(null);

  const items = SETTINGS_NAV_ITEMS.filter(
    (i) => !i.module || isModuleEnabled(state, i.module) || i.to === active?.to,
  );

  // Keep the current section visible when the menu overflows on small screens.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname, items.length]);

  return (
    <nav
      ref={scroller}
      aria-label="Settings sections"
      className={`-mx-1 mb-1 flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] ${className}`}
    >
      {items.map((item) => {
        const isActive = active?.to === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            className={[
              "relative flex shrink-0 snap-start items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-border bg-secondary font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            ].join(" ")}
          >
            <item.icon className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
