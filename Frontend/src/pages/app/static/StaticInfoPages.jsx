import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContentPanel from "../../../components/detail/ContentPanel.jsx";
import InfoPageShell from "../../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../../components/ui/PageHead.jsx";
import { useCertifications } from "../../../features/content/hooks/useContent.js";
import { usePreferences } from "../../../features/preferences/PreferencesContext.jsx";

const LAST_UPDATED = { iso: "2026-09-05", label: "5 September 2026" };

function Ext({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/* ─── About ─────────────────────────────────────────────── */

function AboutPage({ session }) {
  return (
    <>
      <PageHead
        title="About watchpapa"
        description="watchpapa is a free tracker for the movies and shows you care about — upcoming releases, where to stream, what you've watched, and what to watch next. Powered by live TMDB data."
        path="/about"
      />
      <InfoPageShell
        session={session}
        breadcrumbs={[{ label: "About" }]}
        title="About watchpapa"
        lead="One place for the films and shows you care about — what’s coming, where it streams, what you’ve watched, and what to watch next."
      >
        <h2>Why it exists</h2>
        <p>
          watchpapa started with a small, annoying problem. You’re watching a few shows — one
          weekly, one between seasons — and waiting on a couple of films, and nothing tells you when
          the next thing actually drops. So: follow the titles you’re waiting for, and the{" "}
          <Link to="/calendar">Releases Radar</Link> lays every upcoming episode and premiere out
          on one calendar.
        </p>
        <p>
          It has grown a lot since then. Today watchpapa is also where you rate what you watch, keep
          a rewatch diary, find out where a title streams in your country, get suggestions based on
          your taste, and see what the people you observe are watching.
        </p>

        <h2>What you can do</h2>
        <ul>
          <li>
            <span>
              <strong>Track releases.</strong> Follow shows and upcoming movies; the Releases Radar
              shows every new episode and premiere in one calendar, with dates for your country.
            </span>
          </li>
          <li>
            <span>
              <strong>Discover.</strong> Browse popular, top-rated and coming-soon titles by genre,
              search movies, shows and people, and explore franchise collections and full
              filmographies.
            </span>
          </li>
          <li>
            <span>
              <strong>See where to watch.</strong> Streaming, rental and purchase availability for up
              to five countries, on every movie and show page.
            </span>
          </li>
          <li>
            <span>
              <strong>Get suggestions.</strong> A “Suggested for you” row built from what you’ve rated
              and watched — optionally narrowed to your own streaming services.
            </span>
          </li>
          <li>
            <span>
              <strong>Rate and log.</strong> Rate movies, shows, seasons and episodes on a 1–10 heart
              scale, keep a dated rewatch diary, and organise what’s next into watchlists.
            </span>
          </li>
          <li>
            <span>
              <strong>Make it yours.</strong> Content in your language, original or translated titles,
              a customisable home page, an avatar, and a public profile with favourites and stats.
            </span>
          </li>
          <li>
            <span>
              <strong>Watch together.</strong> Observe other people, see their ratings in an activity
              feed and on title pages — or keep your account private.
            </span>
          </li>
          <li>
            <span>
              <strong>Bring your history.</strong> Import from Letterboxd, and export everything as
              CSV whenever you like.
            </span>
          </li>
        </ul>
        <p className="muted">
          The <Link to="/help">Help page</Link> walks through each of these in detail.
        </p>

        <h2>Free to use</h2>
        <p>
          watchpapa is free, and there is nothing to buy yet. Bigger plans are earned instead: the
          first 5,000 accounts get lifetime Premium, inviting friends earns temporary Pro, and reward
          codes appear from time to time. See <Link to="/subscription">Plans &amp; Perks</Link> for
          what each plan includes and <strong>Settings → Plan &amp; rewards</strong> for your
          referral code.
        </p>
        <p>
          There are no ads, no trackers and no analytics cookies. The only data stored is your
          account and your own activity — see the <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Data &amp; attribution</h2>
        <p>
          All film and television metadata, imagery and cast information comes from{" "}
          <Ext href="https://www.themoviedb.org/">The Movie Database (TMDB)</Ext>, read live rather
          than copied — what you see is what TMDB has right now, cached for at most a day. Streaming
          availability is provided by <Ext href="https://www.justwatch.com">JustWatch</Ext> through
          TMDB. watchpapa is not endorsed, certified or otherwise approved by TMDB or JustWatch.
        </p>
        <p>
          If a title, cast list, release date or poster looks wrong, the fastest fix is to correct it
          on <Ext href="https://www.themoviedb.org/">themoviedb.org</Ext> — it improves the data for
          everyone, and the change reaches watchpapa within hours.
        </p>

        <h2>How it’s built</h2>
        <p>
          watchpapa is an independent project built and run by Krzysztof Durski in Poland. The site
          and its API run on Cloudflare’s edge network; your account and activity live in a Supabase
          PostgreSQL database hosted in the EU. Content is never stored on our side — every page asks
          TMDB for the latest data.
        </p>

        <h2>What’s next</h2>
        <p>
          watchpapa is actively developed and every release is written up on the{" "}
          <Link to="/updates">Updates page</Link>. Ideas, bug reports and requests are genuinely
          welcome — the <Link to="/contact">Contact page</Link> is the place for them.
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
        description="How to use watchpapa — following and the Releases Radar, ratings, the rewatch diary, watchlists, suggestions, where to watch, language settings, profiles, observing people, adult content, import/export, plans and your account."
        path="/help"
      />
      <InfoPageShell
        session={session}
        breadcrumbs={[{ label: "Help" }]}
        title="Help"
        lead="Answers to common questions, grouped by what you’re trying to do."
      >
        <h2>Getting around</h2>
        <h3>What’s in the header?</h3>
        <p>
          <strong>Popular</strong> (the home page), <strong>Movies</strong>, <strong>Shows</strong>,{" "}
          <strong>People</strong> and a <strong>More</strong> menu for{" "}
          <strong>Collections</strong>, <strong>My Services</strong> and, if you’ve turned it on,{" "}
          <strong>Adult</strong>. Search sits in the header — always visible on desktop, behind the
          magnifying-glass icon on phones and tablets. When you’re signed in you also get the
          Releases Radar and notification bell as icons, and your profile circle on the right —
          click it (not hover) for your account menu: profile, edit profile, settings, your plan,
          watchlists, follows, activity, find people, observe requests and sign out.
        </p>
        <h3>What’s the bar at the bottom on my phone?</h3>
        <p>
          On phones, a bottom tab bar replaces the account menu: <strong>Home</strong>,{" "}
          <strong>Browse</strong> (opens the same menu the header’s More button does),{" "}
          <strong>Search</strong>, <strong>Radar</strong> and <strong>You</strong> (your account
          menu, notifications and requests included).
        </p>
        <h3>Can I change what the home page shows?</h3>
        <p>
          Yes. <strong>Settings → Home page</strong> lets you reorder every row and hide the ones you
          don’t want. Available on every plan.
        </p>

        <h2>Following &amp; the Releases Radar</h2>
        <h3>What does following do?</h3>
        <p>
          Following a show or an upcoming movie puts its releases on your{" "}
          <Link to="/calendar">Releases Radar</Link> calendar. Today’s releases are highlighted, and
          several episodes from one season landing on the same day collapse into a single “Season X”
          row. Everything you follow is listed on the <Link to="/follows">Follows page</Link>, with
          each title’s status and an unfollow button.
        </p>
        <h3>Why can’t I follow this title?</h3>
        <p>
          Following is for things that are still coming. A movie that has already been released, or
          a show that has ended or been cancelled, can’t be newly followed — add it to a watchlist or
          rate it instead. Titles you followed before they ended are not affected.
        </p>
        <h3>How many titles can I follow?</h3>
        <p>
          It depends on your plan — see <Link to="/subscription">Plans &amp; Perks</Link>. If a
          temporary upgrade ends and you’re over your limit, the Releases Radar is paused until you
          unfollow enough titles on the Follows page.
        </p>
        <h3>The release date looks wrong for my country.</h3>
        <p>
          Set your <strong>Country</strong> in <strong>Settings → Content &amp; region</strong>.
          Release dates then follow that country wherever TMDB has a regional date. If the date is
          still wrong, it is most likely wrong on TMDB — see “Reporting a problem” below.
        </p>

        <h2>Search &amp; browsing</h2>
        <h3>How do I search?</h3>
        <p>
          The search field is in the header — always visible on desktop, behind the magnifying-glass
          icon on phones and tablets. Suggestions appear as you type; press Enter for the full{" "}
          <Link to="/search">results page</Link>, where you can filter by type (movies, shows,
          people), sort by relevance, popularity, rating, release date or title, and load more.
        </p>
        <h3>What are Collections?</h3>
        <p>
          Franchises and film series as TMDB groups them — every movie in a collection, in order. A
          movie page that belongs to a collection links to it, and the{" "}
          <Link to="/collections">Collections</Link> page lets you search for one by name. There is
          no “browse all” list, because TMDB doesn’t offer one. Collections are movies only.
        </p>
        <h3>What does the badge next to the genres mean?</h3>
        <p>
          That is the title’s age certification for your country (for example PG-13, 15 or TV-MA).
          Click it for a country-by-country explainer on the{" "}
          <Link to="/certifications">Certifications page</Link>. Not every title is certified in
          every country.
        </p>
        <h3>People pages</h3>
        <p>
          A person’s filmography shows one card per title (even when they had several roles), newest
          first. Filter by Movies or Shows and by department, and sort by date, popularity, rating or
          title.
        </p>

        <h2>Ratings</h2>
        <h3>How do ratings work?</h3>
        <p>
          Movies, shows, seasons and episodes can all be rated on a 1–10 heart scale from the sidebar
          of their page — hover to preview, click to set. Titles that haven’t been released yet can’t
          be rated. Once at least 10 people have rated something, its page shows a community
          histogram; before that you’ll see TMDB’s average instead.
        </p>
        <h3>How do I change or remove a rating?</h3>
        <p>
          Once you’ve rated something the hearts lock, so a stray click can’t overwrite it. Use{" "}
          <strong>Change</strong> to pick a new value or <strong>Clear</strong> to remove it. Every
          change is kept in a collapsible <strong>rating history</strong> under the hearts;
          individual history entries can be deleted.
        </p>
        <h3>What else does rating do?</h3>
        <ul>
          <li>
            <span>
              It marks the title as watched (see the rewatch diary below) and removes it from your
              watchlists.
            </span>
          </li>
          <li>
            <span>
              Ratings of 6 hearts and up feed “Suggested for you”.
            </span>
          </li>
          <li>
            <span>
              Your ratings appear on your profile and, unless your account is private, to anyone who
              observes you.
            </span>
          </li>
        </ul>

        <h2>Watched &amp; the rewatch diary</h2>
        <h3>How do I mark something watched?</h3>
        <p>
          Every movie and show page has a <strong>Watched</strong> control. Click{" "}
          <strong>Mark watched</strong> once to log today. After that it becomes a{" "}
          <strong>Watched</strong> chip (“Watched · 3×” once you’ve rewatched it) — tap it to open
          your rewatch diary, log another watch on a date of your choice, and see the full history
          with a remove button per entry. Remove them all and the title goes back to unwatched.
        </p>
        <h3>Do I have to mark things manually?</h3>
        <p>
          No. Rating a movie or show marks it watched automatically, and rating every season (or
          every episode of every season) of a show marks the whole show. Watched titles disappear
          from your watchlists and from “Suggested for you”.
        </p>

        <h2>Watchlists</h2>
        <h3>How do watchlists work?</h3>
        <p>
          Use the bookmark button on a movie or show page. One click adds the title to your first
          list; the picker lets you tick several lists at once. All your lists are tabs on the{" "}
          <Link to="/watchlists">Watchlists page</Link>, where each item can be removed or marked
          watched. A watchlist is strictly a to-watch list: rating a title or logging a watch
          removes it from every list.
        </p>
        <h3>How many lists can I have?</h3>
        <p>
          Free accounts get 1, Premium 3, Pro and Pro+ 10 — see{" "}
          <Link to="/subscription">Plans &amp; Perks</Link>.
        </p>

        <h2>Suggested for you</h2>
        <h3>Where do the suggestions come from?</h3>
        <p>
          From your own taste: titles you rated 6 hearts or higher and titles you’ve marked watched
          are used as seeds, TMDB’s recommendations for each seed are gathered, and candidates that
          several of your seeds point to rank highest. Anything you’ve already rated, watched,
          watchlisted or followed is left out. The row keeps loading as you scroll. If it’s empty or
          thin, rate a handful of titles you love and it fills in.
        </p>
        <h3>What is “Suggested For You · On Your Services”?</h3>
        <p>
          The same list, narrowed to titles available on the streaming services you picked in
          Settings. Picking services is a Pro feature — see “Where to watch” below.
        </p>

        <h2>Language, country &amp; titles</h2>
        <h3>Can I see content in my language?</h3>
        <p>
          Yes. In <strong>Settings → Content &amp; region</strong> choose a{" "}
          <strong>Content language</strong>: titles and overviews switch to it wherever TMDB has a
          translation, and fall back to English where it doesn’t. The <strong>Titles</strong> setting
          offers a second mode — original titles for films and shows from your language, English for
          everything else — for people who know “Ida” but not its translated title.
        </p>
        <h3>What does Country change?</h3>
        <p>
          Release dates, the Coming Soon rows, and which certification badge you see. If you’re not
          signed in, a country you pick is remembered in your browser only.
        </p>

        <h2>Where to watch &amp; streaming services</h2>
        <h3>How do I see where a title is streaming?</h3>
        <p>
          Every movie and show page has a <strong>Where to watch</strong> panel with Stream, Free,
          Rent and Buy options per country. Pick up to five <strong>watch regions</strong> in{" "}
          <strong>Settings → Streaming</strong> (any plan) and the panel opens on those. If a title
          isn’t available in your regions, <strong>See where it’s available</strong> lets you browse
          every country that has it. Availability data comes from JustWatch through TMDB and can lag
          behind a service’s catalogue by a little.
        </p>
        <h3>What does picking “My streaming services” do?</h3>
        <p>
          It personalises watchpapa around the services you actually pay for: an{" "}
          <strong>Available on your services</strong> row on Movies and Shows,{" "}
          <strong>Popular · On Your Services</strong> and{" "}
          <strong>Suggested For You · On Your Services</strong> on the home page, and the{" "}
          <Link to="/my-services">My Services</Link> page — Popular, Top Rated and Suggested
          across your services, plus a “Popular on…” row for each one. Picking services requires Pro
          or higher; watch regions alone work on every plan.
        </p>

        <h2>Profiles, avatars &amp; sharing</h2>
        <h3>What’s on my profile?</h3>
        <p>
          Your profile lives at <strong>/u/your-username</strong>: avatar, bio (up to 200
          characters), up to five pinned favourites, your ratings (with a full, sortable ratings
          page) and stats. Basic stats are visible on every plan; top genres unlock with Premium,
          decades and the monthly activity heatmap with Pro. Edit everything under{" "}
          <Link to="/profile/edit">Edit profile</Link>.
        </p>
        <h3>How do avatars work?</h3>
        <p>
          The default is your initial. Any plan can use a movie or show poster as an avatar; Pro and
          above can upload and crop a photo of their own. Both options are in Edit profile.
        </p>
        <h3>Can I share my profile or a title?</h3>
        <p>
          The <strong>Share</strong> button on your profile generates a profile card in Story,
          Square or Wide format to download or share. Other people can only generate a card of your
          profile if you switch on <strong>Allow profile sharing</strong> in{" "}
          <strong>Settings → Privacy</strong> (off by default). Movie and show pages have their own
          share cards, with an optional caption.
        </p>
        <h3>Can I download a poster?</h3>
        <p>
          Click the poster on any movie, show, season or collection page for a full-size preview with
          a download button.
        </p>

        <h2>Observing people, activity &amp; notifications</h2>
        <h3>What does “observe” mean?</h3>
        <p>
          Observing someone is a one-way follow. Find people by username on{" "}
          <Link to="/users">Find People</Link>; public accounts are observed instantly, private
          accounts receive a request they can accept or decline on their{" "}
          <Link to="/observe-requests">Observe requests</Link> page. Your{" "}
          <Link to="/feed">Activity</Link> feed shows recent ratings from everyone you observe, and
          movie and show pages show how the people you observe rated that title.
        </p>
        <h3>What notifications will I get?</h3>
        <p>
          Someone started observing you, someone requested to observe you, or a request of yours was
          accepted. They live behind the bell in your profile menu and can be cleared all at once.
          watchpapa doesn’t send notification emails.
        </p>
        <h3>How do I make my account private?</h3>
        <p>
          Switch on <strong>Private account</strong> in <strong>Settings → Privacy</strong>. People
          must then request to observe you, and your ratings and stats stay hidden until you approve
          them. Your username, avatar, bio and favourites remain visible.
        </p>
        <h3>Can I block someone?</h3>
        <p>
          Yes — from their profile. Blocking removes any observe relationship in both directions and
          hides your activity from them. Manage your blocked list under{" "}
          <strong>Settings → Privacy → Blocked users</strong>.
        </p>

        <h2>Adult content</h2>
        <h3>Is adult content shown?</h3>
        <p>
          Not unless you turn it on. <strong>Show adult content</strong> in{" "}
          <strong>Settings → Preferences</strong> is only offered to accounts whose date of birth
          shows they are 18 or older. watchpapa’s filter goes beyond TMDB’s own adult flag — it also
          catches erotica and similar titles by keyword — so a small number of borderline titles may
          be hidden or shown by mistake; let us know if you spot one.
        </p>
        <h3>What are “Blur NSFW posters” and the Adult tab?</h3>
        <p>
          With adult content on, <strong>Blur NSFW posters</strong> (on by default) hides adult
          posters behind a tap-to-reveal overlay wherever they appear. <strong>Adult tab in
          navigation</strong> is a separate opt-in that adds an Adult section to the More menu (and
          the drawer on phones) — a filterable, sortable grid of adult titles with a warning shown
          before anything loads.
        </p>
        <h3>The adult content switch is greyed out.</h3>
        <p>
          Your account has no date of birth on file — this affects some early Google and GitHub
          sign-ups. Set it once under <strong>Settings → Profile → Date of birth</strong>; the
          switch unlocks immediately if you’re 18+.
        </p>

        <h2>Import &amp; export</h2>
        <h3>Can I import from Letterboxd?</h3>
        <p>
          Yes. Export your data from Letterboxd, then open the <Link to="/import">Import page</Link>{" "}
          and upload the files (ratings, watchlist and watched history are all supported). Titles are
          matched to TMDB automatically; anything that can’t be matched is listed so nothing is
          silently lost. Letterboxd ratings are converted from a 5-star to the 10-heart scale.
          Letterboxd exports are movies only.
        </p>
        <h3>Can I get my data out?</h3>
        <p>
          <strong>Settings → Your data → Export my data</strong> downloads a CSV of your ratings and
          watchlists. The same file can be re-imported on the Import page.
        </p>

        <h2>Plans, referrals &amp; reward codes</h2>
        <p>
          watchpapa is free and there is nothing to buy yet. Bigger plans come from being an early
          adopter, inviting friends, or redeeming a reward code — all of it is explained on{" "}
          <Link to="/subscription">Plans &amp; Perks</Link>. Your referral code and the reward-code
          box are under <strong>Settings → Plan &amp; rewards</strong>.
        </p>

        <h2>Your account</h2>
        <h3>How do I sign in?</h3>
        <p>
          With email and password, or with Google or GitHub. New email accounts confirm their address
          with a one-time code. Locked out? Use <strong>Forgot password</strong> on the sign-in page.
        </p>
        <h3>Can I change my username?</h3>
        <p>
          Yes, under <strong>Settings → Profile</strong>, once every 90 days.
        </p>
        <h3>Can I change my date of birth?</h3>
        <p>
          It can be set once if it’s missing, but not edited afterwards — it’s used for the 16+
          requirement and the adult-content gate. If it was entered wrongly,{" "}
          <Link to="/contact">contact us</Link>.
        </p>
        <h3>How do I stop product emails?</h3>
        <p>
          Toggle <strong>Product updates &amp; announcements</strong> in{" "}
          <strong>Settings → Preferences</strong>. Account emails such as password resets are always
          sent.
        </p>
        <h3>How do I delete my account?</h3>
        <p>
          <strong>Settings → Account → Delete account</strong>. It’s immediate and permanent: your
          profile, ratings, diary, watchlists, follows and everything else is removed. Export first
          if you want a copy.
        </p>

        <h2>Reporting a problem</h2>
        <h3>The data for a title is wrong.</h3>
        <p>
          Titles, cast, dates and posters come live from TMDB, so the right fix is on{" "}
          <Ext href="https://www.themoviedb.org/">themoviedb.org</Ext> — anyone can edit. watchpapa
          caches each title for up to a day, so allow a little time for the correction to show up.
        </p>
        <h3>Something in the app is broken.</h3>
        <p>
          Use the <Link to="/contact">Contact page</Link>. Include the address of the page, what you
          did, what you expected, and what happened instead — a screenshot helps enormously.
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
        description="The terms of use for watchpapa — eligibility, acceptable use, your content, adult content, plans and referrals, and liability."
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
          By accessing or using watchpapa (“the Service”), you confirm that you are at least 16
          years old, located in Europe, and agree to be bound by these Terms of Use and our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not meet these requirements or do not
          agree, do not use the Service.
        </p>

        <h2>Third-party data</h2>
        <p>
          Film and television content, imagery and metadata are provided by{" "}
          <Ext href="https://www.themoviedb.org/terms-of-use">The Movie Database (TMDB)</Ext>.
          Streaming availability is provided by <Ext href="https://www.justwatch.com">JustWatch</Ext>{" "}
          through TMDB. Your use of that data is also subject to TMDB’s own Terms of Use. watchpapa
          is not affiliated with or endorsed by TMDB or JustWatch, and does not guarantee the
          accuracy, completeness or timeliness of their data.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            <span>Scrape, crawl or bulk-download content from the Service in an automated manner.</span>
          </li>
          <li>
            <span>Attempt to gain unauthorised access to any part of the platform or its data.</span>
          </li>
          <li>
            <span>Use the Service for any unlawful purpose or in violation of applicable law.</span>
          </li>
          <li>
            <span>Misrepresent your identity or impersonate another person or organisation.</span>
          </li>
          <li>
            <span>
              Use an offensive, defamatory, harassing or hateful username, bio or avatar, or upload an
              avatar image that is sexually explicit, unlawful, or that you do not have the right to
              use.
            </span>
          </li>
          <li>
            <span>
              Create multiple or fake accounts, or otherwise game the referral, early-adopter or
              reward-code systems.
            </span>
          </li>
          <li>
            <span>
              Use the observe feature to harass, stalk or intimidate another user, or to circumvent a
              block.
            </span>
          </li>
        </ul>

        <h2>Accounts</h2>
        <p>
          One account per person. You are responsible for maintaining the confidentiality of your
          account credentials and for all activity under your account. Notify us immediately at{" "}
          <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a> if you suspect unauthorised
          access. Usernames may be changed once every 90 days; your date of birth is set once and is
          used for age requirements.
        </p>

        <h2>Your content</h2>
        <p>
          Your username, bio, avatar, ratings, rating history, rewatch diary, watchlists, favourites
          and follows (“your content”) are created and owned by you. By submitting them to the
          Service, you grant watchpapa a non-exclusive, royalty-free licence to store, display and
          distribute your content on the platform and in backups, for as long as your account exists.
        </p>
        <p>
          Your username, avatar, bio and favourites are visible to everyone. Ratings and profile
          stats are public by default; switch on <strong>Private account</strong> in Settings to show
          them only to observers you approve. Watchlists, your rewatch diary, rating history and
          followed titles are visible only to you. Share cards are generated at your request and can
          include your ratings; other users can generate a card of your profile only if you enable
          it.
        </p>
        <p>
          For avatars you upload, you confirm you own the image or have permission to use it. We may
          remove content or reset an avatar, username or bio that violates these Terms.
        </p>

        <h2>Adult content</h2>
        <p>
          Adult and erotic titles are hidden by default. You may enable them only if you are at least
          18 years old, as verified by the date of birth on your account. Classification comes from
          TMDB’s data and from watchpapa’s own keyword filter and may be imperfect. You are
          responsible for ensuring that viewing such material is lawful where you are.
        </p>

        <h2>Plans, referrals and rewards</h2>
        <p>
          The Service is currently free. Plan upgrades earned through early adoption, referrals or
          reward codes are discretionary perks, not purchases, and carry no monetary value. We may
          change what a plan includes, revoke rewards obtained through fake accounts or other abuse,
          and end or modify the referral programme at any time. Where a plan mentions ads, this
          describes how that plan will behave if advertising is introduced; no ads are shown today.
        </p>

        <h2>Suspension and termination</h2>
        <p>
          We reserve the right to suspend or terminate your account and access to the Service at any
          time, with or without notice, if we determine in our sole discretion that you have violated
          these Terms or engaged in behaviour that is illegal, abusive, or harmful to other users or
          the platform. You may delete your account at any time from Settings.
        </p>

        <h2>Changes to the Service and these Terms</h2>
        <p>
          We reserve the right to modify, suspend or discontinue the Service (or any part of it) at
          any time. We reserve the right to update these Terms at any time. For material changes
          (additions to restrictions, changes to liability, or other significant modifications), we
          will notify you by email at least 14 days before the changes take effect. Continued use
          after that period constitutes acceptance. For minor updates or clarifications, we may update
          the date below without prior notice.
        </p>

        <h2>Geographic availability</h2>
        <p>
          watchpapa is currently intended for users located in Europe only. By using the Service, you
          confirm that you are accessing it from within Europe. We do not knowingly offer the Service
          to users outside of Europe at this time and make no representations that the Service is
          appropriate or available in other locations. Access from outside Europe is at your own risk
          and you are responsible for compliance with local laws.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by applicable law, watchpapa and its operators shall not be liable
          for any indirect, incidental, special, consequential or punitive damages arising from your
          use of or inability to use the Service, including loss of data, lost profits, or
          interruption of business, even if advised of the possibility of such damages. Our total
          liability for any claim arising under these Terms shall be limited to the direct damages
          actually incurred, capped at €50.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms of Use are governed by and construed in accordance with the laws of the European
          Union and the Republic of Poland. Any legal action or proceeding arising out of these Terms
          shall be subject to the exclusive jurisdiction of the competent courts of Poland.
        </p>

        <h2>Disclaimer</h2>
        <p>
          The Service is provided “as is” without warranties of any kind, express or implied. We do
          not guarantee uninterrupted availability, timely updates, or the accuracy of third-party
          metadata or streaming availability. Your use of the Service is at your own risk.
        </p>

        <p className="muted">
          Last updated: <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
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
        title="Contact watchpapa"
        description="Get in touch with the watchpapa team — bug reports, feature ideas, privacy requests. Email support@watchpapa.tv or find us on LinkedIn."
        path="/contact"
      />
      <InfoPageShell
        session={session}
        breadcrumbs={[{ label: "Contact" }]}
        title="Get in touch"
        lead="Bug report, feature idea, privacy request, or just want to say hello — we read everything."
      >
        <ContentPanel label="Email us">
          <p className="text-sm text-[#8080a8]">The fastest way to reach the team is by email.</p>
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
              Titles, cast, release dates and posters come live from{" "}
              <Ext href="https://www.themoviedb.org/">TMDB</Ext>, and streaming availability from
              JustWatch via TMDB. If something looks wrong, correcting it on themoviedb.org fixes it
              for everyone — watchpapa caches each title for up to a day, so allow a little time for
              the change to appear. We can’t edit that data ourselves.
            </p>
          </div>
        </div>

        <h2>Reporting a bug</h2>
        <p>The more of this you include, the faster it gets fixed:</p>
        <ul>
          <li>
            <span>The address of the page where it happened.</span>
          </li>
          <li>
            <span>What you did, what you expected, and what happened instead.</span>
          </li>
          <li>
            <span>Your device and browser, and a screenshot if you can.</span>
          </li>
        </ul>
        <p className="muted">
          Please don’t include your password. We will never ask for it.
        </p>

        <h2>Feature ideas</h2>
        <p>
          watchpapa is built in the direction people actually use it, and most of what shipped this
          year started as someone’s email. Tell us what’s missing or what gets in your way — a
          sentence is enough.
        </p>

        <h2>Privacy and data requests</h2>
        <p>
          To access, correct or delete your personal data, or to exercise any other right under the
          GDPR, email <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a> from the
          address on your account. You can also export your data or delete your account yourself
          from Settings at any time — see the <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Other channels</h2>
        <p>
          Follow company updates and announcements on{" "}
          <Ext href="https://www.linkedin.com/company/watchpapa">watchpapa on LinkedIn</Ext>, and
          every release is written up on the <Link to="/updates">Updates page</Link>.
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
        description="How watchpapa handles your data — what we store, why, who processes it, how long we keep it, and your rights under the GDPR. We collect only what's necessary and never sell it."
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
          <strong>Krzysztof Durski</strong> is the data controller responsible for your personal
          data. You can contact the controller at{" "}
          <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a>.
        </p>

        <h2>What we collect</h2>
        <h3>Account</h3>
        <p>
          When you create an account we store your email address, username and a securely hashed
          password (or, if you sign in with Google or GitHub, the email address and basic profile
          information those providers share with us). We store your date of birth to verify that you
          are at least 16, along with a derived “18 or older” flag that gates adult content. We also
          record that you accepted the Terms and whether you opted in to product emails.
        </p>
        <h3>Profile and preferences</h3>
        <p>
          Your bio (up to 200 characters), your avatar choice — a poster you picked, or a photo you
          uploaded — and your settings: content language, title mode, country, watch regions,
          streaming services, home-page layout, adult-content preferences, and whether your account
          is private or allows profile sharing.
        </p>
        <h3>Activity</h3>
        <p>
          Your ratings and the history of changes to them, your rewatch diary (which titles you
          watched and on which dates), watchlists, followed titles, favourites, the people you observe
          and who observes you, observe requests, blocks, in-app notifications, referral
          relationships and reward-code claims. Titles are stored as TMDB identifiers.
        </p>
        <h3>Audit and security logs</h3>
        <p>
          For security, abuse prevention and support, we keep a record of actions taken on your
          account — rating and watch-history changes, watchlist and favourite changes, follows and
          observe requests, blocks, changes to your profile and settings, referral and reward-code
          activity, and, where relevant to a support request, any action our team takes on an
          account. Each entry has a timestamp; entries made through our API also record your IP
          address, method and path. This log is not visible to you or to other users — only to us,
          for security and support purposes.
        </p>
        <p>
          Separately, Supabase (our authentication provider — see “Data processors” below)
          maintains its own log of authentication events such as sign-in, sign-out and password
          changes, under its own retention policy, which we do not independently control.
        </p>
        <p>We do not collect names, postal addresses, phone numbers or payment information.</p>

        <h2>How we use your data</h2>
        <p>
          Your email and password let you sign in across devices. Your date of birth confirms you
          meet the age requirement and unlocks adult content only if you choose to enable it. Your
          preferences are used to ask TMDB for content in your language and for your country — those
          requests carry your language and country, never your identity.
        </p>
        <p>
          Ratings, diary entries, watchlists, follows and favourites exist so you can manage your own
          activity. “Suggested for you” is computed from your ratings and watched titles on request;
          we do not build or store a taste profile beyond the activity you can already see. Your
          username, avatar, bio and favourites are visible to anyone; ratings and stats are visible to
          others unless your account is private; watchlists, your diary, rating history and followed
          titles are visible only to you.
        </p>
        <p>
          The audit log helps us detect and prevent unauthorised access and abuse, and support you
          when something goes wrong with your account. If you opt in during
          registration or in Settings, we may send occasional product updates to your email; you can
          change that at any time under <strong>Settings → Preferences</strong>. We do not build
          advertising profiles or sell data to third parties.
        </p>

        <h2>Legal basis for processing</h2>
        <p>
          We process your data under the following legal bases (GDPR Article 6): account creation,
          authentication and every feature tied to your account are based on contract performance.
          Age verification is required by GDPR Article 8 (protection of children’s data). Persistent
          session storage requires your consent, given via the banner on first visit. Product emails
          are sent only with your consent. Security logging is based on our legitimate interest in
          preventing abuse and detecting threats.
        </p>

        <h2>Data processors and third-party services</h2>
        <p>Your data is processed by the following services:</p>
        <ul>
          <li>
            <span>
              <strong>Supabase</strong> (authentication, database and file storage; EU) — stores your
              account, activity and any avatar photo you upload.
            </span>
          </li>
          <li>
            <span>
              <strong>Cloudflare</strong> (hosting, API and network security; USA-based, global edge
              network) — serves the site and the API, and sees your IP address and requests in the
              course of doing so.
            </span>
          </li>
          <li>
            <span>
              <strong>Resend</strong> (transactional email; USA) — sends sign-up codes, password
              resets and, if you opted in, product updates.
            </span>
          </li>
          <li>
            <span>
              <strong>Google</strong> and <strong>GitHub</strong> (optional sign-in; USA) — process
              your email and basic profile information only if you choose that sign-in method.
            </span>
          </li>
          <li>
            <span>
              <strong>TMDB</strong> (content metadata and images; USA) — our servers request film and
              TV data from TMDB using your language and country settings but not your identity.
              Posters and backdrops load in your browser directly from TMDB’s image servers, so TMDB
              receives your IP address and browser details for those image requests, as any image
              host would. Your watchpapa data is never shared with TMDB.
            </span>
          </li>
          <li>
            <span>
              <strong>JustWatch</strong> — streaming availability reaches us through TMDB; your
              browser never contacts JustWatch.
            </span>
          </li>
        </ul>
        <p>
          Transfers to USA-based processors are protected by Standard Contractual Clauses approved
          by the European Commission under GDPR Article 46(2)(c). Changes to our data processors will
          be announced on the <Link to="/updates">Updates page</Link>.
        </p>

        <h2>Browser storage and cookies</h2>
        <p>
          When you sign in, your authentication token is stored in your browser. You control where:
        </p>
        <ul>
          <li>
            <span>
              <strong>With consent</strong> (Accept on the banner): the token is kept in localStorage
              and persists across tabs and browser restarts until you sign out.
            </span>
          </li>
          <li>
            <span>
              <strong>Without consent</strong> (Decline on the banner, or a browser “Do Not Track”
              signal): the token is kept in sessionStorage and cleared when you close the tab.
            </span>
          </li>
        </ul>
        <p>
          We also store a cookie that remembers your consent choice, and a few small, non-identifying
          conveniences in your browser: the country you chose while signed out, that you dismissed the
          early-adopter banner, that you acknowledged the adult-content warning (per tab), and a
          referral code you arrived with until sign-up completes. These are essential to operating
          the service and do not require consent under the ePrivacy Directive.
        </p>
        <p>We do not use tracking, advertising or analytics cookies.</p>

        <h2>Data retention</h2>
        <p>
          Account data and activity are kept until you delete your account, at which point they are
          removed from our database immediately; residual copies in backups expire within 30 days.
          Our own audit log is deleted automatically after 90 days. Supabase’s authentication log is
          retained under its own policy (see “Audit and security logs” above). Session tokens are
          cleared on sign-out or when the tab closes, depending on your consent choice.
        </p>

        <h2>Your rights under the GDPR</h2>
        <p>
          You have the right to access a copy of your personal data (<strong>Settings → Your data →
          Export my data</strong>), to correct inaccurate or incomplete data, and to delete your
          account and all associated data (<strong>Settings → Account → Delete account</strong>). You
          can also ask us to restrict how your data is used, receive it in a portable format (the CSV
          export), or object to processing based on legitimate interests.
        </p>
        <p>
          We do not make automated decisions with legal or similarly significant effects about you.
          To exercise any of these rights, or if something can’t be done from Settings, email{" "}
          <a href="mailto:support@watchpapa.tv">support@watchpapa.tv</a> from the address on your
          account.
        </p>

        <h2>Data protection supervisory authority</h2>
        <p>
          If you believe watchpapa has violated your data protection rights, you have the right to
          lodge a complaint with the data protection supervisory authority in your EU member state.
          These authorities can investigate and take enforcement action on your behalf, at no cost to
          you.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. For material changes (changes that expand what
          data we collect or how we use it), we will announce them on the{" "}
          <Link to="/updates">Updates page</Link> at least 14 days before they take effect.
          Continued use of the service after that period constitutes acceptance of the updated
          policy. For minor clarifications or corrections, we will update the date below without prior
          notice.
        </p>

        <p className="muted">
          Last updated: <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
        </p>
      </InfoPageShell>
    </>
  );
}

/* ─── Certifications ─────────────────────────────────────── */

function CertificationTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#2a3570]/50 text-xs font-semibold uppercase tracking-widest text-[#8383e7]">
            <th className="py-2 pr-4">Certification</th>
            <th className="py-2">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.certification} className="border-b border-[#2a3570]/20 last:border-0">
              <td className="py-2 pr-4 align-top">
                <span className="rounded-full border border-[#5a5a9a] bg-[#1e2140] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  {r.certification}
                </span>
              </td>
              <td className="py-2 align-top text-[#c0c0e8]">{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CertificationsInfoPage({ session }) {
  const { data: catalog } = useCertifications();
  const { effectiveWatchRegions } = usePreferences();
  const [region, setRegion] = useState(null);

  const regionCodes = useMemo(() => {
    const set = new Set([...Object.keys(catalog?.movie ?? {}), ...Object.keys(catalog?.tv ?? {})]);
    return [...set].sort();
  }, [catalog]);

  useEffect(() => {
    if (region || regionCodes.length === 0) return;
    const preferred = effectiveWatchRegions.find((r) => regionCodes.includes(r));
    setRegion(preferred ?? (regionCodes.includes("US") ? "US" : regionCodes[0]));
  }, [region, regionCodes, effectiveWatchRegions]);

  const sortByOrder = (rows) => (rows ?? []).slice().sort((a, b) => a.order - b.order);
  const movieCerts = sortByOrder(catalog?.movie?.[region]);
  const tvCerts = sortByOrder(catalog?.tv?.[region]);

  return (
    <>
      <PageHead
        title="Content Certifications"
        description="What movie and TV certifications (age/content ratings) mean, by country — sourced from TMDB."
        path="/certifications"
      />
      <InfoPageShell
        session={session}
        breadcrumbs={[{ label: "Certifications" }]}
        title="Content Certifications"
        lead="The rating badge shown on movie and show pages (e.g. PG-13, TV-MA), explained by country."
      >
        <h2>What is a certification?</h2>
        <p>
          A certification is the official age/content rating a movie or TV show has been given by a
          country&apos;s classification board — for example the MPA in the United States (G, PG,
          PG-13, R, NC-17) or the BBFC in the United Kingdom (U, PG, 12, 15, 18). Watchpapa shows the
          certification for your selected watch region on each movie or show&apos;s page, sourced live
          from TMDB. Not every title has a certification for every country — TMDB only has data where a
          classification board has actually rated that specific release.
        </p>

        <h2>Look up a country&apos;s ratings</h2>
        {regionCodes.length > 0 && (
          <div className="mb-4">
            <select
              value={region ?? ""}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-lg border border-[#2a3570] bg-[#141728] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#6f6fdc]"
            >
              {regionCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        )}

        {movieCerts.length > 0 && (
          <ContentPanel label="Movies">
            <CertificationTable rows={movieCerts} />
          </ContentPanel>
        )}

        {tvCerts.length > 0 && (
          <ContentPanel label="TV Shows">
            <CertificationTable rows={tvCerts} />
          </ContentPanel>
        )}

        {region && movieCerts.length === 0 && tvCerts.length === 0 && (
          <p className="text-sm text-[#8080a8]">No certification data available for {region}.</p>
        )}
      </InfoPageShell>
    </>
  );
}

export { AboutPage, ContactPage, HelpPage, PrivacyPage, TermsPage, CertificationsInfoPage };
