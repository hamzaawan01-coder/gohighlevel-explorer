/**
 * Local, per-browser UI state for the Meta integration tab.
 * Search / filter / expanded cards are stored *per sub-tab*, so switching
 * between Channels, Lead Ads, Ad accounts and Webhooks restores exactly the
 * view you left behind. Also tracks when counts and webhook status were last
 * checked so the header can show a "last refreshed" age.
 */
const KEY = "meta-tab-ui.v2";
const STAMP_KEY = "meta-tab-stamps.v1";

export type MetaChannelFilter = "all" | "subscribed" | "unsubscribed" | "instagram" | "leadads";

const FILTERS: MetaChannelFilter[] = ["all", "subscribed", "unsubscribed", "instagram", "leadads"];

export type MetaTabView = {
  search: string;
  filter: MetaChannelFilter;
  expanded: string[];
};

export type MetaTabUiState = {
  tab: string;
  /** Per-sub-tab view state, keyed by tab id. */
  views: Record<string, MetaTabView>;
};

export const META_TAB_IDS = ["channels", "leads", "ads", "advanced"] as const;

const emptyView = (): MetaTabView => ({ search: "", filter: "all", expanded: [] });

const DEFAULTS: MetaTabUiState = {
  tab: "channels",
  views: Object.fromEntries(META_TAB_IDS.map((t) => [t, emptyView()])),
};

function parseView(raw: unknown): MetaTabView {
  const v = (raw ?? {}) as Partial<MetaTabView>;
  return {
    search: typeof v.search === "string" ? v.search : "",
    filter: FILTERS.includes(v.filter as MetaChannelFilter) ? (v.filter as MetaChannelFilter) : "all",
    expanded: Array.isArray(v.expanded) ? v.expanded.filter((x) => typeof x === "string") : [],
  };
}

export function loadMetaTabUi(): MetaTabUiState {
  if (typeof window === "undefined") return structuredCloneSafe(DEFAULTS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredCloneSafe(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<MetaTabUiState>;
    const views: Record<string, MetaTabView> = {};
    for (const t of META_TAB_IDS) views[t] = parseView(parsed.views?.[t]);
    return {
      tab: typeof parsed.tab === "string" ? parsed.tab : DEFAULTS.tab,
      views,
    };
  } catch {
    return structuredCloneSafe(DEFAULTS);
  }
}

export function saveMetaTabUi(state: MetaTabUiState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/* ── Freshness stamps ─────────────────────────────────────── */

export type MetaStamps = {
  /** ISO timestamp of the last successful "Refresh counts". */
  countsAt: string | null;
  /** ISO timestamp of the last successful webhook resync. */
  webhooksAt: string | null;
};

export function loadMetaStamps(): MetaStamps {
  if (typeof window === "undefined") return { countsAt: null, webhooksAt: null };
  try {
    const raw = window.localStorage.getItem(STAMP_KEY);
    if (!raw) return { countsAt: null, webhooksAt: null };
    const p = JSON.parse(raw) as Partial<MetaStamps>;
    return {
      countsAt: typeof p.countsAt === "string" ? p.countsAt : null,
      webhooksAt: typeof p.webhooksAt === "string" ? p.webhooksAt : null,
    };
  } catch {
    return { countsAt: null, webhooksAt: null };
  }
}

export function saveMetaStamps(stamps: MetaStamps) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STAMP_KEY, JSON.stringify(stamps));
  } catch {
    /* non-fatal */
  }
}

/** Human "3 minutes ago" style age for a stamp. */
export function describeAge(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** True when data is older than the given number of minutes (default 30). */
export function isStale(iso: string | null, minutes = 30): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return true;
  return Date.now() - then > minutes * 60_000;
}

function structuredCloneSafe(s: MetaTabUiState): MetaTabUiState {
  return { tab: s.tab, views: Object.fromEntries(Object.entries(s.views).map(([k, v]) => [k, { ...v, expanded: [...v.expanded] }])) };
}

export const META_UI_DEFAULTS = DEFAULTS;
