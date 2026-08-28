import type { ComponentType, ReactNode } from "react";

/**
 * Shared "command center" primitives.
 *
 * Every settings / console style page uses the same chrome:
 *   PageHeader (title + StatusPill in `meta`)  →  ConsoleSplit
 *     main:  ConsoleSection cards (the configuration surface)
 *     side:  ConsoleSection cards (health, utilities, guidance)
 */

/** Live-looking status badge used in page headers. */
export function StatusPill({
  ok,
  label,
  tone = "primary",
}: {
  ok: boolean;
  label: string;
  tone?: "primary" | "warning";
}) {
  const onClasses =
    tone === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "border-primary/25 bg-primary/10 text-primary";
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
        ok ? onClasses : "border-border bg-muted/50 text-muted-foreground",
      ].join(" ")}
    >
      <span className="relative flex size-2" aria-hidden>
        {ok ? (
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${
              tone === "warning" ? "bg-amber-500" : "bg-primary"
            }`}
          />
        ) : null}
        <span
          className={`relative inline-flex size-2 rounded-full ${
            ok ? (tone === "warning" ? "bg-amber-500" : "bg-primary") : "bg-muted-foreground/50"
          }`}
        />
      </span>
      {label}
    </span>
  );
}

/** A titled card section. Collapses padding on mobile. */
export function ConsoleSection({
  title,
  hint,
  icon: Icon,
  actions,
  children,
  footer,
  className = "",
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card overflow-hidden ${className}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
              <Icon className="size-3.5 text-primary" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold leading-tight">{title}</h2>
            {hint ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
      {footer ? (
        <div className="border-t border-border bg-secondary/40 px-4 py-3 text-[11px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Two-column console split: primary configuration on the left, utilities and
 * health on the right. Stacks to a single column below `lg`.
 */
export function ConsoleSplit({
  main,
  side,
  sideFirstOnMobile = false,
}: {
  main: ReactNode;
  side?: ReactNode;
  sideFirstOnMobile?: boolean;
}) {
  if (!side) return <div className="flex flex-col gap-4">{main}</div>;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className={`flex min-w-0 flex-col gap-4 ${sideFirstOnMobile ? "order-2 lg:order-1" : ""}`}>
        {main}
      </div>
      <div
        className={`flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 ${
          sideFirstOnMobile ? "order-1 lg:order-2" : ""
        }`}
      >
        {side}
      </div>
    </div>
  );
}

/** Label / value row for the side rail health panels. */
export function ConsoleStat({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "ok" | "warn" | "muted";
}) {
  const valueTone =
    tone === "ok"
      ? "text-primary"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${valueTone}`}>{value}</span>
    </div>
  );
}

/** Short bulleted guidance list for the side rail. */
export function ConsoleTips({ items, title = "Good to know" }: { items: ReactNode[]; title?: string }) {
  return (
    <ConsoleSection title={title}>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </ConsoleSection>
  );
}
