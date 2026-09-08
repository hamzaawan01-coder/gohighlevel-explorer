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

const DESCRIPTIONS: Record<string, string> = {
  "/settings/profile": "Your name, company details and logo.",
  "/settings/team": "Invite teammates and manage their access.",
  "/settings/sub-accounts": "Create and switch client workspaces.",
  "/settings/modules": "Turn features on or off for this workspace.",
  "/settings/integrations": "Email, SMS and Meta connections plus send history.",
  "/settings/phone-numbers": "Search, buy and manage phone numbers.",
  "/settings/call-flows": "Route inbound calls to people and voicemail.",
  "/settings/messaging": "Control when automated messages may send.",
  "/settings/ai-assistant": "Teach the assistant what to say in draft replies.",
  "/settings/booking": "Booking links, availability and reminders.",
  "/settings/wordpress": "Website form and webhook ingestion.",
  "/settings/subscriptions": "Plans, billing and the customer portal.",
  "/settings/signups": "Review and approve new paid signups.",
  "/settings/invoices": "Invoice numbering, branding and delivery.",
  "/settings/custom-fields": "Currency plus your own extra contact fields.",
  "/settings/appearance": "Theme, palette and data density.",
  "/settings/app-review": "Review readiness and legal URLs.",
};

function SettingsHub() {
  const groups = useSettingsGroups();

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Everything you configure once, grouped in one place."
      />
      <PageBody>
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.label} className="space-y-3">
              <h2 className="eyebrow">{group.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex min-h-[6rem] gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <item.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-bold">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {DESCRIPTIONS[item.to] ?? ""}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-3">
            <h2 className="eyebrow">Reference</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Link
                to="/modules-explorer"
                className="group flex min-h-[6rem] gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Compass className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-bold">Module explorer</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Browse every module with sources and coverage.
                  </span>
                </span>
              </Link>
            </div>
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}
