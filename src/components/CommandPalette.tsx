import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, CheckSquare, Calendar as CalIcon } from "lucide-react";
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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const subId = useTenancy((s) => s.currentSubAccountId);

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

  const { data: hits = [] } = useQuery({
    queryKey: ["global-search", subId, q],
    enabled: open && !!subId && q.trim().length > 0,
    queryFn: () => globalSearch(subId!, q),
  });

  function go(h: SearchHit) {
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
  for (const h of hits) groups[h.kind].push(h);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contacts, deals, tasks, events…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>
          {q ? "No matches." : "Start typing to search…"}
        </CommandEmpty>
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
      </CommandList>
    </CommandDialog>
  );
}
