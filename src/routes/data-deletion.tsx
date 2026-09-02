import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle, Loader2, Copy, Check } from "lucide-react";

type Status = {
  found: boolean;
  confirmation_code?: string;
  status?: string;
  created_at?: string;
};

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Data Deletion Status | Leads Convert CRM" },
      {
        name: "description",
        content:
          "Check the status of a data deletion request for Leads Convert CRM, including Facebook and Instagram messaging data.",
      },
      { property: "og:title", content: "Data Deletion Status | Leads Convert CRM" },
      {
        property: "og:description",
        content: "Look up a data deletion confirmation code and see the status of your request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("code");
    if (initial) {
      setCode(initial);
      void lookup(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(value: string) {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/public/meta/data-deletion?code=${encodeURIComponent(value)}`);
      if (res.status === 404) {
        setStatus({ found: false });
      } else if (!res.ok) {
        setError("We couldn't check that code right now. Please try again in a moment.");
      } else {
        setStatus((await res.json()) as Status);
      }
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const resultText = status?.found
    ? [
        `Data deletion request: ${status.status ?? "completed"}`,
        `Confirmation code: ${status.confirmation_code ?? ""}`,
        status.created_at ? `Received: ${new Date(status.created_at).toLocaleString()}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(resultText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = resultText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const isCompleted = (status?.status ?? "completed") === "completed";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Data deletion status</h1>
      <p className="mt-4 text-muted-foreground">
        When you request deletion of your data from Facebook or Instagram, we remove the messaging data we
        stored for your account and issue a confirmation code. Enter that code below to check the status of
        your request.
      </p>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void lookup(code.trim());
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Confirmation code, e.g. del_abc123"
          aria-label="Confirmation code"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Checking…" : "Check status"}
        </button>
      </form>

      {error && (
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>{error}</p>
        </div>
      )}

      {status && !error && (
        <div className="mt-8 rounded-lg border border-border p-4 text-sm">
          {status.found ? (
            <>
              <div className="flex items-start gap-3">
                {isCompleted ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {isCompleted
                      ? "Your data has been deleted."
                      : `Your request is ${status.status ?? "in progress"}.`}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {isCompleted
                      ? "We removed the messaging data stored for your account in our CRM. Nothing further is needed from you."
                      : "We have received your request and are processing it. Check back shortly."}
                  </p>
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>
                      <dt className="inline">Confirmation code: </dt>
                      <dd className="inline font-mono text-foreground">{status.confirmation_code}</dd>
                    </div>
                    {status.created_at && (
                      <div>
                        <dt className="inline">Received: </dt>
                        <dd className="inline">{new Date(status.created_at).toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <button
                  type="button"
                  onClick={() => void copyResult()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy result"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">No request found for that code.</p>
                <p className="mt-1 text-muted-foreground">
                  Double-check the code from your confirmation message, or email us and we'll look it up for
                  you.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        To request deletion directly, email{" "}
        <a className="underline" href="mailto:info@leadsconvert.co.uk">
          info@leadsconvert.co.uk
        </a>
        . See our{" "}
        <Link className="underline" to="/privacy">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link className="underline" to="/terms">
          Terms of Service
        </Link>{" "}
        for more detail.
      </p>
    </main>
  );
}
