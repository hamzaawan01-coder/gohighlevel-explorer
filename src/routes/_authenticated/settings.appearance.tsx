import { SettingsShell } from "@/components/SettingsNav";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Monitor, Moon, Palette, Rows3, Rows4, Sun } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { PALETTES, useAppearance, type ModeKey } from "@/lib/appearance";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Appearance — Lead Convert" },
      {
        name: "description",
        content: "Choose your colour theme, light or dark mode, and table density for the CRM.",
      },
      { property: "og:title", content: "Appearance settings" },
      {
        property: "og:description",
        content: "Pick a colour palette, switch light/dark mode, and set data density.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppearancePage,
});

const MODES: { key: ModeKey; label: string; icon: typeof Sun; hint: string }[] = [
  { key: "light", label: "Light", icon: Sun, hint: "Bright surfaces, best in daylight" },
  { key: "dark", label: "Dark", icon: Moon, hint: "Low-glare, easier at night" },
  { key: "system", label: "System", icon: Monitor, hint: "Follows your device setting" },
];

function AppearancePage() {
  const { palette, mode, density, setPalette, setMode, setDensity, reset } = useAppearance();

  return (
    <AppShell>
      <PageHeader
        title="Appearance"
        description="Pick the colour direction, mode, and information density for this browser. Changes apply instantly and are remembered."
        crumbs={[{ label: "Settings" }, { label: "Appearance" }]}
        actions={
          <Button variant="outline" size="sm" onClick={reset}>
            Reset to defaults
          </Button>
        }
      />
      <PageBody>
        <SettingsShell>
        {/* Palette */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <h2 className="font-display text-sm font-bold">Colour theme</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PALETTES.map((p) => {
              const active = palette === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPalette(p.key)}
                  aria-pressed={active}
                  className={`surface-card group relative overflow-hidden p-4 text-left transition-all hover:elevation-raised ${
                    active ? "ring-2 ring-ring" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.label}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {p.description}
                      </p>
                    </div>
                    {active ? (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex gap-1.5" aria-hidden>
                    {p.swatch.map((c) => (
                      <span
                        key={c}
                        className="h-7 flex-1 rounded-md border border-border"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mode */}
        <section className="space-y-3">
          <h2 className="font-display text-sm font-bold">Light / dark mode</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={active}
                  className={`surface-card flex items-start gap-3 p-4 text-left transition-all hover:elevation-raised ${
                    active ? "ring-2 ring-ring" : ""
                  }`}
                >
                  <Icon className="mt-0.5 size-4 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Density */}
        <section className="space-y-3">
          <h2 className="font-display text-sm font-bold">Data density</h2>
          <p className="text-xs text-muted-foreground">
            Compact fits noticeably more rows on screen — useful for large contact and opportunity
            lists. It applies to tables, lists, and page padding across the app.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                key: "comfortable" as const,
                label: "Comfortable",
                hint: "Roomier rows and padding",
                icon: Rows3,
              },
              {
                key: "compact" as const,
                label: "Compact",
                hint: "Tighter rows, more data per screen",
                icon: Rows4,
              },
            ].map((d) => {
              const Icon = d.icon;
              const active = density === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDensity(d.key)}
                  aria-pressed={active}
                  className={`surface-card flex items-start gap-3 p-4 text-left transition-all hover:elevation-raised ${
                    active ? "ring-2 ring-ring" : ""
                  }`}
                >
                  <Icon className="mt-0.5 size-4 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{d.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{d.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live preview */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border bg-secondary/60 px-3 py-2 eyebrow">
              Density preview
            </div>
            {["Timothew Akinboboye", "Tony Pedler", "Mark Shilton", "Keith Gillies"].map((n) => (
              <div
                key={n}
                className="flex items-center justify-between border-b border-border/70 last:border-0 density-row"
              >
                <span className="font-medium">{n}</span>
                <span className="text-muted-foreground">New Leads</span>
              </div>
            ))}
          </div>
        </section>
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
