import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Inbox, Phone, PhoneOff } from "lucide-react";
import { useSoftphone } from "@/lib/softphone-bus";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useNotificationRealtime,
  type Notification,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Lead Convert" }] }),
  component: InboxPage,
});

type Filter = "all" | "unread";

function InboxPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

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
  const unreadCount = notes.filter((n) => !n.read_at).length;
  const visible = useMemo(
    () => (filter === "unread" ? notes.filter((n) => !n.read_at) : notes),
    [notes, filter],
  );

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
          <span className="size-2 bg-accent rounded-full" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {unreadCount} unread · {notes.length} total
          </span>
        </div>
      }
      headerActions={
        <button
          onClick={() => readAll.mutate()}
          disabled={unreadCount === 0 || readAll.isPending}
          className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </button>
      }
    >
      <div className="h-full flex flex-col">
        <h1 className="sr-only">Inbox</h1>
        <LiveCallBar />
        <div className="px-6 py-3 border-b border-border flex items-center gap-1.5">
          {(["all", "unread"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "text-[11px] font-medium px-2.5 py-1 rounded-md capitalize transition-colors " +
                (filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary")
              }
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {q.isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={6} />
            </div>
          ) : q.isError ? (
            <ErrorState
              title="Couldn't load notifications"
              error={q.error}
              onRetry={() => q.refetch()}
              retrying={q.isFetching}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
              description={filter === "unread" ? "Nothing unread right now." : "Notifications about your workspace will show up here."}
            />
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n) => (
                <NoteRow key={n.id} note={n} onRead={(id) => readOne.mutate(id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NoteRow({ note, onRead }: { note: Notification; onRead: (id: string) => void }) {
  const body = (
    <div className={"px-6 py-3 flex gap-3 items-start hover:bg-muted/40 transition-colors " + (note.read_at ? "opacity-60" : "")}>
      <div className="mt-1 shrink-0">
        {note.read_at ? (
          <Bell className="size-3.5 text-muted-foreground" />
        ) : (
          <span className="size-2 rounded-full bg-accent block" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{note.title}</p>
        {note.body && <p className="text-xs text-muted-foreground mt-0.5">{note.body}</p>}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </p>
      </div>
      {!note.read_at && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(note.id); }}
          aria-label="Mark notification as read"
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
          title="Mark read"
        >
          <Check className="size-3.5" />
        </button>
      )}
    </div>
  );

  if (note.link) {
    return (
      <li>
        <Link
          to={note.link}
          onClick={() => { if (!note.read_at) onRead(note.id); }}
          className="block"
        >
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}
