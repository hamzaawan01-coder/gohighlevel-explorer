import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Landing page for the mail sign-in popup. It only forwards the one-time code
 * back to the window that opened it — the mail credential itself is exchanged
 * and stored on the server, never here.
 */
export const Route = createFileRoute("/oauth/mailbox/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finishing mailbox sign-in | Lead Convert" },
      { name: "description", content: "Completing the connection to your email account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MailboxOAuthReturn,
});

function MailboxOAuthReturn() {
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "mailboxOAuthComplete" | "mailboxOAuthFailed",
      code?: string | null,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: params.get("connector_id"), code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Sign-in did not complete. You can close this window.");
      notify("mailboxOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      setMessage("Sign-in completed but no confirmation was returned.");
      notify("mailboxOAuthFailed");
      return;
    }
    setMessage("Connected. You can close this window.");
    notify("mailboxOAuthComplete", code);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
