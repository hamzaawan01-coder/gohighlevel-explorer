import { useCallback, useEffect, useState } from "react";

export type SavedLeadSearch = {
  id: string;
  name: string;
  query: string;
  columns: Record<string, boolean>;
  timelineKinds: string[];
};

const KEY = "lead-saved-searches";
const EVENT = "lead-saved-searches-change";

export function readSavedLeadSearches(): SavedLeadSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedLeadSearch[]) : [];
  } catch {
    return [];
  }
}

function write(next: SavedLeadSearch[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Saved lead-modal search filters, persisted locally and shared across panels. */
export function useSavedLeadSearches() {
  const [searches, setSearches] = useState<SavedLeadSearch[]>([]);

  useEffect(() => {
    setSearches(readSavedLeadSearches());
    const sync = () => setSearches(readSavedLeadSearches());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((entry: Omit<SavedLeadSearch, "id">) => {
    const current = readSavedLeadSearches();
    const existing = current.find((s) => s.name.toLowerCase() === entry.name.toLowerCase());
    const next = existing
      ? current.map((s) => (s.id === existing.id ? { ...s, ...entry } : s))
      : [...current, { ...entry, id: crypto.randomUUID() }];
    write(next);
    setSearches(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = readSavedLeadSearches().filter((s) => s.id !== id);
    write(next);
    setSearches(next);
  }, []);

  return { searches, save, remove };
}
