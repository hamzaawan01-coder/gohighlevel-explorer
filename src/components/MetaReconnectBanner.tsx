import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaTokenHealth, startMetaOAuth } from "@/lib/meta.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Link2, ShieldCheck } from "lucide-react";

/**
 * Facebook user tokens die quietly — expiry, password change, permission
 * removal, or 60 days of inactivity. When that happens leads and DMs simply
 * stop arriving, so we check the token and prompt for a reconnect instead.
 */
export function MetaReconnectBanner({ subId }: { subId: string }) {
  const healthFn = useServerFn(getMetaTokenHealth);
  const startFn = useServerFn(startMetaOAuth);

  const q = useQuery({
    queryKey: ["meta-token-health", subId],
    queryFn: () => healthFn({ data: { subAccountId: subId } }),
    refetchInterval: 10 * 60 * 1000,
    retry: false,
  });

  const reconnect = useMutation({
    mutationFn: () => startFn({ data: { subAccountId: subId } }),
    onSuccess: (res: { url: string }) => {
      const w = window.open(res.url, "_blank", "noopener,noreferrer");
      if (!w) {
        toast.error("Popup blocked — allow popups, or open the link manually", {
          action: { label: "Open", onClick: () => (window.location.href = res.url) },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const h = q.data;
  if (!h || !h.connected) return null;

  const healthy = h.status === "ok" && !h.needsReconnect;
  if (healthy) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-600" />
        Facebook connection healthy
        {typeof h.daysUntilExpiry === "number" && h.daysUntilExpiry > 0 && (
          <> · access valid for {h.daysUntilExpiry} more days</>
        )}
      </p>
    );
  }

  const expiredOnly = h.status === "ok" && h.expiringSoon;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>
        {expiredOnly ? "Facebook access expires soon" : "Facebook needs reconnecting"}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-xs">
          {expiredOnly ? (
            <>
              Your Facebook access expires in {h.daysUntilExpiry} day
              {h.daysUntilExpiry === 1 ? "" : "s"}. Reconnect now so Lead Ads and Messenger keep
              flowing without a gap.
            </>
          ) : (
            <>
              We can no longer reach Facebook with the saved access for this workspace, so new
              leads and messages will not arrive until it is reconnected.
              {h.message ? <span className="block opacity-80">Details: {h.message}</span> : null}
            </>
          )}
        </p>
        <Button size="sm" onClick={() => reconnect.mutate()} disabled={reconnect.isPending}>
          <Link2 className="size-3.5" />
          {reconnect.isPending ? "Opening Facebook…" : "Reconnect Facebook"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
