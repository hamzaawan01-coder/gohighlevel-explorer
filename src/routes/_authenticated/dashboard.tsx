import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutGrid,
  Users,
  Calendar,
  MessageSquare,
  Workflow,
  Settings,
  Search,
  Bell,
  ChevronsUpDown,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Agency Engine — CRM, Pipelines, Conversations" },
      {
        name: "description",
        content:
          "Multi-tenant CRM, sales pipelines, email/SMS conversations and calendar bookings — all in one operator dashboard.",
      },
      { property: "og:title", content: "Agency Engine — Operator Dashboard" },
      {
        property: "og:description",
        content:
          "Run your agency on a single dense, fast operator surface: contacts, deals, inbox, calendar.",
      },
    ],
  }),
  component: Dashboard,
});

type NavItem = { label: string; icon: React.ComponentType<{ className?: string }>; active?: boolean };

const salesNav: NavItem[] = [
  { label: "Pipelines", icon: LayoutGrid, active: true },
  { label: "Contacts", icon: Users },
  { label: "Calendar", icon: Calendar },
  { label: "Conversations", icon: MessageSquare },
];

const automationNav: NavItem[] = [
  { label: "Workflows", icon: Workflow },
  { label: "Settings", icon: Settings },
];

type Deal = {
  id: string;
  title: string;
  value: number;
  tag: { label: string; tone: "blue" | "orange" | "green" | "purple" };
  lastContact?: string;
  badges?: string[];
};

type Column = { title: string; deals: Deal[] };

const board: Column[] = [
  {
    title: "New Leads",
    deals: [
      {
        id: "DL-492",
        title: "Apex Systems Retainer",
        value: 12000,
        tag: { label: "Cold Outbound", tone: "blue" },
        lastContact: "Last contact 2h ago",
      },
      {
        id: "DL-488",
        title: "Modern Loft Interiors",
        value: 4500,
        tag: { label: "Referral", tone: "orange" },
      },
      {
        id: "DL-485",
        title: "Northwind Coffee Co.",
        value: 2800,
        tag: { label: "Cold Outbound", tone: "blue" },
        lastContact: "Last contact yesterday",
      },
    ],
  },
  {
    title: "Qualified",
    deals: [
      {
        id: "DL-481",
        title: "Venture Path Media",
        value: 8200,
        tag: { label: "Inbound", tone: "green" },
        badges: ["Priority", "Q3"],
      },
      {
        id: "DL-479",
        title: "Helio Solar Installs",
        value: 10000,
        tag: { label: "Inbound", tone: "green" },
      },
    ],
  },
  {
    title: "Demo Scheduled",
    deals: [
      {
        id: "DL-472",
        title: "Global Logistics Hub",
        value: 25000,
        tag: { label: "Enterprise", tone: "purple" },
        lastContact: "Demo Thu 2pm",
      },
    ],
  },
  {
    title: "Closing",
    deals: [],
  },
];

const tagTone: Record<Deal["tag"]["tone"], string> = {
  blue: "bg-blue-50 text-blue-700",
  orange: "bg-orange-50 text-orange-700",
  green: "bg-green-50 text-green-700",
  purple: "bg-purple-50 text-purple-700",
};

type Thread = {
  name: string;
  time: string;
  preview: string;
  body?: string;
  channel: "SMS" | "Email";
  unread?: boolean;
};

const threads: Thread[] = [
  {
    name: "Marcus Aurelius",
    time: "14:02",
    preview: "Just sent over the signed proposal…",
    body: "I noticed a typo in the payment terms on page 4, let's fix that before EOD.",
    channel: "Email",
    unread: true,
  },
  {
    name: "Sarah Jenkins",
    time: "12:45",
    preview: "Confirmed for tomorrow at 10 AM",
    body: "Looking forward to seeing the platform walkthrough.",
    channel: "SMS",
    unread: true,
  },
  {
    name: "David Wu",
    time: "Yesterday",
    preview: "Re: Security Questionnaire",
    channel: "Email",
  },
  {
    name: "Priya Shah",
    time: "Yesterday",
    preview: "Thanks — invoice received.",
    channel: "Email",
  },
];

function formatMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

function columnTotal(deals: Deal[]) {
  return deals.reduce((sum, d) => sum + d.value, 0);
}

function Dashboard() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <button className="w-full flex items-center gap-3 px-2 py-1.5 bg-card ring-1 ring-black/5 rounded-md hover:bg-card/80 transition-colors text-left">
            <div className="size-6 bg-accent rounded flex items-center justify-center text-[10px] text-accent-foreground font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">Agency Engine</p>
              <p className="text-[10px] text-muted-foreground truncate">Workspace: Global</p>
            </div>
            <ChevronsUpDown className="size-3 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <NavGroup label="Sales" items={salesNav} />
          <NavGroup label="Automations" items={automationNav} />
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="size-8 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center text-[10px] font-semibold text-accent-foreground">
              SC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Sarah Chen</p>
              <p className="text-[10px] text-muted-foreground">Pro Operator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-full max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search records…"
                className="w-full bg-secondary border border-border rounded-md py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground bg-card border border-border rounded px-1.5 py-0.5">
                /
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2 bg-accent rounded-full animate-pulse" />
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Live Sync
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <button className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
              <Bell className="size-3.5 text-muted-foreground" />
            </button>
            <button className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus className="size-3.5" />
              New Deal
            </button>
          </div>
        </header>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex gap-6 h-full min-w-max">
            {board.map((col, ci) => (
              <div key={col.title} className="w-72 flex flex-col">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest">
                      {col.title}
                    </h3>
                    <span className="font-mono text-[10px] bg-secondary px-1.5 rounded">
                      {String(col.deals.length).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {formatMoney(columnTotal(col.deals))}
                  </div>
                </div>

                {col.deals.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-lg flex-1 min-h-32 flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Drop here
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto pr-1">
                    {col.deals.map((deal, di) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        delay={ci * 60 + di * 60}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Right Rail */}
      <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
        <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider">Inbox</h2>
          <span className="font-mono text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            {threads.filter((t) => t.unread).length} Unread
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.map((t) => (
            <ThreadRow key={t.name} thread={t} />
          ))}
        </div>

        <div className="p-4 bg-secondary/50 border-t border-border">
          <div className="bg-card ring-1 ring-black/5 rounded p-3">
            <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">
              Quick Note
            </p>
            <textarea
              placeholder="Draft internal note…"
              className="w-full text-xs bg-transparent border-none resize-none focus:outline-none min-h-[60px]"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="px-3 mb-4">
      <p className="px-3 mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href="#"
              className={
                item.active
                  ? "flex items-center gap-3 px-3 py-1.5 text-sm font-medium rounded-md bg-sidebar-accent text-sidebar-accent-foreground"
                  : "flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 rounded-md transition-colors"
              }
            >
              <Icon className="size-3.5" />
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, delay }: { deal: Deal; delay: number }) {
  return (
    <div
      className="animate-card-entry bg-card p-3 rounded-lg ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:ring-accent/40 transition-all cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          #{deal.id}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${tagTone[deal.tag.tone]}`}
        >
          {deal.tag.label}
        </span>
      </div>
      <h4 className="text-sm font-semibold mb-2">{deal.title}</h4>
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-medium text-accent">
          ${deal.value.toLocaleString()}
        </p>
        <div className="size-5 rounded bg-secondary" />
      </div>
      {(deal.lastContact || deal.badges) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
          {deal.lastContact && (
            <>
              <div className="size-4 rounded-full bg-secondary" />
              <span className="text-[10px] text-muted-foreground">
                {deal.lastContact}
              </span>
            </>
          )}
          {deal.badges?.map((b) => (
            <span
              key={b}
              className="text-[9px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground"
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <div className="p-4 border-b border-border hover:bg-secondary/40 cursor-pointer relative">
      {thread.unread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r" />
      )}
      <div className="flex justify-between mb-1">
        <span className="text-xs font-semibold">{thread.name}</span>
        <span
          className={`font-mono text-[10px] ${thread.unread ? "text-accent" : "text-muted-foreground"}`}
        >
          {thread.time}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] bg-secondary px-1 rounded uppercase font-bold text-muted-foreground">
          {thread.channel}
        </span>
        <p
          className={`text-xs truncate ${thread.unread ? "font-bold text-foreground" : "text-muted-foreground"}`}
        >
          {thread.preview}
        </p>
      </div>
      {thread.body && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
          {thread.body}
        </p>
      )}
    </div>
  );
}
