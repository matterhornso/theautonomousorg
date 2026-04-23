import { Navbar } from "../components/navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How The Autonomous collects, uses, and protects your data. Learn about our AI data processing practices, your rights, and our commitment to privacy.",
  alternates: { canonical: "https://theautonomous.org/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-20">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-400 mb-10">
          Last updated: March 21, 2026
        </p>

        <div className="prose prose-neutral max-w-none space-y-8 text-sm leading-relaxed text-neutral-600">
          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              1. Introduction
            </h2>
            <p>
              The Autonomous (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;),
              operated by The Autonomous Org, is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our AI agent platform at
              theautonomous.org (the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              2. Information We Collect
            </h2>
            <p className="mb-3">
              <strong>Account Information:</strong> When you create an account,
              we collect your name, email address, and authentication
              credentials through our third-party authentication provider
              (Clerk).
            </p>
            <p className="mb-3">
              <strong>Profile Information:</strong> You may voluntarily provide
              additional information including your job title, company name,
              company size, industry, current tools, business challenges, and
              automation goals.
            </p>
            <p className="mb-3">
              <strong>Website Analysis Data:</strong> When you submit a URL for
              analysis, we fetch publicly available content from that website to
              generate AI agent recommendations. We do not access private or
              authenticated content.
            </p>
            <p className="mb-3">
              <strong>Conversation Data:</strong> Messages exchanged between you
              and your AI agents are stored to maintain conversation history and
              enable persistent agent memory.
            </p>
            <p>
              <strong>Usage Data:</strong> We automatically collect information
              about how you interact with the Service, including pages visited,
              features used, and timestamps.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              3. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>
                Generate personalized AI agent recommendations based on your
                company profile and website
              </li>
              <li>
                Power AI agent conversations with relevant context about your
                business
              </li>
              <li>
                Maintain persistent memory across agent conversations for
                continuity
              </li>
              <li>Send you updates, newsletters, and service communications</li>
              <li>
                Respond to your inquiries and provide customer support
              </li>
              <li>
                Detect, prevent, and address technical issues and security
                threats
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              4. AI Processing
            </h2>
            <p>
              Your conversations and company data are processed by third-party
              AI models (currently Anthropic&apos;s Claude) to power agent
              responses. We transmit only the information necessary for the AI
              to perform its role. We do not use your conversation data to train
              AI models. Please refer to Anthropic&apos;s privacy policy for
              details on how they handle data processed through their API.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              5. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share your
              information with:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Service Providers:</strong> Third-party services that
                help us operate the platform (authentication, hosting, AI
                processing, analytics)
              </li>
              <li>
                <strong>Legal Compliance:</strong> When required by law, court
                order, or governmental regulation
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a
                merger, acquisition, or sale of assets
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              6. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to
              protect your information. Each agent instance runs in isolation,
              and company data is not shared between different organizations on
              the platform. However, no method of electronic storage or
              transmission is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              7. Data Retention
            </h2>
            <p>
              We retain your information for as long as your account is active
              or as needed to provide the Service. You may request deletion of
              your account and associated data by contacting us at
              privacy@theautonomous.org.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              8. Your Rights
            </h2>
            <p>
              Depending on your jurisdiction, you may have the right to access,
              correct, delete, or port your personal data. You may also have the
              right to object to or restrict certain processing. To exercise
              these rights, contact us at privacy@theautonomous.org.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              10. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at{" "}
              <a
                href="mailto:privacy@theautonomous.org"
                className="text-accent hover:underline"
              >
                privacy@theautonomous.org
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
