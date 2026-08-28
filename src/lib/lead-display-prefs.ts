import { useCallback, useEffect, useState } from "react";

export type LeadDisplayPrefs = {
  showLeadSource: boolean;
  showRawPayload: boolean;
};

const KEY = "lead-display-prefs";
const DEFAULTS: LeadDisplayPrefs = { showLeadSource: false, showRawPayload: false };
const EVENT = "lead-display-prefs-change";

export function readLeadDisplayPrefs(): LeadDisplayPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LeadDisplayPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function writeLeadDisplayPrefs(next: LeadDisplayPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Prefs for the lead modal; hidden-by-default sections are opt-in via Settings. */
export function useLeadDisplayPrefs() {
  const [prefs, setPrefs] = useState<LeadDisplayPrefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(readLeadDisplayPrefs());
    const sync = () => setPrefs(readLeadDisplayPrefs());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<LeadDisplayPrefs>) => {
    const next = { ...readLeadDisplayPrefs(), ...patch };
    writeLeadDisplayPrefs(next);
    setPrefs(next);
  }, []);

  return { prefs, update };
}
