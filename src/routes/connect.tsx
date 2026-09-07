import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect an AI assistant — Lead Convert CRM" },
      {
        name: "description",
        content:
          "Step-by-step instructions for connecting ChatGPT, Claude or another AI assistant to your Lead Convert CRM so it can look up contacts, leads and messages.",
      },
      { property: "og:title", content: "Connect an AI assistant — Lead Convert CRM" },
      {
        property: "og:description",
        content:
          "Copy your connection link and follow the click-by-click steps for ChatGPT, Claude, Claude Code and other assistants.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/connect" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/connect" }],
  }),
  component: ConnectPage,
});

const APP_NAME = "Lead Convert CRM";
const SERVER_SLUG = "lead-convert-crm";

function CopyRow({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 overflow-x-auto rounded-lg bg-secondary px-3 py-2 text-sm">
          {value || "…"}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-base font-bold">{title}</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function ConnectPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const mcpUrl = origin ? new URL("/mcp", origin).toString() : "";
  const installCommand = `claude mcp add --scope user --transport http ${SERVER_SLUG} '${mcpUrl}'`;
  const claudeLink = mcpUrl
    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(APP_NAME)}&connectorUrl=${encodeURIComponent(mcpUrl)}`
    : "https://claude.ai/customize/connectors";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-5 pb-8 pt-16 sm:pt-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            AI assistants
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Connect an AI assistant to your CRM
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Link ChatGPT, Claude or another assistant to {APP_NAME} and you can ask it to look up
            contacts, check leads and read recent conversations — it signs in as you, so it only
            ever sees your own workspace.
          </p>
        </section>

        <section className="mx-auto max-w-3xl space-y-4 px-5 pb-12">
          <CopyRow label="Your connection link" value={mcpUrl} />
          <p className="text-xs text-muted-foreground">
            Keep this link handy — every assistant below asks for it once.
          </p>
        </section>

        <section className="mx-auto max-w-3xl space-y-4 px-5 pb-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">Set it up</h2>

          <Steps
            title="ChatGPT"
            steps={[
              <>
                Open{" "}
                <a
                  className="text-primary underline"
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noreferrer"
                >
                  ChatGPT settings → Apps (Advanced)
                </a>{" "}
                and switch on Developer mode, reading the risk notice shown there. If you cannot see
                it, ask whoever manages your ChatGPT account to enable it.
              </>,
              <>
                Open{" "}
                <a
                  className="text-primary underline"
                  href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
                  target="_blank"
                  rel="noreferrer"
                >
                  the new plugin form
                </a>
                .
              </>,
              <>
                Type <strong>{APP_NAME}</strong> as the name and paste the connection link above
                into the URL field.
              </>,
              <>
                Review the details, tick “I understand and want to continue” (ChatGPT shows this for
                every custom connection), then click <strong>Create</strong>.
              </>,
              <>Turn it on from the message box in a chat, then ask ChatGPT to use your CRM.</>,
            ]}
          />

          <Steps
            title="Claude"
            steps={[
              <>
                Open{" "}
                <a className="text-primary underline" href={claudeLink} target="_blank" rel="noreferrer">
                  Claude’s custom connector form
                </a>{" "}
                — the name and link are filled in for you.
              </>,
              <>
                Check the details and click <strong>Add</strong>.
              </>,
              <>
                If the form does not open, go to Claude → Connectors → “Add custom connector”, name
                it {APP_NAME} and paste the connection link.
              </>,
              <>Enable the connector in the message box, then ask Claude to use your CRM.</>,
            ]}
          />

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-base font-bold">Claude Code</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Run this once in a terminal:</li>
            </ol>
            <div className="mt-3">
              <CopyRow label="Install command" value={installCommand} />
            </div>
            <ol
              start={2}
              className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground"
            >
              <li>
                Start Claude Code and run <code>/mcp</code> to confirm {APP_NAME} is connected,
                signing in when it asks.
              </li>
              <li>Ask Claude Code to use your CRM.</li>
            </ol>
          </div>

          <Steps
            title="Other AI assistants"
            steps={[
              <>Open the assistant’s connector or MCP server settings.</>,
              <>Create a new remote connection.</>,
              <>Name it {APP_NAME} and paste the connection link above.</>,
              <>Finish any sign-in prompt so it connects as you.</>,
              <>Enable the connection, then ask the assistant to use your CRM.</>,
            ]}
          />
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-3xl space-y-4 px-5 py-14">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              After we ship an update
            </h2>
            <p className="text-sm text-muted-foreground">
              Assistants remember what your CRM could do when you first connected it, so refresh the
              connection after an update.
            </p>

            <Steps
              title="ChatGPT"
              steps={[
                <>Open ChatGPT’s Plugins page and pick {APP_NAME}.</>,
                <>
                  Scroll to “Information” and click <strong>Refresh</strong>.
                </>,
                <>
                  If the link above has changed, delete the app in Plugins and add it again with the
                  new link.
                </>,
                <>Start a new chat and ask ChatGPT to use your CRM.</>,
              ]}
            />

            <Steps
              title="Claude"
              steps={[
                <>Open the Connectors page and select {APP_NAME}.</>,
                <>Refresh or update the connector.</>,
                <>
                  If the link above has changed, remove the connector and add it again with the new
                  link.
                </>,
                <>Ask Claude to use your CRM.</>,
              ]}
            />

            <Steps
              title="Claude Code"
              steps={[
                <>Start a new Claude Code session — it picks up the latest version on connect.</>,
                <>
                  If the link changed, run <code>claude mcp remove {SERVER_SLUG}</code> and run the
                  install command again.
                </>,
                <>Ask Claude Code to use your CRM.</>,
              ]}
            />

            <Steps
              title="Other AI assistants"
              steps={[
                <>Open the assistant’s connector settings and pick the {APP_NAME} connection.</>,
                <>Refresh, reload or reconnect it.</>,
                <>Paste the latest link above if it changed.</>,
                <>Start a new chat and ask the assistant to use your CRM.</>,
              ]}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
