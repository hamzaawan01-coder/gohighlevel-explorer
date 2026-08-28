import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Columns3,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import {
  addSavedView,
  loadSavedViews,
  loadTableState,
  removeSavedView,
  saveTableState,
  type SavedTableView,
} from "@/lib/table-views";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Sort value; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
  /** Hide by default in the column picker. */
  hidden?: boolean;
  /** Keep always visible (not toggleable). */
  locked?: boolean;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * Data table with sticky header, client-side sorting, pagination, column
 * visibility and first-class loading / empty / error states.
 * Row height follows the global density setting.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  isLoading = false,
  error,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  pageSize: initialPageSize = 25,
  paginate = true,
  showColumnPicker = true,
  toolbar,
  maxBodyHeight = "60vh",
  tableKey,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  pageSize?: number;
  paginate?: boolean;
  showColumnPicker?: boolean;
  toolbar?: ReactNode;
  maxBodyHeight?: string;
  /** Enables saved views + persisted sort/columns/page size for this table. */
  tableKey?: string;
  /** Accessible description of the table contents. */
  caption?: string;
}) {
  const defaultHidden = useMemo(
    () => columns.filter((c) => c.hidden).map((c) => c.key),
    [columns],
  );
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden));
  const [views, setViews] = useState<SavedTableView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore persisted state + saved views once mounted (client only).
  useEffect(() => {
    if (!tableKey) {
      setHydrated(true);
      return;
    }
    setViews(loadSavedViews(tableKey));
    const saved = loadTableState(tableKey);
    if (saved) {
      setSort(saved.sort ?? null);
      setHidden(new Set(saved.hidden ?? []));
      setPageSize(saved.pageSize || initialPageSize);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  useEffect(() => {
    if (!tableKey || !hydrated) return;
    saveTableState(tableKey, { sort, hidden: [...hidden], pageSize });
  }, [tableKey, hydrated, sort, hidden, pageSize]);

  function applyView(view: SavedTableView) {
    setSort(view.sort ?? null);
    setHidden(new Set(view.hidden ?? []));
    setPageSize(view.pageSize || initialPageSize);
    setActiveView(view.id);
    setPage(0);
  }

  function resetView() {
    setSort(null);
    setHidden(new Set(defaultHidden));
    setPageSize(initialPageSize);
    setActiveView(null);
    setPage(0);
  }

  function createView() {
    if (!tableKey) return;
    const name = window.prompt("Name this view")?.trim();
    if (!name) return;
    const next = addSavedView(tableKey, name, { sort, hidden: [...hidden], pageSize });
    setViews(next);
    setActiveView(next.find((v) => v.name === name)?.id ?? null);
  }

  const visibleColumns = columns.filter((c) => c.locked || !hidden.has(c.key));

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = paginate
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted;

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" },
    );
    setPage(0);
  }

  if (isLoading) return <TableSkeleton cols={Math.min(visibleColumns.length || 4, 6)} />;
  if (error) return <div className="surface-card"><ErrorState error={error} onRetry={onRetry} /></div>;

  return (
    <div className="flex flex-col gap-3">
      {tableKey ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saved views">
          <button
            type="button"
            onClick={resetView}
            aria-pressed={activeView === null}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeView === null
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <RotateCcw className="size-3" />
            Default
          </button>
          {views.map((v) => (
            <span
              key={v.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                activeView === v.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-secondary/60 text-muted-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => applyView(v)}
                aria-pressed={activeView === v.id}
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {v.name}
              </button>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onClick={() => {
                  setViews(removeSavedView(tableKey, v.id));
                  if (activeView === v.id) resetView();
                }}
                className="opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={createView} className="h-7 text-[11px]">
            <Bookmark className="size-3" />
            Save view
          </Button>
        </div>
      ) : null}
      {toolbar || showColumnPicker ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {showColumnPicker ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="size-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
                {columns
                  .filter((c) => !c.locked)
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={!hidden.has(c.key)}
                      onCheckedChange={(checked) =>
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(c.key);
                          else next.add(c.key);
                          return next;
                        })
                      }
                      className="text-xs"
                    >
                      {typeof c.header === "string" ? c.header : c.key}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="surface-card overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: maxBodyHeight }}>
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-secondary/80 backdrop-blur-sm">
                {visibleColumns.map((c) => {
                  const active = sort?.key === c.key;
                  const sortable = !!c.sortValue;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`border-b border-border px-3 py-2 eyebrow whitespace-nowrap ${
                        c.headerClassName ?? ""
                      }`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {c.header}
                          {active ? (
                            sort!.dir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length}>
                    <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-border/70 last:border-0 transition-colors ${
                      onRowClick ? "cursor-pointer hover:bg-secondary/60" : ""
                    }`}
                  >
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 align-middle ${c.className ?? ""}`}
                        style={{
                          height: "var(--row-h)",
                          paddingBlock: "var(--row-py)",
                          fontSize: "var(--text-row)",
                        }}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginate && sorted.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of{" "}
            <span className="font-semibold text-foreground">{sorted.length}</span>
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs"
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums">
              {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
