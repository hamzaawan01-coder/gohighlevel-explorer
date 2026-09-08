import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { SettingsShell } from "@/components/SettingsNav";
import { CurrencyFieldsPanel } from "@/components/CurrencyFieldsPanel";

export const Route = createFileRoute("/_authenticated/settings/custom-fields")({
  head: () => ({
    meta: [
      { title: "Currency & custom fields | Click Away CRM" },
      {
        name: "description",
        content:
          "Choose the currency used across deals and invoices, and build your own extra contact fields.",
      },
      { property: "og:title", content: "Currency & custom fields | Click Away CRM" },
      {
        property: "og:description",
        content: "Set your account currency and add your own contact fields without any code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomFieldsSettings,
});

function CustomFieldsSettings() {
  return (
    <AppShell>
      <PageHeader
        title="Currency & custom fields"
        crumbs={[{ label: "Settings" }, { label: "Currency & fields" }]}
        description="Pick the currency shown on deals and invoices, and create your own extra fields."
      />
      <PageBody>
        <SettingsShell>
          <CurrencyFieldsPanel />
        </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
