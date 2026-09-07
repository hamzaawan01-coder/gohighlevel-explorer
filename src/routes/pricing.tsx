import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Lead Convert CRM" },
      {
        name: "description",
        content:
          "Lead Convert plans are built around the modules your team actually uses. Compare Starter, Growth and Agency, then book a walkthrough to get a quote.",
      },
      { property: "og:title", content: "Pricing — Lead Convert CRM" },
      {
        property: "og:description",
        content:
          "Starter, Growth and Agency plans — pick the modules your team uses and get a quote on a short call.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/pricing" }],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Starter",
    tagline: "For a small team getting leads under control.",
    price: null,
    features: [
      "Contacts & pipelines",
      "Web lead forms",
      "Email + SMS inbox",
      "Booking pages",
      "1 workspace",
    ],
    featured: false,
    cta: { label: "Get a quote", to: "/contact" as const },
  },
  {
    name: "Growth",
    tagline: "For teams running paid ads and following up fast.",
    price: "£97",
    features: [
      "Everything in Starter",
      "Meta Lead Ads & Messenger",
      "WhatsApp + phone system",
      "Automations & templates",
      "AI reply drafts",
      "Invoicing",
    ],
    featured: true,
    cta: { label: "Start on Growth", to: "/settings/subscriptions" as const },
  },
  {
    name: "Agency",
    tagline: "For agencies running client workspaces.",
    price: null,
    features: [
      "Everything in Growth",
      "Multiple client workspaces",
      "Per-plan module gating",
      "Subscription & approval flow",
      "Audit logs and roles",
    ],
    featured: false,
    cta: { label: "Get a quote", to: "/contact" as const },
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center sm:pt-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Pay for the modules you use, nothing else.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Every plan is assembled from the same platform — we switch on the modules your team
            needs and quote it on a short call, so you are never paying for a module nobody opens.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((p) => (
              <article
                key={p.name}
                className={`flex flex-col rounded-2xl border p-7 ${
                  p.featured
                    ? "border-primary bg-card shadow-[var(--shadow-glow)]"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">{p.name}</h2>
                  {p.featured && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
                <p className="mt-5 font-display text-3xl font-bold tracking-tight">
                  {p.price ? (
                    <>
                      {p.price}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        per month
                      </span>
                    </>
                  ) : (
                    <span className="text-xl">Quoted</span>
                  )}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={p.cta.to}
                  className={`mt-7 flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    p.featured
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border hover:bg-secondary"
                  }`}
                >
                  {p.cta.label} <ArrowRight className="size-3.5" />
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Calls, SMS and WhatsApp are billed at your own provider's rates through your connected
            account — we do not mark them up.
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-14 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Not sure which plan fits?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tell us where your leads come from today and we will map it to the smallest plan that
              covers it.
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Talk to us <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
