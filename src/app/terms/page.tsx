import { Navbar } from "../components/navbar";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-20">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-neutral-400 mb-10">
          Last updated: March 21, 2026
        </p>

        <div className="prose prose-neutral max-w-none space-y-8 text-sm leading-relaxed text-neutral-600">
          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using The Autonomous platform at
              theautonomous.org (the &quot;Service&quot;), operated by
              Chainflux, you agree to be bound by these Terms of Service. If
              you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              2. Description of Service
            </h2>
            <p>
              The Autonomous provides AI-powered agents for business workflows
              including sales, marketing, accounting, strategy, product
              management, engineering, and other roles. Agents are powered by
              third-party AI models (currently Anthropic&apos;s Claude Sonnet
              4.6) and operate within isolated instances with persistent memory.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              3. Account Registration
            </h2>
            <p>
              You must create an account to access certain features of the
              Service. You are responsible for maintaining the security of your
              account credentials and for all activities that occur under your
              account. You must provide accurate and complete information during
              registration.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              4. Acceptable Use
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>
                Generate content that is harmful, abusive, threatening,
                defamatory, or otherwise objectionable
              </li>
              <li>
                Attempt to gain unauthorized access to other users&apos; agents,
                data, or accounts
              </li>
              <li>
                Use the Service for any purpose that could harm, disable, or
                impair the platform
              </li>
              <li>
                Reverse engineer, decompile, or attempt to extract the source
                code of the Service
              </li>
              <li>
                Use AI agents to send unsolicited communications (spam) or
                engage in deceptive practices
              </li>
              <li>
                Submit malicious URLs or content designed to exploit the website
                analysis feature
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              5. AI Agent Limitations
            </h2>
            <p>
              AI agents are assistants, not replacements for professional
              judgment. Agent outputs — including sales recommendations,
              financial analysis, legal suggestions, and strategic advice —
              should be reviewed by qualified professionals before acting on
              them. We do not guarantee the accuracy, completeness, or
              suitability of any agent output. You are solely responsible for
              decisions made based on agent recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              6. Third-Party Integrations
            </h2>
            <p>
              Agents may connect to third-party services (CRMs, email
              platforms, accounting software, etc.) through MCP connectors. You
              are responsible for authorizing these connections and ensuring
              compliance with the third party&apos;s terms of service. We are
              not responsible for the actions taken by agents through
              third-party integrations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              7. Intellectual Property
            </h2>
            <p>
              You retain ownership of all content you provide to the Service.
              We retain ownership of the platform, agent skill definitions, and
              underlying technology. Content generated by AI agents in response
              to your inputs is owned by you, subject to any limitations
              imposed by the underlying AI model providers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              8. Payment and Billing
            </h2>
            <p>
              Certain features require a paid subscription. Prices are listed on
              our pricing page and may change with 30 days&apos; notice.
              Subscriptions renew automatically unless cancelled. Refunds are
              available within 14 days of initial purchase for annual plans, and
              are not available for monthly plans.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              9. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Chainflux and The
              Autonomous shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including loss of
              profits, data, or business opportunities, arising from your use
              of the Service. Our total liability shall not exceed the amount
              you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              10. Termination
            </h2>
            <p>
              We may suspend or terminate your account if you violate these
              Terms. You may delete your account at any time by contacting us.
              Upon termination, your agent instances will be deactivated and
              your data will be deleted within 30 days, unless retention is
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              11. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. Material changes
              will be communicated via email or a notice on the Service.
              Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">
              12. Contact
            </h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a
                href="mailto:legal@theautonomous.org"
                className="text-accent hover:underline"
              >
                legal@theautonomous.org
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
