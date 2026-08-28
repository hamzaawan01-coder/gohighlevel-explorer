import { Link } from "@tanstack/react-router";
import {
  Bot,
  Building2,
  Calendar,
  Clock,
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

const ITEMS: Item[] = [
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
  { label: "Appearance", to: "/settings/appearance", icon: Palette },
  { label: "App review", to: "/settings/app-review", icon: ShieldCheck, module: "integrations" },
];

/**
 * Horizontal, scrollable settings menu shown at the top of every settings
 * screen so people can move between sections without going back to the hub.
 */
export function SettingsNav({ className = "" }: { className?: string }) {
  const { state } = useModules();
  const items = ITEMS.filter((i) => !i.module || isModuleEnabled(state, i.module));

  return (
    <nav
      aria-label="Settings sections"
      className={`-mx-1 mb-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] ${className}`}
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/settings" }}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          activeProps={{
            className:
              "flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-semibold text-foreground",
          }}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
