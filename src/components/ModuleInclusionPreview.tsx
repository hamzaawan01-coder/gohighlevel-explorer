import { ArrowDownRight, ArrowUpRight, Eye, Lock } from "lucide-react";
import { previewPlanModules } from "@/lib/module-preview";

/**
 * Live read-out of exactly which modules and routes a plan selection unlocks.
 * Recomputes on every keystroke/tick of the editor — nothing is saved yet.
 */
export function ModuleInclusionPreview({
  selected,
  baseline,
  title = "What this plan unlocks",
}: {
  selected: string[];
  baseline?: string[] | null;
  title?: string;
}) {
  const preview = previewPlanModules(selected, baseline);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Eye className="size-3.5 text-primary" /> {title}
        </p>
        <span className="text-[11px] text-muted-foreground">
          {preview.unlocked.length} modules · {preview.routes.length} routes
        </span>
      </div>

      {preview.added.length || preview.removed.length ? (
        <div className="flex flex-wrap gap-1.5">
          {preview.added.map((m) => (
            <span
              key={`add-${m.key}`}
              className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
            >
              <ArrowUpRight className="size-3" /> {m.label}
            </span>
          ))}
          {preview.removed.map((m) => (
            <span
              key={`rm-${m.key}`}
              className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
            >
              <ArrowDownRight className="size-3" /> {m.label}
            </span>
          ))}
        </div>
      ) : baseline ? (
        <p className="text-[11px] text-muted-foreground">No change to included modules.</p>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Visible
        </p>
        <div className="flex flex-wrap gap-1">
          {preview.unlocked.map((m) => (
            <span
              key={m.key}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium"
            >
              {m.locked ? <Lock className="size-2.5 text-muted-foreground" /> : null}
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {preview.blocked.length ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Hidden &amp; blocked
          </p>
          <div className="flex flex-wrap gap-1">
            {preview.blocked.map((m) => (
              <span
                key={m.key}
                className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer font-medium">Routes that will work</summary>
        <p className="mt-1 break-words font-mono text-[10px] leading-relaxed">
          {preview.routes.join("  ·  ")}
        </p>
      </details>
    </div>
  );
}
