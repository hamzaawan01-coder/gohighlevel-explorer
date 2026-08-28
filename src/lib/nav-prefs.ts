/**
 * Per-browser preferences for the left navigation: pinned pages, recently
 * visited pages, collapsed/expanded group state and the last time the Inbox
 * was opened (used to derive the unread badge).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type NavPrefsState = {
  /** Pinned nav paths, in user order. */
  pinned: string[];
  /** Most-recently visited nav paths, newest first. */
  recents: string[];
  /** Explicit open/closed state per group label; missing = auto. */
  groups: Record<string, boolean>;
  /** ISO timestamp of the last Inbox visit. */
  inboxSeenAt: string | null;
  togglePin: (path: string) => void;
  isPinned: (path: string) => boolean;
  pushRecent: (path: string) => void;
  setGroupOpen: (label: string, open: boolean) => void;
  markInboxSeen: () => void;
};

export const MAX_RECENTS = 4;

export const useNavPrefs = create<NavPrefsState>()(
  persist(
    (set, get) => ({
      pinned: [],
      recents: [],
      groups: {},
      inboxSeenAt: null,
      togglePin: (path) =>
        set((s) => ({
          pinned: s.pinned.includes(path)
            ? s.pinned.filter((p) => p !== path)
            : [...s.pinned, path],
        })),
      isPinned: (path) => get().pinned.includes(path),
      pushRecent: (path) =>
        set((s) => {
          if (s.recents[0] === path) return s;
          return { recents: [path, ...s.recents.filter((p) => p !== path)].slice(0, MAX_RECENTS) };
        }),
      setGroupOpen: (label, open) => set((s) => ({ groups: { ...s.groups, [label]: open } })),
      markInboxSeen: () => set({ inboxSeenAt: new Date().toISOString() }),
    }),
    { name: "nav-prefs.v1" },
  ),
);
