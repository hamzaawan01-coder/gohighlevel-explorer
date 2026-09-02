import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Leads Convert CRM" },
      {
        name: "description",
        content:
          "How Leads Convert CRM collects, uses, stores and deletes customer data, including data received from Facebook, Instagram and SMS channels.",
      },
      { property: "og:title", content: "Privacy Policy | Leads Convert CRM" },
      {
        property: "og:description",
        content: "Our privacy practices for CRM contacts, messaging channels and data deletion requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Operated by Leads Convert.</p>

      <Section title="Who we are">
        <p>
          This CRM is operated by Leads Convert to manage enquiries, leads and conversations with people
          who contact us or respond to our advertising. Questions about this policy can be sent to{" "}
          <a className="underline" href="mailto:info@leadsconvert.co.uk">
            info@leadsconvert.co.uk
          </a>
          .
        </p>
      </Section>

      <Section title="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Contact details you provide, such as name, email address, phone number and company.</li>
          <li>Answers you submit in our web forms or Facebook and Instagram Lead Ad forms.</li>
          <li>
            Messages you send us through Facebook Messenger, Instagram direct messages, WhatsApp, SMS or
            email, along with the associated conversation identifiers supplied by those platforms.
          </li>
          <li>Call records and voicemail generated when you call us or we call you.</li>
          <li>Notes, tasks and pipeline status our team records about your enquiry.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To respond to your enquiry and continue the conversation on the channel you used.</li>
          <li>To track the progress of your enquiry internally.</li>
          <li>To send follow-up messages related to the enquiry you submitted.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section title="Facebook and Instagram data">
        <p>
          When you send us a message on our Facebook Page or Instagram account, or submit one of our Lead Ad
          forms, Meta passes that message or form response to this CRM so our team can reply. We store the
          content you sent, the contact details included in it, and the platform-provided identifiers needed
          to keep the conversation threaded. We use this data only to handle your enquiry.
        </p>
      </Section>

      <Section title="Service providers">
        <p>
          We use third-party providers to deliver the service: Meta (Facebook and Instagram messaging and
          Lead Ads), Twilio (SMS, WhatsApp and voice calling) and our hosting and database provider. These
          providers process data on our behalf in order to deliver those channels.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep enquiry records for as long as needed to handle your enquiry and to meet our record-keeping
          obligations, then delete or anonymise them. You can ask us to delete your data sooner at any time.
        </p>
      </Section>

      <Section title="Your choices and data deletion">
        <p>
          You can ask us to access, correct or delete the personal information we hold about you by emailing{" "}
          <a className="underline" href="mailto:info@leadsconvert.co.uk">
            info@leadsconvert.co.uk
          </a>
          .
        </p>
        <p>
          If you connected through Facebook or Instagram, you can also remove our app from your Facebook
          settings. Meta then notifies us and we delete the messaging data associated with your account and
          issue a confirmation code you can look up on our{" "}
          <a className="underline" href="/data-deletion">
            data deletion status page
          </a>
          .
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as our service changes. The current version is always published on this
          page.
        </p>
      </Section>
    </main>
  );
}
