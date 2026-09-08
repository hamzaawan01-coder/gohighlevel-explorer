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
    const opener = window.opener as Window | null;

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Sign-in did not complete. You can close this window.");
      opener?.postMessage({ type: "mailboxOAuthFailed", code: null }, window.location.origin);
      if (opener) window.close();
      return;
    }
    const code = params.get("code");
    if (!code) {
      setMessage("Sign-in completed but no confirmation was returned.");
      opener?.postMessage({ type: "mailboxOAuthFailed", code: null }, window.location.origin);
      if (opener) window.close();
      return;
    }

    if (opener) {
      setMessage("Connected. You can close this window.");
      opener.postMessage({ type: "mailboxOAuthComplete", code }, window.location.origin);
      window.close();
      return;
    }

    // Opened as a standalone tab: finish the link here, then go to the mailbox.
    void (async () => {
      try {
        const { completeMailboxConnect } = await import("@/lib/mailbox.functions");
        await completeMailboxConnect({ data: { code } });
        setMessage("Connected. Taking you to your mailbox…");
      } catch {
        setMessage("We could not finish connecting. Please try again from the Mailbox page.");
      }
      window.location.replace("/mailbox");
    })();
  }, []);


  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
