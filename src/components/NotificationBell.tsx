import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useNotificationRealtime,
} from "@/lib/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useNotificationRealtime(userId);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: !!userId,
  });

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notes = q.data ?? [];
  const unread = notes.filter((n) => !n.read_at).length;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayNotes = notes.filter((n) => new Date(n.created_at) >= startOfToday);
  const earlierNotes = notes.filter((n) => new Date(n.created_at) < startOfToday);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative size-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <Bell className="size-3.5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Notifications
          </span>
          {unread > 0 && (
            <button
              onClick={() => readAll.mutate()}
              className="text-[10px] text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {notes.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className={
                    "px-3 py-2.5 flex gap-2 items-start " +
                    (n.read_at ? "opacity-60" : "bg-accent/5")
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => readOne.mutate(n.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Mark read"
                    >
                      <Check className="size-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
