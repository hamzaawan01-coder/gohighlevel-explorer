import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid, Users, Calendar, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lead Convert | AI CRM for Your Business" },
      {
        name: "description",
        content:
          "Lead Convert is an AI CRM for your business: capture leads from Meta and web forms, run pipelines, reply over SMS, WhatsApp and email, and book appointments automatically.",
      },
      { property: "og:title", content: "Lead Convert | AI CRM for Your Business" },
      {
        property: "og:description",
        content:
          "Capture leads, run pipelines, reply across SMS, WhatsApp and email, and book appointments automatically.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadsconvert.co.uk/" },
    ],
    links: [{ rel: "canonical", href: "https://leadsconvert.co.uk/" }],
  }),
  component: Landing,
});

const features = [
  { icon: Users, title: "CRM", desc: "Contacts, tags, smart segments." },
  { icon: LayoutGrid, title: "Pipelines", desc: "Kanban deals with drag-drop stages." },
  { icon: MessageSquare, title: "Conversations", desc: "Email + SMS in one inbox." },
  { icon: Calendar, title: "Calendar", desc: "Booking pages with sync." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 bg-accent rounded flex items-center justify-center text-xs font-bold text-accent-foreground">
              A
            </div>
            <span className="font-bold tracking-tight">Agency Engine</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              to="/auth"
              className="bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              Get started <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-24">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
          Operator OS · v1.0
        </p>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">
          The operator dashboard your agency actually wants.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          CRM, sales pipelines, email & SMS conversations, and calendar bookings —
          all in one dense, keyboard-fast surface built for power users.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/auth"
            className="bg-primary text-primary-foreground rounded-md py-2.5 px-5 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            className="border border-border bg-card hover:bg-secondary rounded-md py-2.5 px-5 text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-lg p-5 hover:border-accent/40 transition-colors"
            >
              <Icon className="size-5 text-accent mb-3" />
              <h3 className="font-semibold mb-1 text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>© Agency Engine</span>
          <span>Live Sync</span>
        </div>
      </footer>
    </div>
  );
}
