import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import {
  ArrowRight,
  Users,
  LayoutGrid,
  MessageSquare,
  Calendar,
  Workflow,
  Phone,
  Sparkles,
  Zap,
  Check,
  MousePointerClick,
  Timer,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lead Convert | AI CRM that turns enquiries into booked meetings" },
      {
        name: "description",
        content:
          "Lead Convert captures leads from Meta and web forms, replies over SMS, WhatsApp, email and Messenger, and books the meeting automatically — all in one CRM workspace.",
      },
      {
        property: "og:title",
        content: "Lead Convert | AI CRM that turns enquiries into booked meetings",
      },
      {
        property: "og:description",
        content:
          "Capture leads, reply on every channel, automate follow-up and book meetings from one workspace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Lead Convert",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://leadsconvert.co.uk/",
          description:
            "CRM for capturing leads, replying across SMS, WhatsApp, email and Messenger, automating follow-up and booking meetings.",
        }),
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: MousePointerClick,
    kicker: "Capture",
    title: "Every enquiry lands in one place",
    body: "Meta Lead Ads, Facebook and Instagram DMs, your website forms and inbound calls all create the same clean contact record — with the source attached.",
    points: ["Meta Lead Ads sync", "Website & WordPress forms", "Inbound calls and texts"],
  },
  {
    icon: Inbox,
    kicker: "Respond",
    title: "One thread per person, every channel",
    body: "SMS, WhatsApp, email and Messenger in a single conversation. AI drafts a reply from your own FAQs; your team approves it before anything sends.",
    points: ["Unified inbox", "AI-suggested replies", "Templates with merge tags"],
  },
  {
    icon: Timer,
    kicker: "Convert",
    title: "Follow-up that never gets forgotten",
    body: "New lead, stage moved, no reply after a day — automations send the right message at the right time, inside your quiet hours, then hand over a booking link.",
    points: ["Stage-based automations", "Quiet hours & scheduling", "Booking links with reminders"],
  },
];

const MODULES = [
  { icon: Users, label: "Contacts & CRM" },
  { icon: LayoutGrid, label: "Pipelines" },
  { icon: MessageSquare, label: "Unified inbox" },
  { icon: Phone, label: "Phone & softphone" },
  { icon: Workflow, label: "Automations" },
  { icon: Calendar, label: "Booking pages" },
  { icon: Sparkles, label: "AI reply drafts" },
  { icon: Zap, label: "Invoicing" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 text-center sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              AI-assisted CRM for lead-driven teams
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
              Turn every enquiry into a{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                booked meeting
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Lead Convert brings your ads, DMs, forms, calls, follow-up and calendar into one
              workspace — so nobody waits for a reply and nothing slips through the pipeline.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/contact"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
              >
                Book a demo <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/features"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary sm:w-auto"
              >
                Explore the platform
              </Link>
            </div>

            {/* Module strip — what's actually inside */}
            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
              {MODULES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2.5 text-left text-xs font-medium"
                >
                  <Icon className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Three pillars ────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Capture, respond, convert — without switching tabs.
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {PILLARS.map(({ icon: Icon, kicker, title, body, points }, i) => (
              <article
                key={title}
                className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    0{i + 1} · {kicker}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">{title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
                <ul className="space-y-2 lg:w-56">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── Built-in channels ────────────────────────────── */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Connected, not bolted on
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Your own accounts, your own numbers.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Connect your own Facebook, messaging and payment accounts in a few clicks. Buy phone
                numbers inside the CRM, call from the browser, and keep every message and receipt on
                the contact record.
              </p>
              <Link
                to="/features"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                See every module <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Facebook & Instagram", "Lead Ads, Messenger and DMs routed straight to the inbox."],
                ["SMS & WhatsApp", "Send from your own numbers, with templates and quiet hours."],
                ["Email", "Threaded conversations, templates and automated sequences."],
                ["Card payments", "Invoices with pay links and automatic receipt reconciliation."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display text-sm font-bold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div
            className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-16"
            style={{ background: "var(--gradient-primary)" }}
          >
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-4xl">
              Stop losing leads to a slow reply.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-primary-foreground/85">
              Book a walkthrough and we will set your first capture-to-booking flow up with you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/contact"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-card/90 sm:w-auto"
              >
                Book a demo <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/pricing"
                className="flex w-full items-center justify-center rounded-full border border-primary-foreground/40 px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
