import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16"
      }`}
    >
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl"
        />
        <div className="relative flex size-11 items-center justify-center rounded-2xl border border-border bg-card">
          <Icon className="size-5 text-primary" />
        </div>
      </div>
      <h3 className="font-display text-sm font-bold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Error state
 * ------------------------------------------------------------------ */
export function ErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  retrying = false,
  compact = false,
}: {
  title?: string;
  description?: ReactNode;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const detail =
    error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14"
      }`}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <h3 className="font-display text-sm font-bold">{title}</h3>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
        {description ?? "We couldn't load this data. Retrying usually fixes it."}
      </p>
      {detail ? (
        <code className="max-w-md truncate rounded border border-border bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">
          {detail}
        </code>
      ) : null}
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="mt-1">
          <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Skeletons
 * ------------------------------------------------------------------ */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer relative overflow-hidden rounded-md bg-secondary ${className}`}
    />
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card space-y-3 p-4">
          <SkeletonBlock className="h-2.5 w-24" />
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-2 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-card overflow-hidden">
      <div
        className="grid gap-4 border-b border-border bg-secondary/50 px-4 py-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-2.5 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border px-4 py-3 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className={c === 0 ? "h-3 w-full" : "h-3 w-2/3"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface-card flex items-center gap-3 p-3">
          <SkeletonBlock className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-2 w-1/5" />
          </div>
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card space-y-3 p-4">
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-2 w-1/3" />
          <SkeletonBlock className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-2.5 w-1/3" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
