import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  head: () => ({
    meta: [{ title: "Contact — Lead Convert" }],
  }),
  component: ContactDetailPage,
});

function ContactDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  return (
    <AppShell
      headerActions={
        <Link
          to="/contacts"
          aria-label="Back to contacts"
          className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors min-h-11 sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5 shrink-0" /> <span className="truncate">Back to contacts</span>
        </Link>
      }
    >
      <div className="h-full overflow-auto">
        <ContactDetailPanel
          contactId={id}
          onClose={() => navigate({ to: "/contacts" })}
        />
      </div>
    </AppShell>
  );
}
