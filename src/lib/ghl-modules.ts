/**
 * Catalogue of GoHighLevel modules collected during this build, with the
 * coverage status inside this CRM and the provenance of each entry.
 *
 * `coverage`:
 *  - "covered"  – shipped in this app and reachable from the sidebar
 *  - "partial"  – some capability exists, but not the full GHL feature set
 *  - "unknown"  – catalogued from research only, nothing built yet
 */

export type Coverage = "covered" | "partial" | "unknown";

export type GhlModule = {
  key: string;
  name: string;
  category: string;
  summary: string;
  /** What the module does, in a couple of sentences. */
  details: string;
  coverage: Coverage;
  /** In-app route when we have built an equivalent. */
  appRoute?: string;
  /** Local module key from src/lib/modules.ts (toggleable module). */
  moduleKey?: string;
  provenance: {
    sourceLabel: string;
    sourceUrl: string;
    /** ISO date the entry was last verified. */
    lastChecked: string;
    /** 0-1 — how confident we are in the summary + coverage call. */
    confidence: number;
    method: string;
  };
};

const DOCS = "https://help.gohighlevel.com/support/solutions";

export const GHL_CATEGORIES = [
  "CRM",
  "Pipelines",
  "Messaging",
  "Campaigns",
  "Automation",
  "Scheduling",
  "Sites & Funnels",
  "Payments",
  "Reputation",
  "Reporting",
  "Agency",
  "Platform",
] as const;

export const GHL_MODULES: GhlModule[] = [
  {
    key: "contacts",
    name: "Contacts",
    category: "CRM",
    summary: "Central contact records with custom fields, tags and smart lists.",
    details:
      "Stores every lead and customer with contact details, tags, custom fields, owners and activity history. Supports bulk import/export, deduplication and saved segments.",
    coverage: "covered",
    appRoute: "/contacts",
    moduleKey: "contacts",
    provenance: {
      sourceLabel: "GoHighLevel Help — Contacts",
      sourceUrl: `${DOCS}/folders/48000682363`,
      lastChecked: "2026-08-20",
      confidence: 0.95,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "smart-lists",
    name: "Smart lists & segments",
    category: "CRM",
    summary: "Saved filtered views of contacts that update automatically.",
    details:
      "Filter contacts by tag, stage, source or custom field and save the view for reuse in campaigns and bulk actions.",
    coverage: "partial",
    appRoute: "/contacts",
    moduleKey: "contacts",
    provenance: {
      sourceLabel: "GoHighLevel Help — Smart lists",
      sourceUrl: `${DOCS}/folders/48000682363`,
      lastChecked: "2026-08-20",
      confidence: 0.7,
      method: "Vendor documentation; saved searches shipped, full smart lists pending",
    },
  },
  {
    key: "custom-fields",
    name: "Custom fields & objects",
    category: "CRM",
    summary: "User-defined fields and custom record types on contacts.",
    details:
      "Add typed fields (text, number, date, dropdown, file) to contacts and opportunities, plus custom objects for non-standard records.",
    coverage: "partial",
    provenance: {
      sourceLabel: "GoHighLevel Help — Custom fields",
      sourceUrl: `${DOCS}/articles/48001155787`,
      lastChecked: "2026-08-20",
      confidence: 0.6,
      method: "Vendor documentation; lead answers stored, no field builder yet",
    },
  },
  {
    key: "pipelines",
    name: "Pipelines & opportunities",
    category: "Pipelines",
    summary: "Kanban deal boards with configurable stages and values.",
    details:
      "Multiple pipelines, drag-and-drop stages, monetary value per opportunity, stage-change automation triggers and per-stage totals.",
    coverage: "covered",
    appRoute: "/opportunities",
    moduleKey: "opportunities",
    provenance: {
      sourceLabel: "GoHighLevel Help — Opportunities",
      sourceUrl: `${DOCS}/folders/48000682364`,
      lastChecked: "2026-08-25",
      confidence: 0.95,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "opportunity-automation",
    name: "Pipeline automation",
    category: "Pipelines",
    summary: "Fire workflows when a deal is created or changes stage.",
    details:
      "deal.created and stage-change triggers start workflows that message the contact or notify the team.",
    coverage: "covered",
    appRoute: "/workflows",
    moduleKey: "workflows",
    provenance: {
      sourceLabel: "This project — tg_deals_workflow trigger",
      sourceUrl: `${DOCS}/folders/48000682364`,
      lastChecked: "2026-08-26",
      confidence: 0.9,
      method: "Implementation review of database triggers in this app",
    },
  },
  {
    key: "conversations",
    name: "Conversations inbox",
    category: "Messaging",
    summary: "Unified two-way inbox across SMS, email, WhatsApp and social DMs.",
    details:
      "One thread per contact combining every channel, with realtime updates, templates, merge tags and assignment.",
    coverage: "covered",
    appRoute: "/conversations",
    moduleKey: "conversations",
    provenance: {
      sourceLabel: "GoHighLevel Help — Conversations",
      sourceUrl: `${DOCS}/folders/48000682366`,
      lastChecked: "2026-08-26",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "sms",
    name: "SMS & MMS",
    category: "Messaging",
    summary: "Outbound and inbound text messaging on owned numbers.",
    details:
      "Twilio-backed sending with delivery status webhooks, retry/backoff on the outbound queue, quiet hours and scheduled sends.",
    coverage: "covered",
    appRoute: "/settings/phone-numbers",
    moduleKey: "calls",
    provenance: {
      sourceLabel: "Twilio Programmable Messaging docs",
      sourceUrl: "https://www.twilio.com/docs/messaging",
      lastChecked: "2026-08-24",
      confidence: 0.95,
      method: "Vendor API docs + implemented in this app",
    },
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    summary: "WhatsApp Business sending and receiving on a Twilio sender.",
    details:
      "Uses a WhatsApp-enabled Twilio sender for inbound/outbound messages inside the same conversation thread.",
    coverage: "covered",
    appRoute: "/conversations",
    moduleKey: "conversations",
    provenance: {
      sourceLabel: "Twilio WhatsApp docs",
      sourceUrl: "https://www.twilio.com/docs/whatsapp",
      lastChecked: "2026-08-24",
      confidence: 0.85,
      method: "Vendor API docs + implemented in this app",
    },
  },
  {
    key: "email",
    name: "Email sending",
    category: "Messaging",
    summary: "Transactional and campaign email with templates.",
    details:
      "Send templated email to contacts with merge tags; domain-level sending configuration for deliverability.",
    coverage: "partial",
    appRoute: "/templates",
    moduleKey: "templates",
    provenance: {
      sourceLabel: "GoHighLevel Help — Email",
      sourceUrl: `${DOCS}/folders/48000682366`,
      lastChecked: "2026-08-20",
      confidence: 0.7,
      method: "Vendor documentation; sending implemented, no drag-drop email builder",
    },
  },
  {
    key: "social-dms",
    name: "Facebook & Instagram DMs",
    category: "Messaging",
    summary: "Messenger and Instagram direct messages routed into the inbox.",
    details:
      "Meta webhooks create a contact and conversation per sender so DMs can be answered from the CRM.",
    coverage: "covered",
    appRoute: "/inbox",
    moduleKey: "conversations",
    provenance: {
      sourceLabel: "Meta Messenger Platform docs",
      sourceUrl: "https://developers.facebook.com/docs/messenger-platform",
      lastChecked: "2026-08-27",
      confidence: 0.85,
      method: "Vendor API docs + webhook implementation in this app",
    },
  },
  {
    key: "voice",
    name: "Calling & softphone",
    category: "Messaging",
    summary: "Browser softphone, inbound routing and call history.",
    details:
      "Twilio Voice JWT + TwiML powered click-to-call, inbound call flows (IVR, forwarding) and per-call logging.",
    coverage: "covered",
    appRoute: "/calls",
    moduleKey: "calls",
    provenance: {
      sourceLabel: "Twilio Voice SDK docs",
      sourceUrl: "https://www.twilio.com/docs/voice/sdks",
      lastChecked: "2026-08-24",
      confidence: 0.9,
      method: "Vendor API docs + implemented in this app",
    },
  },
  {
    key: "phone-numbers",
    name: "Phone number marketplace",
    category: "Messaging",
    summary: "Search, buy and release numbers inside the CRM.",
    details:
      "Per-workspace Twilio subaccounts with number search by area code and capability, purchase, webhook wiring and release.",
    coverage: "covered",
    appRoute: "/settings/phone-numbers",
    moduleKey: "calls",
    provenance: {
      sourceLabel: "Twilio Phone Numbers API",
      sourceUrl: "https://www.twilio.com/docs/phone-numbers",
      lastChecked: "2026-08-24",
      confidence: 0.95,
      method: "Vendor API docs + implemented in this app",
    },
  },
  {
    key: "campaigns",
    name: "Campaigns & broadcasts",
    category: "Campaigns",
    summary: "Bulk outbound sends to a filtered audience.",
    details:
      "Queue an SMS or email broadcast to a contact segment, with scheduling, quiet hours and per-message queue logs.",
    coverage: "covered",
    appRoute: "/marketing",
    moduleKey: "marketing",
    provenance: {
      sourceLabel: "GoHighLevel Help — Campaigns",
      sourceUrl: `${DOCS}/folders/48000682367`,
      lastChecked: "2026-08-22",
      confidence: 0.85,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "trigger-links",
    name: "Trigger links",
    category: "Campaigns",
    summary: "Trackable links that fire automations when clicked.",
    details:
      "Short links recorded per contact; clicks are logged and can start a workflow.",
    coverage: "covered",
    appRoute: "/marketing",
    moduleKey: "marketing",
    provenance: {
      sourceLabel: "GoHighLevel Help — Trigger links",
      sourceUrl: `${DOCS}/folders/48000682367`,
      lastChecked: "2026-08-22",
      confidence: 0.85,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "lead-ads",
    name: "Meta Lead Ads sync",
    category: "Campaigns",
    summary: "Import Facebook/Instagram lead form submissions as opportunities.",
    details:
      "Realtime leadgen webhooks plus historical import with date ranges, per-form pipeline/stage routing, dedupe by lead ID and a full audit trail.",
    coverage: "covered",
    appRoute: "/settings/integrations",
    moduleKey: "integrations",
    provenance: {
      sourceLabel: "Meta Lead Ads webhooks docs",
      sourceUrl: "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
      lastChecked: "2026-08-27",
      confidence: 0.9,
      method: "Vendor API docs + implemented and tested in this app",
    },
  },
  {
    key: "ad-reporting",
    name: "Ad platform reporting",
    category: "Campaigns",
    summary: "Spend and attribution from connected ad accounts.",
    details:
      "Pulls campaign spend/conversions from ad platforms to attribute revenue to source.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "Meta Marketing API — Insights",
      sourceUrl: "https://developers.facebook.com/docs/marketing-api/insights",
      lastChecked: "2026-08-20",
      confidence: 0.5,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "workflows",
    name: "Workflow builder",
    category: "Automation",
    summary: "Trigger → action automations with delays and conditions.",
    details:
      "Triggers include new lead, deal created, stage change, form submitted and link clicked. Actions send SMS/email, add tags, create tasks and move stages. Includes plain-English summaries, templates, test sends and duplication.",
    coverage: "covered",
    appRoute: "/workflows",
    moduleKey: "workflows",
    provenance: {
      sourceLabel: "GoHighLevel Help — Workflows",
      sourceUrl: `${DOCS}/folders/48000682365`,
      lastChecked: "2026-08-26",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "quiet-hours",
    name: "Quiet hours & scheduling",
    category: "Automation",
    summary: "Hold outbound messages until an allowed sending window.",
    details:
      "Per-workspace quiet hours and timezone; scheduled sends drain when the window opens.",
    coverage: "covered",
    appRoute: "/settings/messaging",
    moduleKey: "integrations",
    provenance: {
      sourceLabel: "This project — in_quiet_hours / next_send_time functions",
      sourceUrl: `${DOCS}/folders/48000682365`,
      lastChecked: "2026-08-26",
      confidence: 0.95,
      method: "Implementation review of this app",
    },
  },
  {
    key: "templates",
    name: "Message templates & merge tags",
    category: "Automation",
    summary: "Reusable SMS/email bodies with contact merge fields.",
    details:
      "Named templates with {{contact.first_name}}-style merge tags, previews and test sends.",
    coverage: "covered",
    appRoute: "/templates",
    moduleKey: "templates",
    provenance: {
      sourceLabel: "GoHighLevel Help — Templates",
      sourceUrl: `${DOCS}/folders/48000682366`,
      lastChecked: "2026-08-23",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "tasks",
    name: "Tasks",
    category: "CRM",
    summary: "Assignable to-dos linked to contacts with due dates.",
    details:
      "Status and priority tracking, contact linkage, overdue surfacing on the dashboard.",
    coverage: "covered",
    appRoute: "/tasks",
    moduleKey: "tasks",
    provenance: {
      sourceLabel: "GoHighLevel Help — Tasks",
      sourceUrl: `${DOCS}/folders/48000682363`,
      lastChecked: "2026-08-20",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "calendars",
    name: "Calendars & appointments",
    category: "Scheduling",
    summary: "Bookable calendars with availability and reminders.",
    details:
      "Round-robin or single-user calendars, buffers, booking confirmations and reminder automations.",
    coverage: "partial",
    appRoute: "/calendar",
    moduleKey: "calendar",
    provenance: {
      sourceLabel: "GoHighLevel Help — Calendars",
      sourceUrl: `${DOCS}/folders/48000682368`,
      lastChecked: "2026-08-20",
      confidence: 0.6,
      method: "Vendor documentation; calendar shell exists, booking engine pending",
    },
  },
  {
    key: "booking-pages",
    name: "Booking pages",
    category: "Scheduling",
    summary: "Public pages where leads self-book a slot.",
    details: "Shareable scheduling links tied to a calendar and its availability rules.",
    coverage: "partial",
    appRoute: "/settings/booking",
    moduleKey: "calendar",
    provenance: {
      sourceLabel: "GoHighLevel Help — Calendars",
      sourceUrl: `${DOCS}/folders/48000682368`,
      lastChecked: "2026-08-20",
      confidence: 0.55,
      method: "Vendor documentation; route scaffolded only",
    },
  },
  {
    key: "forms",
    name: "Forms",
    category: "Sites & Funnels",
    summary: "Public lead-capture forms that create contacts.",
    details:
      "Hosted form pages with field mapping to contact records, plus a public API route for safe anonymous submission.",
    coverage: "covered",
    appRoute: "/forms",
    moduleKey: "forms",
    provenance: {
      sourceLabel: "GoHighLevel Help — Forms",
      sourceUrl: `${DOCS}/folders/48000682369`,
      lastChecked: "2026-08-21",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "surveys",
    name: "Surveys",
    category: "Sites & Funnels",
    summary: "Multi-step questionnaires with conditional logic.",
    details: "Step-by-step question flows that write answers back to the contact record.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Surveys",
      sourceUrl: `${DOCS}/folders/48000682369`,
      lastChecked: "2026-08-21",
      confidence: 0.5,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "funnels",
    name: "Funnels & landing pages",
    category: "Sites & Funnels",
    summary: "Drag-and-drop multi-step marketing pages.",
    details: "Page builder with steps, split tests and conversion tracking.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Funnels",
      sourceUrl: `${DOCS}/folders/48000682369`,
      lastChecked: "2026-08-21",
      confidence: 0.5,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "websites",
    name: "Websites & blogs",
    category: "Sites & Funnels",
    summary: "Hosted marketing sites and blog posts.",
    details: "Full site builder with templates, domains and blog publishing.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Sites",
      sourceUrl: `${DOCS}/folders/48000682369`,
      lastChecked: "2026-08-21",
      confidence: 0.45,
      method: "Vendor documentation only — WordPress integration used instead",
    },
  },
  {
    key: "wordpress",
    name: "WordPress integration",
    category: "Sites & Funnels",
    summary: "Connect an existing WordPress site for lead capture.",
    details: "Webhook/endpoint wiring so WordPress form submissions land as CRM contacts.",
    coverage: "covered",
    appRoute: "/settings/wordpress",
    moduleKey: "integrations",
    provenance: {
      sourceLabel: "This project — WordPress settings route",
      sourceUrl: "https://developer.wordpress.org/rest-api/",
      lastChecked: "2026-08-22",
      confidence: 0.8,
      method: "Implementation review of this app",
    },
  },
  {
    key: "payments",
    name: "Payments & invoices",
    category: "Payments",
    summary: "Invoices, payment links and subscriptions.",
    details: "Collect one-off and recurring payments and reconcile them against opportunities.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Payments",
      sourceUrl: `${DOCS}/folders/48000682370`,
      lastChecked: "2026-08-21",
      confidence: 0.5,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "products",
    name: "Products & order forms",
    category: "Payments",
    summary: "Catalogue of sellable items used on checkout pages.",
    details: "Products with prices and recurring options, attached to order forms.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Payments",
      sourceUrl: `${DOCS}/folders/48000682370`,
      lastChecked: "2026-08-21",
      confidence: 0.45,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "reviews",
    name: "Reputation & reviews",
    category: "Reputation",
    summary: "Request, monitor and respond to Google/Facebook reviews.",
    details: "Automated review requests after a won deal, plus a review inbox.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Reputation",
      sourceUrl: `${DOCS}/folders/48000682371`,
      lastChecked: "2026-08-21",
      confidence: 0.5,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "reporting",
    name: "Reporting dashboards",
    category: "Reporting",
    summary: "Pipeline, source and team performance reporting.",
    details:
      "Deal value by stage, won revenue by period, lead source breakdown and per-user activity.",
    coverage: "covered",
    appRoute: "/reports",
    moduleKey: "reports",
    provenance: {
      sourceLabel: "GoHighLevel Help — Reporting",
      sourceUrl: `${DOCS}/folders/48000682372`,
      lastChecked: "2026-08-25",
      confidence: 0.85,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "attribution",
    name: "Attribution reporting",
    category: "Reporting",
    summary: "First/last touch source attribution per contact.",
    details:
      "Ties a contact back to the page, ad or form that created it. This app records Meta Page and Lead Ad form provenance per lead.",
    coverage: "partial",
    appRoute: "/contacts",
    moduleKey: "contacts",
    provenance: {
      sourceLabel: "This project — Meta lead source panel",
      sourceUrl: `${DOCS}/folders/48000682372`,
      lastChecked: "2026-08-27",
      confidence: 0.75,
      method: "Implementation review; Meta sources covered, ad spend not",
    },
  },
  {
    key: "sub-accounts",
    name: "Sub-accounts (locations)",
    category: "Agency",
    summary: "Isolated workspaces per client under one agency.",
    details: "Each sub-account has its own contacts, pipelines, numbers and settings, with RLS isolation.",
    coverage: "covered",
    moduleKey: "dashboard",
    appRoute: "/dashboard",
    provenance: {
      sourceLabel: "GoHighLevel Help — Sub-accounts",
      sourceUrl: `${DOCS}/folders/48000682373`,
      lastChecked: "2026-08-25",
      confidence: 0.9,
      method: "Vendor documentation + implemented in this app",
    },
  },
  {
    key: "team",
    name: "Team & permissions",
    category: "Agency",
    summary: "Invite users and scope them to roles and workspaces.",
    details: "Role table with admin/member separation, invitations with expiring tokens.",
    coverage: "covered",
    appRoute: "/settings/team",
    provenance: {
      sourceLabel: "This project — user_roles + invitations",
      sourceUrl: `${DOCS}/folders/48000682373`,
      lastChecked: "2026-08-25",
      confidence: 0.9,
      method: "Implementation review of this app",
    },
  },
  {
    key: "snapshots",
    name: "Snapshots",
    category: "Agency",
    summary: "Clone a configured workspace into a new client account.",
    details:
      "Copy pipelines, workflows and settings into a fresh sub-account. This app ships module presets as a partial equivalent.",
    coverage: "partial",
    appRoute: "/settings/modules",
    provenance: {
      sourceLabel: "GoHighLevel Help — Snapshots",
      sourceUrl: `${DOCS}/folders/48000682373`,
      lastChecked: "2026-08-26",
      confidence: 0.6,
      method: "Vendor documentation; module presets implemented, full snapshot not",
    },
  },
  {
    key: "module-toggles",
    name: "Module toggles",
    category: "Platform",
    summary: "Turn features on/off per workspace.",
    details:
      "Admins enable/disable modules per sub-account with an audit log of who changed what, plus agency-wide defaults.",
    coverage: "covered",
    appRoute: "/settings/modules",
    provenance: {
      sourceLabel: "This project — sub_account_modules",
      sourceUrl: `${DOCS}/folders/48000682373`,
      lastChecked: "2026-08-26",
      confidence: 0.95,
      method: "Implementation review of this app",
    },
  },
  {
    key: "api",
    name: "Public API & webhooks",
    category: "Platform",
    summary: "Programmatic access and outbound event webhooks.",
    details:
      "Signed inbound webhook routes for Meta and Twilio; public form endpoints. No general-purpose outbound API yet.",
    coverage: "partial",
    provenance: {
      sourceLabel: "GoHighLevel API reference",
      sourceUrl: "https://highlevel.stoplight.io/docs/integrations",
      lastChecked: "2026-08-24",
      confidence: 0.7,
      method: "Vendor API reference + implementation review",
    },
  },
  {
    key: "mobile",
    name: "Mobile app",
    category: "Platform",
    summary: "Native iOS/Android client for the CRM.",
    details: "Mobile inbox, calling and pipeline management on the go.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel — Mobile app",
      sourceUrl: "https://www.gohighlevel.com/mobile-app",
      lastChecked: "2026-08-21",
      confidence: 0.4,
      method: "Vendor marketing page — responsive web only in this app",
    },
  },
  {
    key: "ai-assistants",
    name: "AI assistants",
    category: "Platform",
    summary: "AI reply suggestions and conversation bots.",
    details: "Draft replies, summarise threads and auto-respond to inbound messages.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Conversation AI",
      sourceUrl: `${DOCS}/folders/48000682366`,
      lastChecked: "2026-08-21",
      confidence: 0.45,
      method: "Vendor documentation only — not implemented",
    },
  },
  {
    key: "memberships",
    name: "Memberships & courses",
    category: "Platform",
    summary: "Host gated course content for customers.",
    details: "Course builder, member logins and drip content.",
    coverage: "unknown",
    provenance: {
      sourceLabel: "GoHighLevel Help — Memberships",
      sourceUrl: `${DOCS}/folders/48000682374`,
      lastChecked: "2026-08-21",
      confidence: 0.45,
      method: "Vendor documentation only — not implemented",
    },
  },
];

export const COVERAGE_LABEL: Record<Coverage, string> = {
  covered: "Covered",
  partial: "Partial",
  unknown: "Unknown",
};

export function coverageCounts(mods: GhlModule[]) {
  return mods.reduce(
    (acc, m) => {
      acc[m.coverage] += 1;
      return acc;
    },
    { covered: 0, partial: 0, unknown: 0 } as Record<Coverage, number>,
  );
}

export type SortKey = "name" | "category" | "coverage" | "confidence" | "lastChecked";

const COVERAGE_ORDER: Record<Coverage, number> = { covered: 0, partial: 1, unknown: 2 };

export function filterAndSortModules(opts: {
  query: string;
  categories: string[];
  coverages: Coverage[];
  sort: SortKey;
  dir: "asc" | "desc";
}): GhlModule[] {
  const q = opts.query.trim().toLowerCase();
  const out = GHL_MODULES.filter((m) => {
    if (opts.categories.length && !opts.categories.includes(m.category)) return false;
    if (opts.coverages.length && !opts.coverages.includes(m.coverage)) return false;
    if (!q) return true;
    return [m.name, m.category, m.summary, m.details, m.provenance.sourceLabel, m.appRoute ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  out.sort((a, b) => {
    let cmp = 0;
    switch (opts.sort) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "category":
        cmp = a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        break;
      case "coverage":
        cmp = COVERAGE_ORDER[a.coverage] - COVERAGE_ORDER[b.coverage] || a.name.localeCompare(b.name);
        break;
      case "confidence":
        cmp = a.provenance.confidence - b.provenance.confidence;
        break;
      case "lastChecked":
        cmp = a.provenance.lastChecked.localeCompare(b.provenance.lastChecked);
        break;
    }
    return opts.dir === "asc" ? cmp : -cmp;
  });

  return out;
}

/* ------------------------------- exports -------------------------------- */

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function modulesToCsv(mods: GhlModule[]): string {
  const header = [
    "Module",
    "Category",
    "Status",
    "Summary",
    "What it does",
    "In-app route",
    "Source",
    "Source URL",
    "Last checked",
    "Confidence",
    "Method",
  ];
  const rows = mods.map((m) => [
    m.name,
    m.category,
    COVERAGE_LABEL[m.coverage],
    m.summary,
    m.details,
    m.appRoute ?? "",
    m.provenance.sourceLabel,
    m.provenance.sourceUrl,
    m.provenance.lastChecked,
    Math.round(m.provenance.confidence * 100) + "%",
    m.provenance.method,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

/** Builds a printable report and opens the browser print dialog (Save as PDF). */
export function printModulesReport(mods: GhlModule[], workspaceName: string) {
  const counts = coverageCounts(mods);
  const today = new Date().toLocaleDateString();
  const rows = mods
    .map(
      (m) => `
      <tr>
        <td><strong>${esc(m.name)}</strong><div class="sub">${esc(m.summary)}</div></td>
        <td>${esc(m.category)}</td>
        <td class="status ${m.coverage}">${COVERAGE_LABEL[m.coverage]}</td>
        <td>${esc(m.details)}</td>
        <td class="src">
          <a href="${esc(m.provenance.sourceUrl)}">${esc(m.provenance.sourceLabel)}</a>
          <div class="sub">${esc(m.provenance.method)}</div>
          <div class="sub">Checked ${esc(m.provenance.lastChecked)} · ${Math.round(
            m.provenance.confidence * 100,
          )}% confidence</div>
        </td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>All Modules report — ${esc(workspaceName)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;font-size:11px}
    h1{font-size:20px;margin:0 0 4px}
    .meta{color:#666;font-size:11px;margin-bottom:16px}
    .kpis{display:flex;gap:8px;margin-bottom:18px}
    .kpi{border:1px solid #ddd;border-radius:8px;padding:8px 12px;min-width:110px}
    .kpi b{display:block;font-size:18px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;background:#f4f4f5;padding:6px;border-bottom:1px solid #ddd;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
    td{padding:6px;border-bottom:1px solid #eee;vertical-align:top}
    .sub{color:#666;font-size:10px;margin-top:2px}
    .status{font-weight:600;white-space:nowrap}
    .status.covered{color:#15803d}.status.partial{color:#b45309}.status.unknown{color:#6b7280}
    a{color:#1d4ed8;text-decoration:none;word-break:break-all}
    tr{break-inside:avoid}
    @page{size:A4 landscape;margin:12mm}
  </style></head><body>
  <h1>All Modules report</h1>
  <div class="meta">${esc(workspaceName)} · generated ${esc(today)} · ${mods.length} modules</div>
  <div class="kpis">
    <div class="kpi"><b>${counts.covered}</b>Covered</div>
    <div class="kpi"><b>${counts.partial}</b>Partial</div>
    <div class="kpi"><b>${counts.unknown}</b>Unknown</div>
  </div>
  <table><thead><tr>
    <th style="width:18%">Module</th><th style="width:9%">Category</th><th style="width:8%">Status</th>
    <th style="width:37%">What it does</th><th style="width:28%">Provenance</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
