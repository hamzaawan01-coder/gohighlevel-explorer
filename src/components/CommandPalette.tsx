import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, CheckSquare, Calendar as CalIcon, Ban, ArrowRight } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useTenancy } from "@/lib/tenancy";
import { globalSearch, type SearchHit } from "@/lib/search";
import { MODULES, isModuleEnabled, useModules } from "@/lib/modules";
import { toast } from "sonner";

/** Which module owns each search result kind. */
const KIND_MODULE: Record<SearchHit["kind"], string> = {
  contact: "contacts",
  deal: "opportunities",
  task: "tasks",
  event: "calendar",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const { state } = useModules();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    (window as unknown as { __openPalette?: () => void }).__openPalette = () => setOpen(true);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enabledKinds = (Object.keys(KIND_MODULE) as SearchHit["kind"][]).filter((k) =>
    isModuleEnabled(state, KIND_MODULE[k]),
  );

  const { data: hits = [] } = useQuery({
    queryKey: ["global-search", subId, q, enabledKinds.join(",")],
    enabled: open && !!subId && q.trim().length > 0,
    queryFn: () => globalSearch(subId!, q, { kinds: enabledKinds }),
  });

  function go(h: SearchHit) {
    const moduleKey = KIND_MODULE[h.kind];
    if (!isModuleEnabled(state, moduleKey)) {
      const label = MODULES.find((m) => m.key === moduleKey)?.label ?? moduleKey;
      toast.error(`${label} is turned off for this workspace — a workspace admin can re-enable it in Settings → Modules.`);
      return;
    }
    setOpen(false);
    setQ("");
    if (h.kind === "contact") navigate({ to: "/contacts", search: { open: h.id } as never });
    else if (h.kind === "deal") navigate({ to: "/opportunities", search: { open: h.id } as never });
    else if (h.kind === "task") navigate({ to: "/tasks" });
    else if (h.kind === "event") navigate({ to: "/calendar" });
  }

  const groups: Record<SearchHit["kind"], SearchHit[]> = {
    contact: [], deal: [], task: [], event: [],
  };
  for (const h of hits) {
    if (isModuleEnabled(state, KIND_MODULE[h.kind])) groups[h.kind].push(h);
  }

  // Navigation commands for enabled modules only.
  const navModules = MODULES.filter(
    (m) => isModuleEnabled(state, m.key) && m.paths[0]?.startsWith("/") && !m.locked,
  );
  const term = q.trim().toLowerCase();
  const navMatches = term
    ? navModules.filter((m) => m.label.toLowerCase().includes(term))
    : navModules.slice(0, 6);

  const nothing =
    navMatches.length === 0 &&
    Object.values(groups).every((g) => g.length === 0);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contacts, deals, tasks, events…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {nothing && <CommandEmpty>{q ? "No matches." : "Start typing to search…"}</CommandEmpty>}
        {navMatches.length > 0 && (
          <CommandGroup heading="Go to">
            {navMatches.map((m) => (
              <CommandItem
                key={m.key}
                value={`nav-${m.key}-${m.label}`}
                onSelect={() => {
                  setOpen(false);
                  setQ("");
                  navigate({ to: m.paths[0] as never });
                }}
              >
                <ArrowRight className="size-4 mr-2" />
                <span className="flex-1">{m.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.contact.length > 0 && (
          <CommandGroup heading="Contacts">
            {groups.contact.map((h) => (
              <CommandItem key={h.id} value={`contact-${h.id}-${h.title}`} onSelect={() => go(h)}>
                <Users className="size-4 mr-2" />
                <span className="flex-1">{h.title}</span>
                {h.subtitle && <span className="text-xs text-muted-foreground">{h.subtitle}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.deal.length > 0 && (
          <CommandGroup heading="Deals">
            {groups.deal.map((h) => (
              <CommandItem key={h.id} value={`deal-${h.id}-${h.title}`} onSelect={() => go(h)}>
                <Briefcase className="size-4 mr-2" />
                <span className="flex-1">{h.title}</span>
                {h.subtitle && <span className="text-xs text-muted-foreground">{h.subtitle}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.task.length > 0 && (
          <CommandGroup heading="Tasks">
            {groups.task.map((h) => (
              <CommandItem key={h.id} value={`task-${h.id}-${h.title}`} onSelect={() => go(h)}>
                <CheckSquare className="size-4 mr-2" />
                <span className="flex-1">{h.title}</span>
                {h.subtitle && <span className="text-xs text-muted-foreground">{h.subtitle}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.event.length > 0 && (
          <CommandGroup heading="Events">
            {groups.event.map((h) => (
              <CommandItem key={h.id} value={`event-${h.id}-${h.title}`} onSelect={() => go(h)}>
                <CalIcon className="size-4 mr-2" />
                <span className="flex-1">{h.title}</span>
                {h.subtitle && <span className="text-xs text-muted-foreground">{h.subtitle}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {q && MODULES.some((m) => !isModuleEnabled(state, m.key) && m.label.toLowerCase().includes(term)) && (
          <CommandGroup heading="Turned off">
            {MODULES.filter(
              (m) => !isModuleEnabled(state, m.key) && m.label.toLowerCase().includes(term),
            ).map((m) => (
              <CommandItem
                key={`off-${m.key}`}
                value={`off-${m.key}`}
                onSelect={() =>
                  toast.error(`${m.label} is turned off for this workspace — a workspace admin can re-enable it in Settings → Modules.`)
                }
                className="opacity-60"
              >
                <Ban className="size-4 mr-2" />
                <span className="flex-1">{m.label}</span>
                <span className="text-xs text-muted-foreground">disabled</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
