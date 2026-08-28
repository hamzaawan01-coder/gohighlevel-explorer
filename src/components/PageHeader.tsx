import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

/**
 * Consistent page chrome: eyebrow breadcrumbs, title, description and actions.
 * Use at the top of every route body so pages read as one system.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  meta,
  sticky = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  /** Small stat chips or status badges rendered under the title. */
  meta?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={[
        "border-b border-border bg-background/85 backdrop-blur-sm",
        sticky ? "sticky top-0 z-20" : "",
      ].join(" ")}
    >
      <div className="density-pad pb-4 pt-4">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 eyebrow">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-2.5 opacity-60" /> : null}
                {c.to ? (
                  <Link to={c.to} className="hover:text-foreground transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-tight md:text-2xl">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
            ) : null}
            {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

/** Small labelled stat chip for use in PageHeader `meta`. */
export function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/** Standard scrollable page body wrapper with density-aware padding. */
export function PageBody({
  children,
  className = "",
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "narrow" | "full";
}) {
  const max = width === "narrow" ? "max-w-3xl" : width === "full" ? "" : "max-w-7xl";
  return (
    <div className={`density-pad ${className}`}>
      <div className={`${max} mx-auto flex flex-col density-gap`}>{children}</div>
    </div>
  );
}
