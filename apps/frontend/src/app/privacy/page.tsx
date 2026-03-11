export default function PrivacyPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-8">Privacy Policy</h1>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">1. Information We Collect</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">Account information:</strong> Email address, display name, and profile details you provide.</li>
            <li><strong className="text-foreground">Reading data:</strong> Reading progress, bookshelf entries, highlights, and time spent reading.</li>
            <li><strong className="text-foreground">Content:</strong> Works, episodes, reviews, comments, and emotion tags you create.</li>
            <li><strong className="text-foreground">Usage data:</strong> Pages visited, features used, and interaction patterns.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">2. How We Use Your Information</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>To provide and improve the Service, including personalized recommendations.</li>
            <li>To generate AI quality scores and analysis for published works.</li>
            <li>To build your reading timeline and self-transformation records.</li>
            <li>To send notifications about activity relevant to your account.</li>
            <li>To maintain platform safety and enforce our terms of service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">3. AI Processing</h2>
          <p>
            Published works are analyzed by AI systems to generate quality scores and improvement suggestions.
            This analysis is performed on our servers and the results are stored in association with the work.
            AI analysis data is not shared with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">4. Data Sharing</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>We do not sell your personal data to third parties.</li>
            <li>Public profile information (display name, bio) is visible to other users.</li>
            <li>Published works and reviews are publicly accessible.</li>
            <li>Reading activity and emotion tags may be shown in aggregated, anonymized form.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">5. Data Storage & Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. Passwords are hashed
            and never stored in plain text. We regularly review our security practices to protect
            your information.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">6. Your Rights</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">Access:</strong> You can view your data through your profile and settings pages.</li>
            <li><strong className="text-foreground">Correction:</strong> You can update your profile information at any time.</li>
            <li><strong className="text-foreground">Deletion:</strong> You can delete your account and associated data through settings.</li>
            <li><strong className="text-foreground">Export:</strong> You may request an export of your data by contacting support.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">7. Cookies</h2>
          <p>
            We use essential cookies for authentication and theme preferences.
            We do not use tracking cookies or third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.15em] uppercase text-foreground mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify users of significant
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
