import InfoPageShell from "../../../components/static/InfoPageShell.jsx";

function AboutPage({ session }) {
  return (
    <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "About" }]}
      title="About watchpapa"
    >
      <p>
        watchpapa helps you browse movies and TV shows, explore people and credits, and keep an eye on
        upcoming releases. This site is a work in progress; we improve it based on how people actually
        use it.
      </p>
      <p>
        Film and TV metadata and images are provided by{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          The Movie Database (TMDB)
        </a>
        . watchpapa is not endorsed or certified by TMDB.
      </p>
    </InfoPageShell>
  );
}

function HelpPage({ session }) {
  return (
    <InfoPageShell session={session} breadcrumbs={[{ label: "Help" }]} title="Help">
      <h2>Browsing</h2>
      <p>
        Use the navigation links for Popular, Movies, Shows, and People. On the home page you can
        search to filter what you see in each row.
      </p>
      <h2>Detail pages</h2>
      <p>
        Open a movie or show to read the overview, see cast, and follow links to seasons and episodes
        for series. Person pages list known credits so you can jump to titles they worked on.
      </p>
      <h2>Calendar</h2>
      <p>
        The releases calendar summarizes upcoming dates so you can plan what to watch next. Dates
        depend on the data TMDB has for each region and title.
      </p>
      <h2>Account</h2>
      <p>
        Sign in to access features that require an account. If you forgot your password, use the link
        on the login screen to reset it.
      </p>
    </InfoPageShell>
  );
}

function TermsPage({ session }) {
  return (
    <InfoPageShell session={session} breadcrumbs={[{ label: "Terms" }]} title="Terms of use">
      <p>
        By using watchpapa you agree to the <a href="https://www.themoviedb.org/terms-of-use" target="_blank" rel="noopener noreferrer">TMDB Terms of Use</a> and <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer">TMDB Privacy Policy</a>.
      </p>
    </InfoPageShell>
  );
}

function ContactPage({ session }) {
  return (
    <InfoPageShell session={session} breadcrumbs={[{ label: "Contact" }]} title="Contact">
      <p>
        For general questions or feedback, email{" "}
        <a href="mailto:support@watchpapa.tv">contact@watchpapa.tv</a>.
      </p>
      <p>
        [add contact form here]
      </p>
    </InfoPageShell>
  );
}

function PrivacyPage({ session }) {
  return (
    <InfoPageShell session={session} breadcrumbs={[{ label: "Privacy" }]} title="Privacy">
      <p>
        [add privacy policy here]
      </p>
    </InfoPageShell>
  );
}

export { AboutPage, ContactPage, HelpPage, PrivacyPage, TermsPage };
