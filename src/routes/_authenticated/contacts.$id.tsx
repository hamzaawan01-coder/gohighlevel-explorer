import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ContactDetailPanel } from "@/components/ContactDetailPanel";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  head: () => ({
    meta: [{ title: "Contact — Agency Engine" }],
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
          className="flex items-center gap-1.5 border border-border rounded-md py-1.5 px-2.5 text-xs font-medium hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to contacts
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
