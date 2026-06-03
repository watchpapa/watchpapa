import ContentPanel from "../../../components/detail/ContentPanel.jsx";
import InfoPageShell from "../../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../../components/ui/PageHead.jsx";

/* ─── About ─────────────────────────────────────────────── */

function AboutPage({ session }) {
  return (
    <>
      <PageHead
        title="About Watchpapa"
        description="Watchpapa is a free media discovery platform powered by TMDB — browse films, shows, and people in one streamlined dashboard."
        path="/about"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "About" }]}
      title="About Watchpapa"
      lead="A streamlined dashboard for discovering and tracking the films, shows, and people that matter to you."
    >
      <h2>What we do</h2>
      <p>
        Watchpapa pulls real-time metadata from{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          The Movie Database (TMDB)
        </a>{" "}
        and organises it into a fast, browsable interface. Search popular titles, dive into cast and
        crew pages, follow upcoming releases on the calendar, and keep everything in one place.
      </p>

      <h2>Core features</h2>
      <ul>
        <li>Browse popular movies, TV shows, and people updated daily.</li>
        <li>Full detail pages with cast, crew, episode guides, and plot overviews.</li>
        <li>Release calendar for domestic and international premiere dates.</li>
        <li>Real-time search with instant filtering — no page reloads.</li>
        <li>Signed-in accounts to save preferences across devices.</li>
      </ul>

      <h2>Data & attribution</h2>
      <p>
        All film and television metadata, imagery, and cast information is supplied by{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          The Movie Database (TMDB)
        </a>
        . Watchpapa is not endorsed, certified, or otherwise approved by TMDB. If you spot an
        inaccuracy in a title, cast list, or release date, the fastest fix is to update it directly
        on{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          themoviedb.org
        </a>{" "}
        — changes propagate to watchpapa automatically.
      </p>

      <h2>Roadmap</h2>
      <p>
        Watchpapa is actively developed. We build in the direction of how people actually explore
        film and TV, so feedback is taken seriously. Head to the{" "}
        <a href="/contact">Contact page</a> to share ideas or report issues.
      </p>
    </InfoPageShell>
    </>
  );
}

/* ─── Help ───────────────────────────────────────────────── */

function HelpPage({ session }) {
  return (
    <>
      <PageHead
        title="Help & FAQ"
        description="Answers to common questions about watchpapa — navigating content, creating an account, release calendars, and reporting problems."
        path="/help"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Help" }]}
      title="Help"
      lead="Quick answers to common questions about using watchpapa."
    >
      <h2>Discovery</h2>
      <p>
        The top navigation gives you quick access to <strong>Popular</strong>,{" "}
        <strong>Movies</strong>, <strong>Shows</strong>, and <strong>People</strong>. On the home
        screen, use the search bar to filter results in real-time as you type — no submit needed.
      </p>

      <h2>Detail pages</h2>
      <p>
        Click any title card to open its detail page. From there you can read the plot overview,
        browse the cast and crew, and — for TV series — step through episode guides by season.
        Clicking a person&apos;s name opens their full filmography.
      </p>

      <h2>Release calendar</h2>
      <p>
        The calendar lists upcoming theatrical and streaming premieres. Release dates are synced
        with TMDB&apos;s regional data, so you may see different dates depending on territory. If a
        date looks wrong, it is likely not yet updated on TMDB.
      </p>

      <h2>Accounts</h2>
      <p>
        Sign in to save your preferences across sessions and devices. If you are locked out, use
        the <strong>Forgot password</strong> link on the sign-in page — a reset link will be sent
        to your registered email address within a few minutes.
      </p>

      <h2>Reporting a problem</h2>
      <p>
        Found a bug or something that looks broken? Use the <a href="/contact">Contact page</a> to
        send us a report. Please include the URL of the affected page and a brief description of
        what you expected versus what happened.
      </p>
    </InfoPageShell>
    </>
  );
}

/* ─── Terms ──────────────────────────────────────────────── */

function TermsPage({ session }) {
  return (
    <>
      <PageHead
        title="Terms of Use"
        description="Read the terms of use for watchpapa. By using the service you agree to these terms."
        path="/terms"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Terms" }]}
      title="Terms of Use"
      lead="Please read these terms carefully before using watchpapa."
    >
      <h2>Acceptance</h2>
      <p>
        By accessing or using watchpapa (&ldquo;the Service&rdquo;), you confirm that you are at
        least 16 years old, located in Europe, and agree to be bound by these Terms of Use. If you
        do not meet these requirements or do not agree, do not use the Service.
      </p>

      <h2>Third-party data</h2>
      <p>
        Film and television content, imagery, and metadata are provided by{" "}
        <a href="https://www.themoviedb.org/terms-of-use" target="_blank" rel="noopener noreferrer">
          The Movie Database (TMDB)
        </a>
        . Your use of that data is also subject to TMDB&apos;s own Terms of Use. Watchpapa is not
        affiliated with or endorsed by TMDB.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape or bulk-download content from the Service in an automated manner.</li>
        <li>Attempt to gain unauthorised access to any part of the platform.</li>
        <li>Use the Service for any unlawful purpose or in violation of applicable law.</li>
        <li>Misrepresent your identity or impersonate another person or organisation.</li>
        <li>Post offensive, defamatory, or harassing content in your profile or comments.</li>
      </ul>

      <h2>Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials. You
        must notify us immediately at <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a>{" "}
        if you suspect unauthorised access to your account.
      </p>

      <h2>User-generated content</h2>
      <p>
        Your username, bio, ratings, and watchlists (&ldquo;your content&rdquo;) are created and
        owned by you. By submitting them to the Service, you grant watchpapa a non-exclusive,
        royalty-free licence to display, distribute, and archive your content on the platform and
        in backups. Ratings and favourites are public by default; you can mark your profile as
        private in Settings to restrict visibility of your activity to other users.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We reserve the right to suspend or terminate your account and access to the Service at any
        time, with or without notice, if we determine in our sole discretion that you have violated
        these Terms or engaged in behaviour that is illegal, abusive, or harmful to other users or
        the platform.
      </p>

      <h2>Changes to the Service and these Terms</h2>
      <p>
        We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at
        any time. We reserve the right to update these Terms at any time. For material changes
        (additions to restrictions, changes to liability, or other significant modifications), we
        will notify you by email at least 14 days before the changes take effect. Continued use
        after that period constitutes acceptance. For minor updates or clarifications, we may update
        the date below without prior notice.
      </p>

      <h2>Geographic availability</h2>
      <p>
        Watchpapa is currently intended for users located in Europe only. By using the Service,
        you confirm that you are accessing it from within Europe. We do not knowingly offer the
        Service to users outside of Europe at this time and make no representations that the Service
        is appropriate or available in other locations. Access from outside Europe is at your own
        risk and you are responsible for compliance with local laws.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by applicable law, watchpapa and its operators shall not be liable
        for any indirect, incidental, special, consequential, or punitive damages arising from your
        use of or inability to use the Service, including loss of data, lost profits, or interruption
        of business, even if advised of the possibility of such damages. Our total liability for any
        claim arising under these Terms shall be limited to the direct damages actually incurred,
        capped at €50.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms of Use are governed by and construed in accordance with the laws of the European
        Union and the Republic of Poland. Any legal action or proceeding arising out of these Terms
        shall be subject to the exclusive jurisdiction of the competent courts of Poland.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind, express or
        implied. We do not guarantee uninterrupted availability, timely updates, or the accuracy of
        third-party metadata. Your use of the Service is at your own risk.
      </p>

      <p className="muted">
        Last updated: <time dateTime="2026-06-03">3 June 2026</time>
      </p>
    </InfoPageShell>
    </>
  );
}

/* ─── Contact ────────────────────────────────────────────── */

function ContactPage({ session }) {
  return (
    <>
      <PageHead
        title="Contact Watchpapa"
        description="Get in touch with the watchpapa team. Email us at support@watchpapa.tv or find us on LinkedIn."
        path="/contact"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Contact" }]}
      title="Get in touch"
      lead="Bug report, feature idea, or just want to say hello — we read everything."
    >
      <ContentPanel label="Email us">
        <p className="text-sm text-[#8080a8]">
          The fastest way to reach the team is by email.
        </p>
        <a
          href="mailto:support@watchpapa.tv"
          className="mt-3 inline-block break-all text-xl font-semibold tracking-tight text-white !no-underline underline-offset-[5px] transition hover:text-[#e4e4ff] hover:!underline sm:text-2xl"
        >
          support@watchpapa.tv
        </a>
      </ContentPanel>

      <div className="flex gap-4 rounded-2xl border border-[#2a3570]/50 bg-[#0f1225] p-5 sm:gap-5 sm:p-6">
        <div
          className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-[#6f6fdc] to-[#4a4a9e]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8383e7]">
            Before you write
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#8888b0]">
            If a release date, cast member, or poster looks wrong, it is usually a short sync lag
            from TMDB. You can help the whole community by correcting it directly on{" "}
            <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
              themoviedb.org
            </a>{" "}
            — changes propagate to watchpapa automatically.
          </p>
        </div>
      </div>

      <h2>Other channels</h2>
      <p>
        Follow company updates and announcements on{" "}
        <a
          href="https://www.linkedin.com/company/watchpapa"
          target="_blank"
          rel="noopener noreferrer"
        >
          watchpapa on LinkedIn
        </a>
        .
      </p>
    </InfoPageShell>
    </>
  );
}

/* ─── Privacy ────────────────────────────────────────────── */

function PrivacyPage({ session }) {
  return (
    <>
      <PageHead
        title="Privacy Policy"
        description="Learn how watchpapa handles your data — we collect only what's necessary and never sell it."
        path="/privacy"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Privacy" }]}
      title="Privacy Policy"
      lead="We collect as little data as possible and never sell it."
    >
      <h2>Data controller</h2>
      <p>
        <strong>Krzysztof Durski</strong> is the data controller responsible for your personal data.
        You can contact the controller at <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        When you create an account, we store your email address, username, and securely hashed password.
        We also collect your date of birth (to verify you are at least 16 and to personalise age-appropriate content),
        your bio text (up to 200 characters), and your display preferences.
      </p>
      <p>
        Your user activity is stored: film and TV show ratings (1–10 scale), watchlists, followed titles, and favourite items.
        We also store your adult content display setting and authentication tokens as browser storage
        (localStorage with your consent, or sessionStorage without consent).
      </p>
      <p>
        For security and abuse prevention, we log your IP address and request metadata (method, path, timestamp).
      </p>
      <p>
        We do not collect names, postal addresses, phone numbers, or payment information.
      </p>

      <h2>How we use your data</h2>
      <p>
        Your email and password hash enable you to sign in across devices. Your date of birth confirms you meet
        the age requirement (16+) and helps us filter adult content if you choose.
      </p>
      <p>
        Ratings, watchlists, follows, and favourites are stored so you can manage your activity. Your username,
        bio, ratings, and favourites are public and visible to other users unless you mark your profile as private.
      </p>
      <p>
        IP logs and audit events help us detect and prevent unauthorized access and abuse. localStorage keeps you
        signed in across tabs and browser restarts (with your consent); sessionStorage logs you out when the tab
        closes (without consent).
      </p>
      <p>
        We do not build advertising profiles or sell data to third parties. If you opt in during registration
        or in Settings, we may send occasional product updates and announcements to your email. You can change
        this preference at any time in your Settings.
      </p>

      <h2>Legal basis for processing</h2>
      <p>
        We process your data under the following legal bases (GDPR Article 6): account creation, authentication, and
        all features tied to your account (ratings, watchlists, follows) are based on contract performance. Age
        verification is required by GDPR Article 8 (protection of children's data). Persistent session storage
        (localStorage) requires your consent, which you provide via the cookie banner on first visit. Security logging
        (IP addresses and request metadata) is based on our legitimate interest in preventing abuse and detecting threats.
      </p>

      <h2>Data processors and third-party services</h2>
      <p>Your data is processed by the following services:</p>
      <ul>
        <li><strong>Supabase</strong> (auth and database, EU) — stores your account data and user activity</li>
        <li><strong>DigitalOcean</strong> (backend API, Netherlands) — handles requests on our application servers</li>
        <li><strong>Cloudflare</strong> (CDN, USA) — caches static content and terminates SSL connections</li>
        <li><strong>Resend</strong> (transactional email, USA) — sends password resets and account notifications</li>
        <li><strong>Google</strong> (optional social sign-in, USA) — processes your email and basic profile information if you choose this method</li>
        <li><strong>GitHub</strong> (optional social sign-in, USA) — processes your email and basic profile information if you choose this method</li>
        <li><strong>TMDB</strong> (content metadata, USA) — provides film and TV show information. Your watchpapa data is not shared with TMDB</li>
      </ul>
      <p>
        All transfers to USA-based processors (Cloudflare, Resend, Google, GitHub) are protected by Standard Contractual Clauses approved by the European Commission.
        Changes to our data processors will be announced in the <a href="/updates">Updates</a> section of the platform.
      </p>

      <h2>International data transfers</h2>
      <p>
        Some of our processors are located in the USA (Cloudflare, Resend, Google, GitHub). Transfers
        to the USA are protected by Standard Contractual Clauses approved by the European Commission
        under GDPR Article 46(2)(c). This ensures your data receives adequate protection even though
        US data protection laws differ from EU standards.
      </p>

      <h2>Session storage and cookies</h2>
      <p>
        When you sign in, we store your authentication token in your browser. You control where it is stored:
      </p>
      <ul>
        <li><strong>With consent</strong> (Accept on the banner): token stored in localStorage — persists across tabs and browser restarts until you sign out</li>
        <li><strong>Without consent</strong> (Decline on the banner): token stored in sessionStorage — cleared when you close the tab</li>
      </ul>
      <p>
        We also store a consent preference cookie so we remember your choice. These are essential to operating
        the service and do not require explicit consent under the ePrivacy Directive.
      </p>
      <p>We do not use tracking, advertising, or analytics cookies.</p>

      <h2>Data retention</h2>
      <p>
        Account data (email, username, bio, ratings, watchlists) is retained until you delete your account,
        then permanently removed within 30 days. Security audit logs (IP address, request details) are retained
        for 90 days, then automatically deleted. Session tokens are cleared on logout or when the browser tab
        closes (depending on consent).
      </p>

      <h2>Your rights under GDPR</h2>
      <p>
        You have the right to access a copy of your personal data (available via Settings → Export as CSV),
        to correct inaccurate or incomplete data, and to delete your account and all associated data
        (available via Settings → Delete Account). You can also request that we limit how your data is used,
        receive your data in a portable format (CSV export available in Settings), or object to processing
        for legitimate interests.
      </p>
      <p>
        If your data is used for automated decisions, you have the right to request human review. If you believe
        watchpapa has violated your data protection rights, you have the right to lodge a complaint with your local
        data protection supervisory authority.
      </p>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a>.
      </p>

      <h2>Data protection supervisory authority</h2>
      <p>
        If you believe watchpapa has violated your data protection rights, you have the right to lodge a complaint
        with the data protection supervisory authority in your EU member state. These authorities have the power
        to investigate and take enforcement action on your behalf, at no cost to you.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. For material changes (changes that expand what data we collect
        or how we use it), we will announce them in the <a href="/updates">Updates</a> section at least 14 days before
        the changes take effect. Continued use of the service after that period constitutes acceptance of the updated
        policy. For minor clarifications or corrections, we will update the date below without prior notice.
      </p>

      <p className="muted">
        Last updated: <time dateTime="2026-06-03">3 June 2026</time>
      </p>
    </InfoPageShell>
    </>
  );
}

export { AboutPage, ContactPage, HelpPage, PrivacyPage, TermsPage };
