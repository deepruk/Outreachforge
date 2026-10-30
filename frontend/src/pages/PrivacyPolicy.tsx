import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Information we collect",
    body: [
      "Account information such as your name, email address, and authentication details.",
      "Information you add to OutreachForge, including campaigns, prospect/contact records, email templates, sequence settings, sender configuration, signatures, and campaign activity.",
      "When you connect a Gmail account, we receive the email address and authorization tokens needed to provide the Gmail features you request. The app requests permission to send email and read email for reply/inbox synchronization.",
      "Technical and operational information such as logs, timestamps, delivery results, errors, and usage metrics needed to operate, secure, and troubleshoot the service."
    ]
  },
  {
    title: "2. How we use information",
    body: [
      "To create and secure your account and provide campaign, email-sending, inbox synchronization, analytics, and support features.",
      "To personalize and generate email drafts when you choose to use the AI writing or website-research features.",
      "To maintain the service, diagnose errors, prevent abuse, and protect users and the platform.",
      "We do not sell your personal information."
    ]
  },
  {
    title: "3. Gmail and Google user data",
    body: [
      "If you connect Google, OutreachForge uses Google authorization to send messages from the Gmail account you select and to read email needed for inbox/reply synchronization. We do not use this access for advertising or to build advertising profiles.",
      "Google OAuth tokens are stored by the service to maintain the connection; refresh tokens are encrypted before being saved. Never share your password or OAuth credentials with anyone.",
      "OutreachForge's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We use Google data only to provide or improve user-facing features you request, for security, and as otherwise permitted by that policy.",
      "You can disconnect a sender account in OutreachForge and can revoke the app's access from your Google Account security settings. Revoking access may stop sending and inbox synchronization."
    ]
  },
  {
    title: "4. AI features and third-party services",
    body: [
      "If you use AI email writing or website research, the text and relevant information you submit for that feature may be sent to Google's Gemini API to generate a response. Do not submit sensitive information unless you are comfortable with this processing and the provider's applicable terms.",
      "We use service providers to host the application, store application data, and deliver the features you request. Those providers process information as needed to provide their services and under their applicable terms and safeguards.",
      "When you provide a public website for research, the service may fetch publicly accessible pages on that website to prepare a business profile."
    ]
  },
  {
    title: "5. Storage, security, and retention",
    body: [
      "We use reasonable technical and organizational measures designed to protect information, including access controls and encryption of stored Google refresh tokens. No online service can guarantee absolute security.",
      "We retain information while needed to provide the service, maintain your account, comply with legal obligations, resolve disputes, and enforce our agreements. Retention periods can vary by data type and operational needs.",
      "You should delete campaigns, contacts, or sender connections you no longer need. To request account or data deletion, contact support using the address below. Some records may remain for a limited period where required for security, backups, or legal obligations."
    ]
  },
  {
    title: "6. Your choices and rights",
    body: [
      "You can update account details, manage campaign information, disconnect sender accounts, and stop using the service.",
      "Depending on where you live, you may have rights to access, correct, export, or request deletion of personal information, or to object to or restrict certain processing. Contact us to make a request."
    ]
  },
  {
    title: "7. Children and changes",
    body: [
      "OutreachForge is intended for business use and is not designed for children.",
      "We may update this policy as the service changes. We will update the effective date on this page when changes are published. Continued use after an update means the revised policy applies to your subsequent use, subject to applicable law."
    ]
  }
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Back to OutreachForge</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective date: October 31, 2026</p>
        <p className="mt-8 leading-7 text-muted-foreground">This Privacy Policy explains how OutreachForge collects, uses, stores, and protects information when you use our website and application. Please read it carefully before connecting an email account or uploading contact data.</p>
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
          <h2 className="text-xl font-semibold">8. Contact</h2>
          <p className="mt-3 leading-7 text-muted-foreground">For privacy questions or data requests, contact <a className="text-primary hover:underline" href="mailto:singhdeepanshu30@gmail.com">singhdeepanshu30@gmail.com</a>.</p>
        </section>
        <div className="mt-12 flex gap-5 border-t border-border pt-6 text-sm">
          <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
