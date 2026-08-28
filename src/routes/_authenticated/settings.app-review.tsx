import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CopyField } from "@/components/CopyField";
import { useModules } from "@/lib/modules";
import { getAppReviewStatus, testDataDeletionCallback } from "@/lib/meta-review.functions";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";

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
        <CheckCircle2 className="size-3.5 text-emerald-500" />
      ) : (
        <XCircle className="size-3.5 text-destructive" />
      )}
      <span className="font-medium">{label}</span>
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </div>
  );
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">{label}</p>
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

  return (
    <AppShell>
      <div className="max-w-3xl p-6 space-y-8">
        <header>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-4" />
            Meta App Review readiness
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            These are the exact URLs to paste into the Meta App Dashboard, with a live check that each one
            responds correctly.
          </p>
        </header>

        {status.isLoading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Running health checks…
          </p>
        )}
        {status.error && (
          <p className="text-xs text-destructive">{(status.error as Error).message}</p>
        )}

        {d && (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-bold">Required URLs</h2>
              <UrlRow label="Privacy Policy URL" url={d.urls.privacyPolicyUrl} />
              <UrlRow label="Terms of Service URL" url={d.urls.termsUrl} />
              <UrlRow label="Data Deletion Callback URL" url={d.urls.dataDeletionCallbackUrl} />
              <UrlRow label="Deletion status page" url={d.urls.dataDeletionStatusUrl} />
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold">Live health check</h2>
              <div className="space-y-1.5 rounded-md border border-border p-3">
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
                  detail={`HTTP ${d.health.callback.status} on unknown code · ${d.health.callback.ms}ms`}
                />
                <Health ok={d.config.appIdConfigured} label="App ID configured" />
                <Health ok={d.config.appSecretConfigured} label="App Secret configured" />
              </div>
              <button
                type="button"
                onClick={() => void status.refetch()}
                disabled={status.isFetching}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {status.isFetching ? "Re-checking…" : "Re-run health check"}
              </button>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold">Last successful callback</h2>
              {d.lastSuccessfulCallbackAt ? (
                <div className="rounded-md border border-border p-3 text-xs">
                  <p>
                    <span className="text-muted-foreground">When: </span>
                    {new Date(d.lastSuccessfulCallbackAt).toLocaleString()}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Confirmation code: </span>
                    <span className="font-mono">{d.lastSuccessfulCode}</span>
                    <CopyField value={d.lastSuccessfulCode ?? ""} label="confirmation code" />
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No deletion callback has completed yet. Run the tester below to verify the endpoint.
                </p>
              )}
              {d.recent.length > 0 && (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {d.recent.map((r) => (
                    <li key={r.confirmation_code} className="font-mono">
                      {new Date(r.created_at).toLocaleString()} · {r.status} · {r.confirmation_code}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <FlaskConical className="size-3.5" />
                Deletion callback tester
              </h2>
              <p className="text-xs text-muted-foreground">
                Paste a real <span className="font-mono">signed_request</span> from Meta, or leave it blank to
                generate a valid test one signed with your App Secret. The request is sent to the live
                endpoint and the returned confirmation code is shown below.
              </p>
              <textarea
                value={signedRequest}
                onChange={(e) => setSignedRequest(e.target.value)}
                rows={3}
                placeholder="signed_request (optional)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                value={metaUserId}
                onChange={(e) => setMetaUserId(e.target.value)}
                placeholder="Meta user id for generated test (optional)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={test.isPending || !subId}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {test.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {test.isPending ? "Testing…" : "Run end-to-end test"}
              </button>

              {test.data && (
                <div className="space-y-1.5 rounded-md border border-border p-3 text-xs">
                  <Health
                    ok={test.data.ok}
                    label={test.data.generated ? "Generated signed_request accepted" : "Pasted signed_request accepted"}
                    detail={`HTTP ${test.data.status} · ${test.data.ms}ms`}
                  />
                  <p>
                    <span className="text-muted-foreground">Meta user id: </span>
                    <span className="font-mono">{test.data.decodedUserId ?? "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">confirmation_code: </span>
                    <span className="font-mono">{test.data.confirmationCode ?? "—"}</span>
                    <CopyField value={test.data.confirmationCode ?? ""} label="confirmation code" />
                  </p>
                  {test.data.statusUrl && (
                    <p className="flex items-center gap-2">
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
                    <pre className="mt-2 break-all whitespace-pre-wrap rounded bg-secondary p-2 font-mono text-[10px]">
                      {test.data.signedRequest}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
