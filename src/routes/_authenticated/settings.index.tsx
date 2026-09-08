import { AppShell } from "@/components/AppShell";
import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Palette,
  Phone,
  PhoneCall,
  Settings as SettingsIcon,
  Webhook,
  Clock,
  Users2,
  ShieldCheck,
  ToggleLeft,
  Compass,
  Building2,
  Bot,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { isModuleEnabled, useModules } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "Workspace settings | Click Away CRM" },
      {
        name: "description",
        content:
          "Configure channels, phone numbers, integrations, team access and modules for your Click Away CRM workspace.",
      },
      { property: "og:title", content: "Workspace settings | Click Away CRM" },
      {
        property: "og:description",
        content: "One hub for channels, phone numbers, integrations, team access and module toggles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsHub,
});

type Tile = {
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
};

const GROUPS: { label: string; tiles: Tile[] }[] = [
  {
    label: "Channels",
    tiles: [
      {
        label: "Integrations",
        description: "Email, SMS and Meta connections plus send history.",
        to: "/settings/integrations",
        icon: SettingsIcon,
        module: "integrations",
      },
      {
        label: "Phone numbers",
        description: "Search, buy and manage Twilio numbers.",
        to: "/settings/phone-numbers",
        icon: Phone,
        module: "calls",
      },
      {
        label: "Call flows",
        description: "Route inbound calls to people and voicemail.",
        to: "/settings/call-flows",
        icon: PhoneCall,
        module: "calls",
      },
      {
        label: "Quiet hours",
        description: "Control when automated messages may send.",
        to: "/settings/messaging",
        icon: Clock,
        module: "integrations",
      },
      {
        label: "WordPress",
        description: "Website form and webhook ingestion.",
        to: "/settings/wordpress",
        icon: Webhook,
        module: "integrations",
      },
      {
        label: "AI reply assistant",
        description: "Teach the AI what to say when drafting customer replies.",
        to: "/settings/ai-assistant",
        icon: Bot,
        module: "conversations",
      },
    ],
  },
  {
    label: "Workspace",
    tiles: [
      {
        label: "Team",
        description: "Invite teammates and manage their access.",
        to: "/settings/team",
        icon: Users2,
      },
      {
        label: "Sub-accounts",
        description: "Create and switch client workspaces.",
        to: "/settings/sub-accounts",
        icon: Building2,
      },
      {
        label: "Modules",
        description: "Turn features on or off for this workspace.",
        to: "/settings/modules",
        icon: ToggleLeft,
      },
      {
        label: "Appearance",
        description: "Theme, palette and data density.",
        to: "/settings/appearance",
        icon: Palette,
      },
    ],
  },
  {
    label: "Reference",
    tiles: [
      {
        label: "App review",
        description: "Meta review readiness and legal URLs.",
        to: "/settings/app-review",
        icon: ShieldCheck,
        module: "integrations",
      },
      {
        label: "Module explorer",
        description: "Browse every module with sources and coverage.",
        to: "/modules-explorer",
        icon: Compass,
      },
    ],
  },
];

function SettingsHub() {
  const { state } = useModules();

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Everything you configure once, grouped in one place."
      />
      <PageBody>
        <SettingsShell>
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const tiles = group.tiles.filter((t) => !t.module || isModuleEnabled(state, t.module));
            if (tiles.length === 0) return null;
            return (
              <section key={group.label} className="space-y-3">
                <h2 className="eyebrow">{group.label}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {tiles.map((tile) => (
                    <Link
                      key={tile.to}
                      to={tile.to}
                      className="group flex min-h-[5.5rem] gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors group-hover:text-foreground">
                        <tile.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-sm font-bold">{tile.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {tile.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
