import ContentPanel from "../../../components/detail/ContentPanel.jsx";
import InfoPageShell from "../../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../../components/ui/PageHead.jsx";

/* ─── About ─────────────────────────────────────────────── */

function AboutPage({ session }) {
  return (
    <>
      <PageHead
        title="About WATCHPAPA"
        description="WATCHPAPA is a free media discovery platform powered by TMDB — browse films, shows, and talent in one streamlined dashboard."
        path="/about"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "About" }]}
      title="About WATCHPAPA"
      lead="A streamlined dashboard for discovering and tracking the films, shows, and talent that matter to you."
    >
      <h2>What we do</h2>
      <p>
        WATCHPAPA pulls real-time metadata from{" "}
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
        . WATCHPAPA is not endorsed, certified, or otherwise approved by TMDB. If you spot an
        inaccuracy in a title, cast list, or release date, the fastest fix is to update it directly
        on{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          themoviedb.org
        </a>{" "}
        — changes propagate to WATCHPAPA automatically.
      </p>

      <h2>Roadmap</h2>
      <p>
        WATCHPAPA is actively developed. We build in the direction of how people actually explore
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
        description="Answers to common questions about WATCHPAPA — navigating content, creating an account, release calendars, and reporting problems."
        path="/help"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Help" }]}
      title="Help"
      lead="Quick answers to common questions about using WATCHPAPA."
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
        description="Read the terms of use for WATCHPAPA. By using the service you agree to these terms."
        path="/terms"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Terms" }]}
      title="Terms of Use"
      lead="Please read these terms carefully before using WATCHPAPA."
    >
      <h2>Acceptance</h2>
      <p>
        By accessing or using WATCHPAPA (&ldquo;the Service&rdquo;), you confirm that you are at
        least 13 years old, located in Europe, and agree to be bound by these Terms of Use. If you
        do not meet these requirements or do not agree, do not use the Service.
      </p>

      <h2>Third-party data</h2>
      <p>
        Film and television content, imagery, and metadata are provided by{" "}
        <a href="https://www.themoviedb.org/terms-of-use" target="_blank" rel="noopener noreferrer">
          The Movie Database (TMDB)
        </a>
        . Your use of that data is also subject to TMDB&apos;s own Terms of Use. WATCHPAPA is not
        affiliated with or endorsed by TMDB.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape or bulk-download content from the Service in an automated manner.</li>
        <li>Attempt to gain unauthorised access to any part of the platform.</li>
        <li>Use the Service for any unlawful purpose or in violation of applicable law.</li>
        <li>Misrepresent your identity or impersonate another person or organisation.</li>
      </ul>

      <h2>Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials. You
        must notify us immediately at <a href="mailto:support@WATCHPAPA.tv">support@WATCHPAPA.tv</a>{" "}
        if you suspect unauthorised access to your account.
      </p>

      <h2>Modifications</h2>
      <p>
        We reserve the right to update these Terms at any time. Continued use of the Service after
        changes are posted constitutes acceptance of the revised Terms. The date of the most recent
        revision is shown below.
      </p>

      <h2>Geographic availability</h2>
      <p>
        WATCHPAPA is currently intended for users located in Europe only. By using the Service,
        you confirm that you are accessing it from within Europe. We do not knowingly offer the
        Service to users outside of Europe at this time and make no representations that the Service
        is appropriate or available in other locations. Access from outside Europe is at your own
        risk and you are responsible for compliance with local laws.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind, express or
        implied. We do not guarantee uninterrupted availability or the accuracy of third-party
        metadata.
      </p>

      <p className="muted">
        Last updated: <time dateTime="2026-05-21">21 May 2026</time>
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
        title="Contact WATCHPAPA"
        description="Get in touch with the WATCHPAPA team. Email us at support@WATCHPAPA.tv or find us on LinkedIn."
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
          href="mailto:support@WATCHPAPA.tv"
          className="mt-3 inline-block break-all text-xl font-semibold tracking-tight text-white !no-underline underline-offset-[5px] transition hover:text-[#e4e4ff] hover:!underline sm:text-2xl"
        >
          support@watchpapa.tv
        </a>
      </ContentPanel>

      <div className="flex gap-4 rounded-2xl border border-[#1a1f3a] bg-[#0f1225] p-5 sm:gap-5 sm:p-6">
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
            — changes propagate to WATCHPAPA automatically.
          </p>
        </div>
      </div>

      <h2>Other channels</h2>
      <p>
        Follow company updates and announcements on{" "}
        <a
          href="https://www.linkedin.com/company/WATCHPAPA"
          target="_blank"
          rel="noopener noreferrer"
        >
          WATCHPAPA on LinkedIn
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
        description="Learn how WATCHPAPA handles your data — we collect only what's necessary and never sell it."
        path="/privacy"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Privacy" }]}
      title="Privacy Policy"
      lead="We collect as little data as possible and never sell it."
    >
      <h2>What we collect</h2>
      <p>
        When you create an account we store your <strong>email address</strong>, a securely hashed
        password, and your <strong>date of birth</strong> (used to personalise age-appropriate
        content). We do not collect names, addresses, or payment information.
      </p>

      <h2>How it is used</h2>
      <ul>
        <li>Your email is used for authentication and, if you opt in, product updates.</li>
        <li>We do not build advertising profiles or sell data to third parties.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        WATCHPAPA fetches media content from{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          TMDB
        </a>
        . Your WATCHPAPA account data is <strong>not</strong> shared with TMDB. We use{" "}
        <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer">
          Supabase
        </a>{" "}
        to store account data; all data is stored in the EU and subject to their{" "}
        <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </p>

      <h2>Cookies</h2>
      <p>
        We use <strong>essential cookies only</strong> — to keep you signed in and to remember
        filter preferences across sessions. We do not use tracking or advertising cookies.
      </p>

      <h2>Data retention & your rights</h2>
      <p>
        You may delete your account and all associated data at any time from your account settings.
        On deletion, your personal data is permanently removed within 30 days. You may also request
        a copy of your data or ask us to correct inaccuracies by emailing{" "}
        <a href="mailto:support@WATCHPAPA.tv">support@WATCHPAPA.tv</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy at any time. When we do, we will revise the date below. We
        recommend checking this page periodically. We cannot guarantee that change notifications
        will be delivered by email.
      </p>

      <p className="muted">
        Last updated: <time dateTime="2026-05-13">13 May 2026</time>
      </p>
    </InfoPageShell>
    </>
  );
}

export { AboutPage, ContactPage, HelpPage, PrivacyPage, TermsPage };
