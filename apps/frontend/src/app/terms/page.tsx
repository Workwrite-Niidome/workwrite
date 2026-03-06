export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-8">Terms of Service</h1>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Workwrite ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, you may not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">2. Account Registration</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>You must provide accurate and complete information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must be at least 13 years of age to use the Service.</li>
            <li>One person may not maintain more than one account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">3. Content Ownership</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>You retain all rights to the content you publish on Workwrite.</li>
            <li>By publishing, you grant Workwrite a non-exclusive license to display and distribute your content on the platform.</li>
            <li>You must only post original content or content you have the rights to publish.</li>
            <li>Content that infringes on copyrights or intellectual property will be removed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">4. Prohibited Conduct</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>Harassment, hate speech, or discrimination against other users.</li>
            <li>Publishing plagiarized, stolen, or AI-generated content without disclosure.</li>
            <li>Attempting to manipulate quality scores or engagement metrics.</li>
            <li>Creating multiple accounts to circumvent bans or restrictions.</li>
            <li>Distributing malware, spam, or unauthorized advertising.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">5. AI Scoring</h2>
          <p>
            Workwrite uses AI technology to analyze and score literary works. These scores are provided
            as guidance and do not represent absolute quality judgments. Scores may change as our
            algorithms are updated. Authors may choose to hide their scores from public view.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">6. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms.
            Users may delete their accounts at any time through the settings page.
            Upon deletion, your published works will be removed from the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">7. Limitation of Liability</h2>
          <p>
            Workwrite is provided "as is" without warranties of any kind. We are not liable for
            any damages arising from the use or inability to use the Service, including but not
            limited to data loss or service interruptions.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">8. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after
            changes constitutes acceptance of the updated terms. We will notify users of significant
            changes via email or platform notification.
          </p>
        </section>

        <p className="pt-4 border-t border-border text-xs">
          Last updated: March 2026
        </p>
      </div>
    </div>
  );
}
