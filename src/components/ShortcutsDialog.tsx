import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Shortcut = { keys: string[]; label: string };

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette / search" },
      { keys: ["?"], label: "Show this keyboard shortcuts help" },
      { keys: ["Esc"], label: "Close dialogs, panels and menus" },
      { keys: ["Tab"], label: "Move focus to the next control" },
      { keys: ["Shift", "Tab"], label: "Move focus to the previous control" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["G", "D"], label: "Go to dashboard" },
      { keys: ["G", "O"], label: "Go to opportunities" },
      { keys: ["G", "C"], label: "Go to contacts" },
      { keys: ["G", "T"], label: "Go to tasks" },
      { keys: ["G", "I"], label: "Go to inbox" },
      { keys: ["G", "S"], label: "Go to settings hub" },
    ],
  },
  {
    title: "Tables & lists",
    items: [
      { keys: ["Enter"], label: "Open the focused row" },
      { keys: ["Space"], label: "Open the focused row" },
      { keys: ["/"], label: "Focus the search field on the page" },
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Global "?" keyboard shortcuts help. Mounted once in the app shell.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Press <kbd className="rounded border border-border bg-secondary px-1 font-mono">?</kbd>{" "}
            any time to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="eyebrow mb-2">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-xs text-muted-foreground">{s.label}</span>
                    <Keys keys={s.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
