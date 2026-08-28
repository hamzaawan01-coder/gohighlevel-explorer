import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleStat, ConsoleTips, StatusPill } from "@/components/console";
import { CopyField } from "@/components/CopyField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useModules } from "@/lib/modules";
import { getAppReviewStatus, testDataDeletionCallback } from "@/lib/meta-review.functions";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, FlaskConical, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, PanelSkeleton } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/settings/app-review")({
  head: () => ({
    meta: [
      { title: "Meta App Review readiness — Workspace settings" },
      {
        name: "description",
        content:
          "Check the Privacy Policy, Terms and Data Deletion Callback URLs Meta requires, run a live health check, and test the deletion callback end to end.",
      },
      { property: "og:title", content: "Meta App Review readiness" },
      {
        property: "og:description",
        content: "Live health checks and a signed_request tester for Meta App Review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppReviewPage,
});

function Health({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
      ) : (
        <XCircle className="size-3.5 shrink-0 text-destructive" />
      )}
      <span className="font-medium">{label}</span>
      {detail && <span className="truncate text-muted-foreground">{detail}</span>}
    </div>
  );
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xs">{url}</p>
      </div>
      <CopyField value={url} label={label} />
    </div>
  );
}

function AppReviewPage() {
  const { subId } = useModules();
  const [signedRequest, setSignedRequest] = useState("");
  const [metaUserId, setMetaUserId] = useState("");

  const status = useQuery({
    queryKey: ["meta-app-review", subId],
    enabled: !!subId,
    queryFn: () => getAppReviewStatus({ data: { subAccountId: subId! } }),
  });

  const test = useMutation({
    mutationFn: () =>
      testDataDeletionCallback({
        data: {
          subAccountId: subId!,
          signedRequest: signedRequest.trim() || undefined,
          metaUserId: metaUserId.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Callback OK — code ${r.confirmationCode ?? "?"}`);
      else toast.error(`Callback returned ${r.status}`);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = status.data;
  const allHealthy = d
    ? d.health.privacy.ok && d.health.terms.ok && d.health.callback.ok && d.config.appIdConfigured && d.config.appSecretConfigured
    : false;

  return (
    <AppShell>
      <PageHeader
        title="Meta App Review readiness"
        description="These are the exact URLs to paste into the Meta App Dashboard, with a live check that each one responds correctly."
        crumbs={[{ label: "Settings" }, { label: "App review" }]}
        meta={d ? <StatusPill ok={allHealthy} label={allHealthy ? "All checks passing" : "Needs attention"} /> : null}
        actions={
          d ? (
            <Button variant="outline" size="sm" onClick={() => void status.refetch()} disabled={status.isFetching}>
              <RefreshCw className={`size-3.5 ${status.isFetching ? "animate-spin" : ""}`} />
              {status.isFetching ? "Re-checking…" : "Re-run health check"}
            </Button>
          ) : null
        }
      />
      <PageBody width="full">
        {!subId ? (
          <EmptyState icon={ShieldCheck} title="Select a workspace" description="Choose a workspace to view App Review readiness." />
        ) : status.isError ? (
          <ErrorState onRetry={() => status.refetch()} error={status.error} />
        ) : status.isLoading || !d ? (
          <PanelSkeleton />
        ) : (
          <ConsoleSplit
            main={
              <>
                <ConsoleSection title="Required URLs" icon={ShieldCheck} hint="Paste into Meta App Dashboard">
                  <div className="space-y-2">
                    <UrlRow label="Privacy Policy URL" url={d.urls.privacyPolicyUrl} />
                    <UrlRow label="Terms of Service URL" url={d.urls.termsUrl} />
                    <UrlRow label="Data Deletion Callback URL" url={d.urls.dataDeletionCallbackUrl} />
                    <UrlRow label="Deletion status page" url={d.urls.dataDeletionStatusUrl} />
                  </div>
                </ConsoleSection>

                <ConsoleSection title="Deletion callback tester" icon={FlaskConical} hint="signed_request">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Paste a real <span className="font-mono">signed_request</span> from Meta, or leave it blank to
                      generate a valid test one signed with your App Secret. The request is sent to the live
                      endpoint and the returned confirmation code is shown below.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="signed-request" className="text-xs">signed_request (optional)</Label>
                      <Textarea
                        id="signed-request"
                        value={signedRequest}
                        onChange={(e) => setSignedRequest(e.target.value)}
                        rows={3}
                        placeholder="signed_request (optional)"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-user-id" className="text-xs">Meta user id for generated test (optional)</Label>
                      <Input
                        id="meta-user-id"
                        value={metaUserId}
                        onChange={(e) => setMetaUserId(e.target.value)}
                        placeholder="Meta user id for generated test (optional)"
                      />
                    </div>
                    <Button onClick={() => test.mutate()} disabled={test.isPending || !subId}>
                      {test.isPending && <Loader2 className="size-3.5 animate-spin" />}
                      {test.isPending ? "Testing…" : "Run end-to-end test"}
                    </Button>

                    {test.data && (
                      <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
                        <Health
                          ok={test.data.ok}
                          label={test.data.generated ? "Generated signed_request accepted" : "Pasted signed_request accepted"}
                          detail={`HTTP ${test.data.status} · ${test.data.ms}ms`}
                        />
                        <p>
                          <span className="text-muted-foreground">Meta user id: </span>
                          <span className="font-mono">{test.data.decodedUserId ?? "—"}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">confirmation_code: </span>
                          <span className="font-mono">{test.data.confirmationCode ?? "—"}</span>
                          <CopyField value={test.data.confirmationCode ?? ""} label="confirmation code" />
                        </p>
                        {test.data.statusUrl && (
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">Status URL: </span>
                            <a className="truncate underline" href={test.data.statusUrl}>
                              {test.data.statusUrl}
                            </a>
                            <CopyField value={test.data.statusUrl} label="status URL" />
                          </p>
                        )}
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">Raw response</summary>
                          <pre className="mt-2 overflow-auto rounded bg-secondary p-2 font-mono text-[10px]">
                            {test.data.raw}
                          </pre>
                        </details>
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">signed_request used</summary>
                          <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-secondary p-2 font-mono text-[10px]">
                            {test.data.signedRequest}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </ConsoleSection>
              </>
            }
            side={
              <>
                <ConsoleSection title="Live health check" hint="Auto-checked">
                  <div className="space-y-2">
                    <Health
                      ok={d.health.privacy.ok}
                      label="Privacy Policy page"
                      detail={`HTTP ${d.health.privacy.status} · ${d.health.privacy.ms}ms`}
                    />
                    <Health
                      ok={d.health.terms.ok}
                      label="Terms of Service page"
                      detail={`HTTP ${d.health.terms.status} · ${d.health.terms.ms}ms`}
                    />
                    <Health
                      ok={d.health.callback.ok}
                      label="Data deletion callback"
                      detail={`HTTP ${d.health.callback.status} · ${d.health.callback.ms}ms`}
                    />
                    <Health ok={d.config.appIdConfigured} label="App ID configured" />
                    <Health ok={d.config.appSecretConfigured} label="App Secret configured" />
                  </div>
                </ConsoleSection>

                <ConsoleSection title="Last successful callback">
                  {d.lastSuccessfulCallbackAt ? (
                    <div className="space-y-2 text-xs">
                      <ConsoleStat label="When" value={new Date(d.lastSuccessfulCallbackAt).toLocaleString()} />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Confirmation code:</span>
                        <span className="font-mono">{d.lastSuccessfulCode}</span>
                        <CopyField value={d.lastSuccessfulCode ?? ""} label="confirmation code" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No deletion callback has completed yet. Run the tester to verify the endpoint.
                    </p>
                  )}
                  {d.recent.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                      {d.recent.map((r) => (
                        <li key={r.confirmation_code} className="truncate font-mono">
                          {new Date(r.created_at).toLocaleDateString()} · {r.status} · {r.confirmation_code}
                        </li>
                      ))}
                    </ul>
                  )}
                </ConsoleSection>

                <ConsoleTips
                  items={[
                    "All four URLs must resolve over HTTPS before Meta will approve the app.",
                    "Run the tester after any App Secret rotation to confirm signatures still verify.",
                    "The deletion callback must respond within a few seconds or Meta treats it as failed.",
                  ]}
                />
              </>
            }
          />
        )}
      </PageBody>
    </AppShell>
  );
}
