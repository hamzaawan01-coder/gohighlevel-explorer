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
  FileText,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Facebook,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Platform — Lead Convert CRM" },
      {
        name: "description",
        content:
          "Every module in Lead Convert: CRM and pipelines, unified inbox for SMS, WhatsApp, email and Messenger, calling, automations, booking pages, invoices and AI reply drafts.",
      },
      { property: "og:title", content: "Platform — Lead Convert CRM" },
      {
        property: "og:description",
        content:
          "CRM, pipelines, unified inbox, calling, automations, booking, invoicing and AI drafts in one workspace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/features" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/features" }],
  }),
  component: FeaturesPage,
});

const MODULES = [
  {
    icon: Users,
    title: "Contacts & CRM",
    body: "Every lead in one record: source, tags, files, full message history and every appointment they booked.",
  },
  {
    icon: LayoutGrid,
    title: "Pipelines",
    body: "Drag deals through stages your team actually uses. Stage changes can fire messages automatically.",
  },
  {
    icon: MessageSquare,
    title: "Unified inbox",
    body: "SMS, WhatsApp, email, Facebook Messenger and Instagram DMs land in one thread per person.",
  },
  {
    icon: Phone,
    title: "Phone system",
    body: "Buy numbers in-app, call from the browser softphone, and keep call logs on the contact record.",
  },
  {
    icon: Workflow,
    title: "Automations",
    body: "New lead, stage moved, no reply — trigger templated SMS and email with merge tags and quiet hours.",
  },
  {
    icon: Calendar,
    title: "Calendar & booking",
    body: "Share booking links with your real availability, send reminders, and let people reschedule themselves.",
  },
  {
    icon: Facebook,
    title: "Meta Lead Ads",
    body: "Connect your own Facebook, pull Pages and forms, and route each form into the right pipeline stage.",
  },
  {
    icon: FileText,
    title: "Invoices",
    body: "Branded invoices with sequential numbering, card payment links, automatic receipts and reminders.",
  },
  {
    icon: Sparkles,
    title: "AI reply drafts",
    body: "Suggested replies written from your own FAQ knowledge base — your team approves before anything sends.",
  },
  {
    icon: BarChart3,
    title: "Reporting",
    body: "Pipeline value, ad spend from connected ad accounts, and response performance in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & modules",
    body: "Turn modules on or off per workspace, gate them by plan, and keep an audit trail of every change.",
  },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:pt-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Platform</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Everything between “new lead” and “booked meeting”.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Lead Convert replaces the pile of tools most teams stitch together — capture, inbox,
            calling, follow-up, booking and billing all read from the same contact record.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-4 text-primary" />
                </span>
                <h2 className="mt-4 font-display text-base font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-5 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Want to see it on your own pipeline?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We will walk through your lead sources and set the first automation up with you.
              </p>
            </div>
            <Link
              to="/contact"
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Book a demo <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
