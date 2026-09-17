import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchMySubAccounts, useTenancy, type SubAccount } from "@/lib/tenancy";
import { useNavigate } from "@tanstack/react-router";

export function SubAccountSwitcher() {
  const navigate = useNavigate();
  const { currentSubAccountId, setCurrent } = useTenancy();

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["my-sub-accounts"],
    queryFn: fetchMySubAccounts,
  });

  // Auto-select first sub-account if none selected or selected one is gone
  useEffect(() => {
    if (isLoading) return;
    if (subs.length === 0) return;
    if (!currentSubAccountId || !subs.find((s) => s.id === currentSubAccountId)) {
      setCurrent(subs[0].id);
    }
  }, [subs, currentSubAccountId, setCurrent, isLoading]);

  const current: SubAccount | undefined = subs.find((s) => s.id === currentSubAccountId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 px-2 py-1.5 surface-card rounded-md hover:bg-card/80 transition-colors text-left">
          <div className="size-6 bg-accent rounded flex items-center justify-center text-[10px] text-accent-foreground font-bold">
            {(current?.name ?? "A")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {current?.name ?? (isLoading ? "Loading…" : "No workspace")}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {subs.length} workspace{subs.length === 1 ? "" : "s"}
            </p>
          </div>
          <ChevronsUpDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        {subs.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => setCurrent(s.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{s.name}</span>
            {s.id === currentSubAccountId ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings/sub-accounts" })}>
          <Plus className="size-3.5 mr-2" />
          New sub-account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
