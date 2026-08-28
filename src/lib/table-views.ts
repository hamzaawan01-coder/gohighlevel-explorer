/**
 * Saved table views + last-used table state, persisted in localStorage so a
 * user's sorting, visible columns and page size survive reloads.
 */
export type TableViewState = {
  sort: { key: string; dir: "asc" | "desc" } | null;
  hidden: string[];
  pageSize: number;
};

export type SavedTableView = TableViewState & { id: string; name: string };

const PREFIX = "crm.table.";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function loadTableState(tableKey: string): TableViewState | null {
  return read<TableViewState | null>(`${tableKey}.state`, null);
}

export function saveTableState(tableKey: string, state: TableViewState) {
  write(`${tableKey}.state`, state);
}

export function loadSavedViews(tableKey: string): SavedTableView[] {
  return read<SavedTableView[]>(`${tableKey}.views`, []);
}

export function saveSavedViews(tableKey: string, views: SavedTableView[]) {
  write(`${tableKey}.views`, views);
}

export function addSavedView(
  tableKey: string,
  name: string,
  state: TableViewState,
): SavedTableView[] {
  const views = loadSavedViews(tableKey);
  const view: SavedTableView = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    ...state,
  };
  const next = [...views.filter((v) => v.name !== name), view];
  saveSavedViews(tableKey, next);
  return next;
}

export function removeSavedView(tableKey: string, id: string): SavedTableView[] {
  const next = loadSavedViews(tableKey).filter((v) => v.id !== id);
  saveSavedViews(tableKey, next);
  return next;
}
