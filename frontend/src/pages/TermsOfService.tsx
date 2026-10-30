import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Using OutreachForge",
    body: [
      "OutreachForge provides tools for managing outreach campaigns, sending email through mailboxes you connect, synchronizing replies, reviewing campaign activity, and generating optional AI-assisted drafts.",
      "You must provide accurate account information, keep your login credentials secure, and be authorized to connect every mailbox and data source you use.",
      "You are responsible for activity conducted through your account and for keeping your contact lists, campaign settings, and sender permissions up to date."
    ]
  },
  {
    title: "2. Acceptable use and email compliance",
    body: [
      "You must comply with applicable laws and regulations, including privacy, marketing, anti-spam, consumer-protection, and data-protection requirements in the places where you and your recipients are located.",
      "Only contact people where you have a lawful basis to do so. Identify yourself accurately, use honest subject lines and content, honor opt-out and suppression requests promptly, and include any disclosures required by law.",
      "Do not use OutreachForge to send unlawful, deceptive, threatening, fraudulent, harassing, or unsolicited messages in violation of applicable rules; distribute malware; collect data unlawfully; or interfere with the service or other users.",
      "You are responsible for obtaining any permissions required to use connected mailboxes and uploaded contact information, and for complying with your email provider's terms, sending limits, and policies."
    ]
  },
  {
    title: "3. Connected services and AI features",
    body: [
      "When you connect Gmail or another sender, you authorize OutreachForge to perform the actions you request through that integration. Third-party providers remain subject to their own terms, policies, availability, and limits.",
      "AI-generated text may be incomplete, inaccurate, or unsuitable. Review every draft and verify its claims, personalization, and compliance before sending. You remain responsible for all messages sent from your account."
    ]
  },
  {
    title: "4. Your content and account",
    body: [
      "You retain responsibility for the content, contact data, templates, and other material you upload or create. You grant OutreachForge the limited permission needed to process that material to operate the features you use.",
      "Do not upload or use content that infringes another person's rights or that you are not legally permitted to process.",
      "You may stop using the service and request account or data deletion by contacting support. Some information may be retained where necessary for security, backups, dispute resolution, or legal compliance."
    ]
  },
  {
    title: "5. Availability, limits, and changes",
    body: [
      "We may update, improve, suspend, or discontinue features and may apply usage limits to protect the service and comply with third-party provider restrictions.",
      "We aim to keep OutreachForge available and reliable, but do not guarantee uninterrupted or error-free operation. Email delivery, spam placement, open tracking, reply rates, and campaign outcomes depend on factors outside our control and are not guaranteed."
    ]
  },
  {
    title: "6. Suspension and termination",
    body: [
      "We may restrict or suspend access where we reasonably believe an account is being used unlawfully, creates security or operational risk, violates these terms, or threatens the service or others.",
      "You may stop using OutreachForge at any time. Provisions that by their nature should continue after termination will continue to apply."
    ]
  },
  {
    title: "7. Disclaimers and liability",
    body: [
      "To the extent permitted by law, the service is provided on an “as available” basis without warranties of uninterrupted availability, fitness for a particular purpose, or guaranteed campaign results.",
      "To the extent permitted by law, OutreachForge will not be liable for indirect, incidental, special, consequential, or punitive losses, lost profits, lost data, provider suspensions, or email-delivery outcomes arising from use of the service. Nothing in these terms limits liability that cannot legally be limited."
    ]
  },
  {
    title: "8. Changes to these terms",
    body: [
      "We may revise these terms as the service evolves. The effective date will be updated when revisions are published. Your continued use after a revision takes effect indicates acceptance of the updated terms, to the extent permitted by law."
    ]
  }
];

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Back to OutreachForge</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective date: October 31, 2026</p>
        <p className="mt-8 leading-7 text-muted-foreground">These Terms of Service govern your access to and use of OutreachForge. By using the service, you agree to these terms. If you do not agree, do not use the service.</p>
        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
                {section.body.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="mt-3 leading-7 text-muted-foreground">Questions about these terms? Contact <a className="text-primary hover:underline" href="mailto:support@outreachforge.io">support@outreachforge.io</a>.</p>
        </section>
        <div className="mt-12 flex gap-5 border-t border-border pt-6 text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
          <Link to="/terms" className="text-primary underline">Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
