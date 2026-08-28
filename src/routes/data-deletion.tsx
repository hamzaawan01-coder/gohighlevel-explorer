import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type Status = { found: boolean; confirmation_code?: string; status?: string; created_at?: string };

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Data Deletion Status | Click Away Finance CRM" },
      {
        name: "description",
        content:
          "Check the status of a data deletion request for Click Away Finance CRM, including Facebook and Instagram messaging data.",
      },
      { property: "og:title", content: "Data Deletion Status | Click Away Finance CRM" },
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
    try {
      const res = await fetch(`/api/public/meta/data-deletion?code=${encodeURIComponent(value)}`);
      setStatus((await res.json()) as Status);
    } catch {
      setStatus({ found: false });
    } finally {
      setLoading(false);
    }
  }

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
          placeholder="Confirmation code"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check status"}
        </button>
      </form>

      {status && (
        <div className="mt-8 rounded-lg border border-border p-4 text-sm">
          {status.found ? (
            <>
              <p className="font-medium">Request {status.status ?? "completed"}</p>
              <p className="mt-1 text-muted-foreground">Confirmation code: {status.confirmation_code}</p>
              {status.created_at && (
                <p className="text-muted-foreground">
                  Received: {new Date(status.created_at).toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              No request found for that code. Check the code and try again.
            </p>
          )}
        </div>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        To request deletion directly, email{" "}
        <a className="underline" href="mailto:info@clickawayfinance.com">
          info@clickawayfinance.com
        </a>
        . See our{" "}
        <a className="underline" href="/privacy">
          Privacy Policy
        </a>{" "}
        for more detail.
      </p>
    </main>
  );
}
