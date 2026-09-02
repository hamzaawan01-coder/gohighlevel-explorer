import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Leads Convert CRM" },
      {
        name: "description",
        content:
          "The terms that apply when you use Leads Convert CRM or contact us through our web forms, Facebook, Instagram, WhatsApp or SMS channels.",
      },
      { property: "og:title", content: "Terms of Service | Leads Convert CRM" },
      {
        property: "og:description",
        content: "Acceptable use, messaging consent, availability and contact details for Leads Convert CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Operated by Leads Convert.</p>

      <Section title="Acceptance">
        <p>
          By using this CRM, submitting one of our forms, or messaging us through Facebook, Instagram,
          WhatsApp, SMS or email, you agree to these terms. If you do not agree, please do not use the
          service.
        </p>
      </Section>

      <Section title="Who may use the service">
        <p>
          Access to the CRM itself is limited to authorised Leads Convert staff and invited team
          members. Accounts are personal; you are responsible for keeping your sign-in details
          confidential and for activity carried out under your account.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Do not use the service for unlawful, fraudulent or abusive purposes.</li>
          <li>Do not attempt to access data belonging to another workspace or user.</li>
          <li>Do not send unsolicited bulk messages or content that breaches platform policies.</li>
          <li>Do not interfere with, disrupt or reverse engineer the service.</li>
        </ul>
      </Section>

      <Section title="Messaging and consent">
        <p>
          Where you provide a phone number or messaging handle, you consent to us replying on that channel
          about your enquiry. Message and data rates from your carrier may apply. You can opt out at any
          time by replying STOP to an SMS or by telling us in the conversation.
        </p>
      </Section>

      <Section title="Third-party platforms">
        <p>
          Messaging and advertising features rely on third parties including Meta (Facebook and Instagram)
          and Twilio. Their own terms and policies apply to your use of those platforms, and their
          availability is outside our control.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          Our handling of personal information is described in our{" "}
          <a className="underline" href="/privacy">
            Privacy Policy
          </a>
          . You can request deletion of your data at any time and check the outcome on our{" "}
          <a className="underline" href="/data-deletion">
            data deletion status page
          </a>
          .
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          The service is provided on an "as is" and "as available" basis. We may add, change or remove
          features, and we may suspend access for maintenance. We will publish any updated version of
          these terms on this page.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential loss arising from
          use of the service. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms can be sent to{" "}
          <a className="underline" href="mailto:info@leadsconvert.co.uk">
            info@leadsconvert.co.uk
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
