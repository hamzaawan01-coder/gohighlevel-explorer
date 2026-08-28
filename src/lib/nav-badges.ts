/**
 * Live counters shown as badges in the left navigation:
 * unread Inbox threads, overdue tasks and failed outbound sends.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { useNavPrefs } from "@/lib/nav-prefs";

export type NavBadges = {
  inbox: number;
  tasks: number;
  failed: number;
};

const EMPTY: NavBadges = { inbox: 0, tasks: 0, failed: 0 };

export function useNavBadges(): NavBadges {
  const subAccountId = useTenancy((s) => s.currentSubAccountId);
  const inboxSeenAt = useNavPrefs((s) => s.inboxSeenAt);

  const { data } = useQuery({
    queryKey: ["nav-badges", subAccountId, inboxSeenAt],
    enabled: !!subAccountId,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<NavBadges> => {
      if (!subAccountId) return EMPTY;
      const nowIso = new Date().toISOString();

      const inboxQuery = supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("sub_account_id", subAccountId);
      if (inboxSeenAt) inboxQuery.gt("last_message_at", inboxSeenAt);

      const [inbox, tasks, failed] = await Promise.all([
        inboxQuery,
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("sub_account_id", subAccountId)
          .in("status", ["open", "in_progress"])
          .lt("due_at", nowIso),
        supabase
          .from("outbound_messages")
          .select("id", { count: "exact", head: true })
          .eq("sub_account_id", subAccountId)
          .eq("status", "failed"),
      ]);

      return {
        inbox: inbox.count ?? 0,
        tasks: tasks.count ?? 0,
        failed: failed.count ?? 0,
      };
    },
  });

  return data ?? EMPTY;
}
