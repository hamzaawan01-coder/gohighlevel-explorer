/**
 * Local, per-browser UI state for the Meta integration tab.
 * Keeps the active sub-tab, channel search/filters and expanded page cards
 * across tab switches and page reloads.
 */
const KEY = "meta-tab-ui.v1";

export type MetaChannelFilter = "all" | "subscribed" | "unsubscribed" | "instagram" | "leadads";

export type MetaTabUiState = {
  tab: string;
  search: string;
  filter: MetaChannelFilter;
  expanded: string[];
};

const DEFAULTS: MetaTabUiState = {
  tab: "channels",
  search: "",
  filter: "all",
  expanded: [],
};

export function loadMetaTabUi(): MetaTabUiState {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<MetaTabUiState>;
    return {
      tab: typeof parsed.tab === "string" ? parsed.tab : DEFAULTS.tab,
      search: typeof parsed.search === "string" ? parsed.search : "",
      filter: (["all", "subscribed", "unsubscribed", "instagram", "leadads"] as const).includes(
        parsed.filter as MetaChannelFilter,
      )
        ? (parsed.filter as MetaChannelFilter)
        : "all",
      expanded: Array.isArray(parsed.expanded) ? parsed.expanded.filter((v) => typeof v === "string") : [],
    };
  } catch {
    return { ...DEFAULTS };
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

export const META_UI_DEFAULTS = DEFAULTS;
