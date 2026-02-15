# StreamHopper

## Product Description

**StreamHopper** is the ultimate companion for the modern, borderless viewer. It solves the frustration of "content fragmentation" by allowing users to search not just for *what* to watch, but *where* and *how* to watch it. Unlike standard streaming search engines, this platform is built with the VPN user in mind, cross-referencing streaming library availability with specific language and subtitle data. 

Beyond finding where to watch, it acts as your personal entertainment diary. You can log your viewing history, rate what you've watched, and build a comprehensive profile of your cinematic tastes. Combined with a personalized release calendar, it transforms from a simple search tool into a dedicated hub for tracking, reviewing, and anticipating your favorite entertainment across the globe.

---

## Key Features

* **VPN-Optimized Availability Search:** Select virtual locations (VPN servers) to see which specific country offers the title on your subscribed platforms.
* **Granular Language Filtering:** Mandatory audio and subtitle metadata checks to prevent false positives (e.g., finding a movie without your native language options).
* **Watch History & Rating System:** Mark episodes or movies as "Watched" to keep a running log, rate titles on a numerical scale, and maintain separate "To Watch" and "Completed" lists.
* **Personalized "My Services" Dashboard:** Toggle specific streaming subscriptions so search results are always relevant to the platforms you already pay for.
* **Smart Subscription Tracker:** Follow specific shows and view a dynamic, timezone-adjusted timeline of upcoming episodes.
* **Deep Link Integration:** One-click direct links to open the specific title in the respective streaming app or website.

---

## Development Roadmap

### Phase 1: Planning & Data Validation
- [ ] **API Feasibility Test:** Create a small script to query the Streaming Availability API to verify granular data for subtitles and audio per region.
- [ ] **Define Tech Stack:** Choose your frontend (e.g., React, Next.js, Vue) and backend (e.g., Node.js, Python/Django, Supabase).
- [ ] **Database Schema Design:** Map out tables for `Users`, `Subscribed_Shows`, `User_Regions` (VPNs), `User_Services`, `Watch_History`, and `User_Ratings`.

### Phase 2: Backend & Core Logic
- [ ] **Authentication System:** Build sign-up/login functionality to save calendars, watch history, and user preferences safely.
- [ ] **Search Service:** Implement the logic to query the external API based on user inputs.
- [ ] **Filtering Engine:** Develop the algorithm that filters API results by discarding regions where the specific language metadata is missing.
- [ ] **Tracking Endpoints:** Create API routes for users to toggle a "Watched" status on a title/episode and submit a numerical rating to the database.
- [ ] **Calendar Job:** Create a scheduled background job to update the "Next Episode" dates for shows in the database.

### Phase 3: Frontend & UI/UX
- [ ] **Onboarding Flow:** Create a "Setup" page where new users select their streaming services and available VPN regions.
- [ ] **Search Interface:** Design a search bar with advanced filters for Language, Genre, and Video Quality.
- [ ] **Movie/Show Detail View:** Build a page showing the poster, synopsis, the "Where to Watch" table, and a clear UI to submit ratings or mark the title as watched.
- [ ] **Personal Profile View:** Create a dashboard dedicated to the user's statistics, displaying their completed watchlist, recent activity, and average ratings given.
- [ ] **Dashboard/Calendar View:** Build the personal hub displaying a grid of upcoming episodes for subscribed shows.

### Phase 4: Polish & Refinement
- [ ] **Caching Layer:** Implement Redis or similar caching for search results to reduce API costs and speed up load times.
- [ ] **Mobile Responsiveness:** Ensure the calendar, tracking buttons, and search results look perfect and are easily tappable on phone screens.
- [ ] **User Testing:** specifically test the language filter edge cases and ensure the rating UI updates instantly without refreshing the page.