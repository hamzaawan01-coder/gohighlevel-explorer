import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ArrowRight, Mail, MessageSquare, CalendarCheck, Check } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Book a demo — Lead Convert CRM" },
      {
        name: "description",
        content:
          "Book a walkthrough of Lead Convert: tell us where your leads come from and we will show how capture, follow-up and booking work in one workspace.",
      },
      { property: "og:title", content: "Book a demo — Lead Convert CRM" },
      {
        property: "og:description",
        content:
          "Tell us about your lead sources and we will show you the fastest route from enquiry to booked meeting.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/contact" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/contact" }],
  }),
  component: ContactPage,
});

const INBOX = "hello@leadsconvert.co.uk";

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sent, setSent] = useState(false);

  /** No public write path is exposed here — the enquiry opens in the sender's own mail client. */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `Name: ${form.name}`,
      `Company: ${form.company}`,
      `Email: ${form.email}`,
      "",
      form.message,
    ].join("\n");
    window.location.href = `mailto:${INBOX}?subject=${encodeURIComponent(
      `Demo request — ${form.company || form.name}`,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const field =
    "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Contact</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            See it running on your own leads.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Tell us where your enquiries come from today — ads, web forms, DMs, referrals — and we
            will show the shortest path from first message to booked meeting.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CalendarCheck className="size-4 text-primary" />
              </span>
              <span>
                <b className="block">A 30-minute walkthrough</b>
                <span className="text-muted-foreground">No slides — we open the product.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="size-4 text-primary" />
              </span>
              <span>
                <b className="block">Your channels, mapped</b>
                <span className="text-muted-foreground">
                  We check what connects today and what needs setup.
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-4 text-primary" />
              </span>
              <span>
                <b className="block">Prefer email?</b>
                <a className="text-primary hover:underline" href={`mailto:${INBOX}`}>
                  {INBOX}
                </a>
              </span>
            </li>
          </ul>

          <p className="mt-8 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Sign in here
            </Link>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Check className="size-5 text-primary" />
              </span>
              <h2 className="font-display text-lg font-bold">Your email is ready to send</h2>
              <p className="text-sm text-muted-foreground">
                We opened your mail app with the details filled in. Send it and we will reply the
                same working day. If nothing opened, email us at{" "}
                <a className="text-primary hover:underline" href={`mailto:${INBOX}`}>
                  {INBOX}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Edit my details
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="font-display text-lg font-bold">Book a demo</h2>
              <div>
                <label className="text-xs font-medium" htmlFor="c-name">
                  Your name
                </label>
                <input
                  id="c-name"
                  required
                  className={field}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium" htmlFor="c-email">
                  Work email
                </label>
                <input
                  id="c-email"
                  type="email"
                  required
                  className={field}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium" htmlFor="c-company">
                  Company
                </label>
                <input
                  id="c-company"
                  className={field}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium" htmlFor="c-message">
                  Where do your leads come from today?
                </label>
                <textarea
                  id="c-message"
                  rows={4}
                  className={field}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Request a demo <ArrowRight className="size-4" />
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
