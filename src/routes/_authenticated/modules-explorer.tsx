import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Compass,
  Search,
  X,
  ArrowUpDown,
  FileDown,
  FileText,
  ExternalLink,
  CheckCircle2,
  CircleDashed,
  MinusCircle,
  ArrowUpRight,
  ShieldCheck,
  CalendarClock,
  PlayCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { restartTour } from "@/components/OnboardingTour";
import { useQuery } from "@tanstack/react-query";
import { fetchMySubAccounts, useTenancy } from "@/lib/tenancy";
import {
  COVERAGE_LABEL,
  GHL_CATEGORIES,
  GHL_MODULES,
  coverageCounts,
  downloadFile,
  filterAndSortModules,
  modulesToCsv,
  printModulesReport,
  type Coverage,
  type GhlModule,
  type SortKey,
} from "@/lib/ghl-modules";

export const Route = createFileRoute("/_authenticated/modules-explorer")({
  head: () => ({
    meta: [
      { title: "Module Explorer — Agency Engine" },
      {
        name: "description",
        content:
          "Browse every GoHighLevel-style module with category, coverage status, and the source of each piece of information.",
      },
      { property: "og:title", content: "Module Explorer — Agency Engine" },
      {
        property: "og:description",
        content:
          "Browse every GoHighLevel-style module with category, coverage status, and data provenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModuleExplorerPage,
});

const COVERAGES: Coverage[] = ["covered", "partial", "unknown"];

const COVERAGE_STYLE: Record<Coverage, string> = {
  covered: "bg-success/12 text-success",
  partial: "bg-warning/15 text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

const COVERAGE_ICON: Record<Coverage, React.ComponentType<{ className?: string }>> = {
  covered: CheckCircle2,
  partial: MinusCircle,
  unknown: CircleDashed,
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "coverage", label: "Status" },
  { key: "confidence", label: "Confidence" },
  { key: "lastChecked", label: "Last checked" },
];

function ModuleExplorerPage() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const subAccountsQuery = useQuery({ queryKey: ["my-sub-accounts"], queryFn: fetchMySubAccounts });
  const workspace =
    subAccountsQuery.data?.find((s) => s.id === subId)?.name ?? "This workspace";
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [sort, setSort] = useState<SortKey>("category");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<GhlModule | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  const rows = useMemo(
    () => filterAndSortModules({ query, categories, coverages, sort, dir }),
    [query, categories, coverages, sort, dir],
  );
  const totals = useMemo(() => coverageCounts(GHL_MODULES), []);
  const filtersActive = query !== "" || categories.length > 0 || coverages.length > 0;

  function toggle<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  function sortBy(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "confidence" || key === "lastChecked" ? "desc" : "asc");
    }
  }

  function exportCsv() {
    downloadFile(
      `all-modules-${new Date().toISOString().slice(0, 10)}.csv`,
      modulesToCsv(rows),
      "text/csv;charset=utf-8",
    );
  }

  function exportPdf() {
    const ok = printModulesReport(rows, workspace);
    setPrintMsg(
      ok
        ? null
        : "Your browser blocked the report window. Allow pop-ups for this site, then try Export PDF again.",
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Module Explorer"
        description="Every GoHighLevel-style module we catalogued, its category, whether your build covers it, and where the information came from."
        crumbs={[{ label: "Platform" }, { label: "Module Explorer" }]}
        meta={
          <>
            <HeaderChip label="Total" value={GHL_MODULES.length} />
            <HeaderChip label="Covered" value={totals.covered} tone="success" />
            <HeaderChip label="Partial" value={totals.partial} tone="warning" />
            <HeaderChip label="Unknown" value={totals.unknown} />
          </>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={restartTour}>
              <PlayCircle className="size-3.5" />
              Replay tour
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <FileDown className="size-3.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={exportPdf}>
              <FileText className="size-3.5" />
              Export PDF
            </Button>
          </>
        }
      />

      <PageBody>
        {printMsg && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {printMsg}
          </p>
        )}

        {/* Controls */}
        <div className="surface-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules — CRM, pipelines, campaigns, messaging…"
                aria-label="Search modules"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-xs outline-none focus:border-primary"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="eyebrow">Sort</span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => sortBy(s.key)}
                  aria-pressed={sort === s.key}
                  className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    sort === s.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                  {sort === s.key && <ArrowUpDown className="size-3" />}
                  {sort === s.key && <span className="sr-only">{dir === "asc" ? "ascending" : "descending"}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1">Status</span>
            {COVERAGES.map((c) => (
              <FilterChip
                key={c}
                active={coverages.includes(c)}
                onClick={() => toggle(coverages, c, setCoverages)}
                label={COVERAGE_LABEL[c]}
              />
            ))}
            <span className="mx-2 h-4 w-px bg-border" />
            <span className="eyebrow mr-1">Category</span>
            {GHL_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={categories.includes(c)}
                onClick={() => toggle(categories, c, setCategories)}
                label={c}
              />
            ))}
            {filtersActive && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-1 h-6 px-2 text-[11px]"
                onClick={() => {
                  setQuery("");
                  setCategories([]);
                  setCoverages([]);
                }}
              >
                Reset filters
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Showing {rows.length} of {GHL_MODULES.length} modules. Exports include exactly the rows
            shown here.
          </p>
        </div>

        {/* List */}
        {rows.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={Compass}
              title="No modules match your filters"
              description="Try a different search term, or clear the status and category filters."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategories([]);
                    setCoverages([]);
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((m) => {
              const Icon = COVERAGE_ICON[m.coverage];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelected(m)}
                  className="surface-card group p-4 text-left transition-all duration-150 hover:elevation-raised hover:-translate-y-0.5"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="eyebrow">{m.category}</p>
                      <h3 className="mt-1 font-display text-sm font-bold">{m.name}</h3>
                    </div>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        COVERAGE_STYLE[m.coverage]
                      }`}
                    >
                      <Icon className="size-3" />
                      {COVERAGE_LABEL[m.coverage]}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{m.summary}</p>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono">
                      {Math.round(m.provenance.confidence * 100)}% confidence
                    </span>
                    <span className="font-mono">Checked {m.provenance.lastChecked}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageBody>

      {selected && <ModuleDetail module={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

function HeaderChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-medium">
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums ${cls}`}>{value}</span>
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ModuleDetail({ module: m, onClose }: { module: GhlModule; onClose: () => void }) {
  const Icon = COVERAGE_ICON[m.coverage];
  const pct = Math.round(m.provenance.confidence * 100);
  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-foreground/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${m.name} details`}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{m.category}</p>
            <h2 className="mt-1 font-display text-lg font-bold">{m.name}</h2>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                COVERAGE_STYLE[m.coverage]
              }`}
            >
              <Icon className="size-3" />
              {COVERAGE_LABEL[m.coverage]} in this build
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <section className="mb-5">
          <h3 className="eyebrow mb-2">What it does</h3>
          <p className="text-xs leading-relaxed">{m.details}</p>
        </section>

        {m.appRoute && (
          <section className="mb-5">
            <h3 className="eyebrow mb-2">Where it lives in your app</h3>
            <Button asChild size="sm" variant="outline">
              <Link to={m.appRoute}>
                Open {m.name}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </section>
        )}

        <section className="mb-5">
          <h3 className="eyebrow mb-2">Data provenance</h3>
          <dl className="space-y-2.5 rounded-lg border border-border p-3 text-xs">
            <Row label="Source">
              <a
                href={m.provenance.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {m.provenance.sourceLabel}
                <ExternalLink className="size-3" />
              </a>
            </Row>
            <Row label="Source URL">
              <span className="break-all font-mono text-[10px] text-muted-foreground">
                {m.provenance.sourceUrl}
              </span>
            </Row>
            <Row label="Last checked">
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <CalendarClock className="size-3 text-muted-foreground" />
                {m.provenance.lastChecked}
              </span>
            </Row>
            <Row label="Confidence">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${
                      pct >= 80 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-muted-foreground"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
              </div>
            </Row>
            <Row label="How we know">
              <span className="inline-flex items-start gap-1 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                {m.provenance.method}
              </span>
            </Row>
          </dl>
        </section>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
