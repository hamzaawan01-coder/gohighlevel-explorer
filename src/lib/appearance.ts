import { useEffect, useState } from "react";

export type PaletteKey = "mono" | "emerald" | "navy" | "slate" | "indigo" | "graphite";
export type ModeKey = "light" | "dark" | "system";
export type DensityKey = "comfortable" | "compact";

export type PalettePreset = {
  key: PaletteKey;
  label: string;
  description: string;
  /** Swatch preview values (light mode), ordered dark → light. */
  swatch: [string, string, string, string];
};

export const PALETTES: PalettePreset[] = [
  {
    key: "mono",
    label: "Mono Graphite",
    description: "Black type on white with black buttons — plain, sharp, no colour accent.",
    swatch: ["#111111", "#4a4a4a", "#f2f2f2", "#ffffff"],
  },
  {
    key: "emerald",
    label: "Emerald Prestige",
    description: "Rich emerald with warm gold accents — authoritative and finance-grade.",
    swatch: ["#064e3b", "#0d7a5f", "#c9a84c", "#f5f0e0"],
  },
  {
    key: "navy",
    label: "Navy Trust",
    description: "Deep navy with crisp blues — the classic enterprise register.",
    swatch: ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#e8edf3"],
  },
  {
    key: "slate",
    label: "Slate & Steel",
    description: "Cool neutral grays with a blue undertone — restrained modern SaaS.",
    swatch: ["#2d3748", "#4a5568", "#718096", "#a0aec0"],
  },
  {
    key: "indigo",
    label: "Midnight Indigo",
    description: "Electric indigo on deep navy — sophisticated product-tech feel.",
    swatch: ["#0a0a1a", "#141432", "#4f46e5", "#a5b4fc"],
  },
  {
    key: "graphite",
    label: "Charcoal & Ember",
    description: "Graphite neutrals with a burnt-ember accent — bold and premium.",
    swatch: ["#1a1a1a", "#2d2d2d", "#4a4a4a", "#e85d3a"],
  },
];

export const DEFAULT_APPEARANCE = {
  palette: "mono" as PaletteKey,
  mode: "light" as ModeKey,
  density: "comfortable" as DensityKey,
};

export type Appearance = typeof DEFAULT_APPEARANCE;

const KEY = "app.appearance.v2";
const EVENT = "app-appearance-change";

function isPalette(v: unknown): v is PaletteKey {
  return PALETTES.some((p) => p.key === v);
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      palette: isPalette(parsed.palette) ? parsed.palette : DEFAULT_APPEARANCE.palette,
      mode:
        parsed.mode === "dark" || parsed.mode === "light" || parsed.mode === "system"
          ? parsed.mode
          : DEFAULT_APPEARANCE.mode,
      density: parsed.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function resolveDark(mode: ModeKey): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["palette"] = a.palette;
  root.dataset["density"] = a.density;
  root.classList.toggle("dark", resolveDark(a.mode));
  root.style.colorScheme = resolveDark(a.mode) ? "dark" : "light";
}

export function writeAppearance(patch: Partial<Appearance>) {
  const next = { ...readAppearance(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  applyAppearance(next);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  return next;
}

/** Reactive appearance state, synced across tabs and components. */
export function useAppearance() {
  const [state, setState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const sync = () => setState(readAppearance());
    sync();
    applyAppearance(readAppearance());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => applyAppearance(readAppearance());
    mq.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      mq.removeEventListener("change", onScheme);
    };
  }, []);

  return {
    ...state,
    isDark: resolveDark(state.mode),
    setPalette: (palette: PaletteKey) => setState(writeAppearance({ palette })),
    setMode: (mode: ModeKey) => setState(writeAppearance({ mode })),
    setDensity: (density: DensityKey) => setState(writeAppearance({ density })),
    toggleMode: () =>
      setState(writeAppearance({ mode: resolveDark(readAppearance().mode) ? "light" : "dark" })),
    reset: () => setState(writeAppearance(DEFAULT_APPEARANCE)),
  };
}

/** Inline script injected in <head> so the theme is applied before first paint. */
export const APPEARANCE_BOOTSTRAP = `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(
  KEY,
)})||"{}");var p=a.palette||"mono";var m=a.mode||"light";var d=a.density||"comfortable";var r=document.documentElement;r.dataset.palette=p;r.dataset.density=d;var dark=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
