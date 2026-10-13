# Records of Processing Activities (RoPA)

**Organization:** watchpapa  
**Data Controller:** Krzysztof Durski  
**Email:** dursky.k@gmail.com  
**Effective Date:** June 2026  
**Last reviewed:** October 2026 (infrastructure and processor list updated for the Cloudflare Worker architecture, encrypted backups and the breached-password check — **controller to review the changes marked ⚠ before relying on this record**)  
**GDPR Article 30 Compliance Document**

---

## Overview

This document records all processing activities that watchpapa undertakes with personal data, as required by GDPR Article 30. It serves as the accountability record demonstrating that watchpapa processes data lawfully and transparently.

**Scope:** All personal data processing by watchpapa, whether collected directly from users or indirectly through third-party services.

---

## 1. User Authentication & Account Management

| Attribute | Details |
|---|---|
| **Processing Activity** | User account creation, authentication, and profile management |
| **Purpose** | Enable users to create accounts, log in, and manage their profile information |
| **Lawful Basis** | Art. 6(1)(b) — Performance of contract: users must have an account to use the service |
| **Data Categories** | Email address, username, date of birth, password hash, profile bio (optional), profile photo (optional), account creation timestamp, last login timestamp |
| **Data Source** | User provides directly during registration |
| **Recipients / Processors** | **Supabase Auth** (data processor via DPA signed June 2026) |
| **Retention Period** | Until account deletion. Audit logs of this activity: 90 days |
| **Security Measures** | — Passwords hashed via bcrypt (never stored plaintext) <br/> — HTTPS-only transmission <br/> — Authentication tokens expire after 24 hours <br/> — Row-Level Security (RLS) policies restrict access to user's own data <br/> — Audit logging of all auth events (IP, timestamp, action) |
| **Data Subject Rights** | Access (Art. 15), Rectification (Art. 16), Erasure (Art. 17), Portability (Art. 20) |
| **Location / Transfers** | **European Union:** Ireland (Supabase data center location) — no transfer outside EU required |

---

## 2. User Ratings & Content Management

| Attribute | Details |
|---|---|
| **Processing Activity** | Collecting and storing user ratings, ratings metadata (timestamp, country), and optionally user reviews |
| **Purpose** | Enable users to rate movies/shows, build personalized watchlists, display aggregated ratings to the community |
| **Lawful Basis** | Art. 6(1)(b) — User explicitly requests this feature to use the service |
| **Data Categories** | Movie/show ID, rating score (1–10), rating timestamp, user ID, review text (optional), country of review submission |
| **Data Source** | User provides directly when rating a title |
| **Recipients / Processors** | **Supabase Database** (data processor via DPA); **TMDB API** (third-party service for movie/show metadata — user's rating data NOT sent to TMDB) |
| **Retention Period** | Until user deletion. Can be deleted individually via the app |
| **Security Measures** | — RLS policies: users can only view/edit their own ratings <br/> — HTTPS transmission <br/> — Audit logging of rating events |
| **Data Subject Rights** | Access, Rectification (re-rate), Erasure (delete rating) |
| **Location / Transfers** | **Ireland** (Supabase) for storage; TMDB metadata retrieved from US servers but user ratings not transferred |

---

## 3. Watchlists & Followed Content

| Attribute | Details |
|---|---|
| **Processing Activity** | Creating and managing watchlists, tracking followed movies/shows, and storing watchlist items |
| **Purpose** | Enable users to create custom lists and follow titles they're interested in; optionally share lists with others |
| **Lawful Basis** | Art. 6(1)(b) — Core feature of the service users explicitly request |
| **Data Categories** | Watchlist name, watchlist description, watchlist visibility setting (private/public), watchlist items (movie/show IDs), timestamps, creator user ID, followers of the watchlist (if shared) |
| **Data Source** | User provides directly; third parties (other users) follow public watchlists |
| **Recipients / Processors** | **Supabase Database** (data processor via DPA) |
| **Retention Period** | Until user deletion or watchlist deletion (user can delete anytime) |
| **Security Measures** | — RLS policies: users can only access their own watchlists (or public ones they follow) <br/> — Audit logging of list creation/deletion <br/> — Encryption via HTTPS |
| **Data Subject Rights** | Access, Erasure (delete watchlist or specific item), Portability (export via CSV) |
| **Location / Transfers** | **Ireland** (Supabase) |

---

## 4. Follow Graph (Following Users)

| Attribute | Details |
|---|---|
| **Processing Activity** | Tracking which users follow other users, displaying follower relationships |
| **Purpose** | Build social network, enable users to see ratings/activity of users they follow |
| **Lawful Basis** | Art. 6(1)(b) — User explicitly follows another user as part of the service |
| **Data Categories** | User ID (follower), User ID (followed), timestamp of follow |
| **Data Source** | User provides directly when clicking "follow" |
| **Recipients / Processors** | **Supabase Database** (data processor via DPA) |
| **Retention Period** | Until user deletion or unfollow |
| **Security Measures** | — RLS policies: user can only view/delete their own follows <br/> — HTTPS transmission <br/> — Audit logging |
| **Data Subject Rights** | Access (export follows), Erasure (unfollow) |
| **Location / Transfers** | **Ireland** (Supabase) |

---

## 5. Marketing Email Opt-In

| Attribute | Details |
|---|---|
| **Processing Activity** | Collecting and storing user preferences for marketing communications; sending product update emails when user has opted in |
| **Purpose** | Enable users to receive occasional product updates and announcements; for watchpapa to communicate about new features |
| **Lawful Basis** | Art. 6(1)(a) — **Explicit consent** obtained during registration via checkbox; user can withdraw at any time in Settings |
| **Data Categories** | Email address, email_marketing_opt_in preference (boolean), last email sent timestamp |
| **Data Source** | User provides consent via checkbox during registration; stored in profile table |
| **Recipients / Processors** | **Resend** (transactional email processor — DPA signed June 2026) for sending emails when user has opted in |
| **Retention Period** | Preference stored until user changes it or deletes account. Sent emails are archived in Resend for audit trail (30 days default). |
| **Security Measures** | — User consent documented via form submission timestamp <br/> — User can withdraw consent at any time in Settings <br/> — Email addresses transmitted via HTTPS to Resend <br/> — Resend is GDPR-compliant with DPA in place |
| **Data Subject Rights** | Access (see preference in Settings), Rectification (toggle in Settings), Erasure (delete account) |
| **Location / Transfers** | **EU and US**: Email preference stored in Ireland (Supabase); emails sent via Resend (US-based but covered by EU-US Standard Contractual Clauses in their DPA) |

---

## 6. Audit Logging & Security Monitoring

| Attribute | Details |
|---|---|
| **Processing Activity** | Logging all user account actions (login, logout, password reset, rating changes, etc.) with timestamps and IP addresses for security and compliance auditing |
| **Purpose** | — Detect unauthorized access or suspicious activity <br/> — Comply with GDPR Article 30 (records of processing) <br/> — Investigate user support issues <br/> — Meet retention and data integrity requirements |
| **Lawful Basis** | Art. 6(1)(f) — Legitimate interest in detecting fraud, maintaining security, and proving GDPR compliance |
| **Data Categories** | User ID, action type (login, logout, delete account, etc.), IP address, user agent (browser), timestamp, action status (success/failure) |
| **Data Source** | System-generated from application activity; not provided by user |
| **Recipients / Processors** | **Supabase Database** (data processor via DPA) |
| **Retention Period** | **90 days** (per privacy policy) — audit logs older than 90 days are automatically deleted via pg_cron scheduled job running daily at 02:00 UTC |
| **Security Measures** | — RLS policy: `REVOKE DELETE ON audit_events FROM PUBLIC` (only superuser can delete) <br/> — Immediate cleanup on user deletion (trigger function ensures user's audit logs deleted within seconds) <br/> — Audit logs themselves logged and encrypted via HTTPS <br/> — IP addresses stored as identifiers (could enable tracking) but are only accessed for investigating suspicious activity |
| **Data Subject Rights** | Access (user can request their own audit logs via GDPR rights request), Erasure (logs deleted upon account deletion or after 90 days) |
| **Location / Transfers** | **Ireland** (Supabase) |
| **Risk Assessment** | **Medium risk** — IP addresses + timestamps could enable tracking of user behavior; mitigated by 90-day retention, strict RLS, and requiring GDPR rights request to access |

---

## 7. Subscription & Tier Management

| Attribute | Details |
|---|---|
| **Processing Activity** | Recording user subscription tier (free/pro), subscription start/expiry dates, early adopter status |
| **Purpose** | Manage access to paid features, identify early adopters for special benefits |
| **Lawful Basis** | Art. 6(1)(b) — Performance of contract: user's subscription status is necessary to provide the service they paid for |
| **Data Categories** | User ID, subscription tier (free/pro), subscription start date, subscription expiry date, renewal status (active/cancelled), early adopter flag, payment method (NOT stored — handled by external processor) |
| **Data Source** | System-generated from subscription service or user action in Settings |
| **Recipients / Processors** | **Supabase Database** (data processor via DPA); **[Payment processor if applicable]** — currently no payment processor (e.g., Stripe) configured, subscriptions managed manually |
| **Retention Period** | Until user deletion or subscription cancellation; historical records kept for 90 days after cancellation for audit purposes |
| **Security Measures** | — RLS: user can only view/edit their own subscription status <br/> — HTTPS transmission <br/> — Audit logging of tier changes |
| **Data Subject Rights** | Access (visible in Settings), Rectification (contact support to correct), Erasure (deleted on account deletion) |
| **Location / Transfers** | **Ireland** (Supabase) |

---

## 8. Session Storage & Cookie Consent

| Attribute | Details |
|---|---|
| **Processing Activity** | Storing user session tokens in browser storage (sessionStorage if user declines consent, localStorage if user accepts); tracking user's cookie consent preference |
| **Purpose** | Maintain user login sessions across page navigation; respect user privacy preferences |
| **Lawful Basis** | Art. 6(1)(a) — User consent (via cookie consent banner); Art. 6(1)(b) — Functional necessity (session must be maintained to use the app) |
| **Data Categories** | Session token (JWT), consent preference (accept/decline/DNT flag), last consent update timestamp |
| **Data Source** | System-generated; user consent provided via banner interaction |
| **Recipients / Processors** | Browser local storage (no external processor); Supabase Auth validates session tokens |
| **Retention Period** | Session token: 24 hours (auto-expires); consent preference: until user clears browser storage or changes preference |
| **Security Measures** | — Tokens stored in browser memory only (sessionStorage) if user declines, cleared on tab close <br/> — Tokens stored in persistent storage (localStorage) only if user explicitly consents <br/> — Tokens expire after 24 hours regardless of storage location <br/> — HTTPOnly flag NOT used (tokens are needed in JavaScript) but transmitted only via HTTPS <br/> — Browser's Do-Not-Track (DNT) signal respected (auto-decline if set) |
| **Data Subject Rights** | Access (inspect browser console), Erasure (clear browser storage / logout) |
| **Location / Transfers** | **Browser-local storage only** — no data transferred to server beyond the session token (which is already stored in Supabase) |

---

## 9. Analytics & Monitoring (If Enabled in Future)

| Attribute | Details |
|---|---|
| **Processing Activity** | [CURRENTLY NOT ACTIVE] Collecting anonymized usage statistics (page views, feature usage, etc.) |
| **Purpose** | [If enabled in future:] Understand user behavior, improve product, detect bugs |
| **Lawful Basis** | [If enabled:] Art. 6(1)(a) — Consent via cookie banner; Art. 6(1)(f) — Legitimate interest if anonymized |
| **Data Categories** | [If enabled:] Page URL, feature accessed, user ID (optional, for session correlation), timestamp, device type, browser type |
| **Data Source** | System-generated from application activity |
| **Recipients / Processors** | [If enabled:] Analytics service (e.g., Plausible, Fathom — to be determined) |
| **Retention Period** | [If enabled:] Typically 30–90 days per analytics provider |
| **Security Measures** | [If enabled:] — No personally identifiable info stored <br/> — Anonymization of IP addresses <br/> — User opt-out available |
| **Data Subject Rights** | [If enabled:] Typically no individual access (data is anonymized) |
| **Location / Transfers** | [If enabled:] EU-based provider preferred to avoid extra-EU transfers |
| **Status** | **Not currently active.** Analytics has not been implemented. If planned in future, add explicit consent flow and GDPR article to privacy policy. |

---

## 10. Third-Party Data Processors & Sub-Processors

watchpapa uses the following data processors (sub-processors):

| Processor | Purpose | Location | Data Processed | DPA Status | Art. 28 Compliance |
|---|---|---|---|---|---|
| **Supabase** | Database hosting, authentication | Ireland (EU) | All user data (accounts, ratings, watchlists, etc.) | ✅ DPA signed June 2026 | ✅ Article 28 compliant |
| **Resend** | Transactional email & marketing email | US | Email addresses, user IDs (for opt-in status) | ✅ DPA signed June 2026 | ✅ Standard Contractual Clauses (SCCs) included |
| **Cloudflare** | Hosts the site (Pages) and the API (Workers, incl. Hyperdrive DB connection pooling and rate limiting); CDN, DDoS protection, DNS; **R2** storage for encrypted nightly database backups | Global (R2 bucket location ⚠ to be confirmed) | Request logs and IP addresses; every API request including the user's auth token; all user-data queries in transit between the Worker and Supabase; encrypted backup files (ciphertext only) | ✅ DPA auto-included in ToS | ✅ Compliant |
| **GitHub** (Actions) | Source repository; **GitHub Actions runner executes the nightly database backup** | US | The backup job connects to the database and streams a full dump (all user data) through the runner's memory/pipe into `age` encryption; only the encrypted file leaves the runner (to R2). The plaintext is never written to disk or kept. | ✅ DPA in ToS | ✅ Compliant ⚠ (previously listed as "no user personal data") |
| **TMDB** | Movie/show/person metadata and images | US | Titles/IDs and search text typed by users, sent by the Worker (TMDB sees Cloudflare's IP, not the user's). **Posters and images are loaded by the user's browser directly from TMDB's image CDN** (`image.tmdb.org`), so TMDB's CDN sees the user's IP address and user-agent. User ratings, lists and profile data are NOT sent to TMDB. | ⚠️ No DPA (no user account data shared) | Limited — third-party service, not processor |
| **Have I Been Pwned** (Troy Hunt) | Breached-password check at sign-up / password change | Global (Cloudflare-fronted) | Called from the user's browser: the first 5 hex characters of the password's SHA-1 hash (k-anonymity range query; the password and full hash never leave the browser) plus the user's IP address. Nothing is stored by watchpapa. | ⚠️ No DPA (no personal data beyond IP) | Limited — third-party service, not processor |
| **Google** | Domain hosting / services (if any) | US/EU (configurable) | Logs, emails (if Gmail used for support) | ✅ DPA in ToS | ✅ Compliant |

*Removed:* **DigitalOcean** (backend droplet) — decommissioned September 2026 when the API moved to a Cloudflare Worker; no personal data remains there ⚠ (confirm the droplet and its snapshots were destroyed).

**Sub-Processor Changes:**
- New sub-processors added require **prior written notice** to users (via privacy policy / /updates page)
- Users have **30-day right to object** before new processor is added
- Currently: **no user objections anticipated** (all processors are major cloud providers with strong GDPR compliance)

---

## 11. International Data Transfers (Art. 46)

### EU to US Transfers
- **Supabase:** Data stored in Ireland (EU) — **no transfer**
- **Resend:** Email service is US-based
  - **Safeguard:** Resend's DPA includes **EU-US Standard Contractual Clauses (SCCs)**
  - **Status:** ✅ Compliant with GDPR Art. 46
- **Other US processors** (Cloudflare, GitHub, TMDB, Have I Been Pwned): 
  - **Safeguard:** All include SCCs in their agreements
  - **Status:** ✅ Compliant

### Non-EU Transfers
- Currently **none** beyond US
- If future expansion includes other countries: SCCs will be reviewed/negotiated per Art. 46

---

## 12. Data Retention & Deletion Policy

| Data Type | Retention Period | Deletion Trigger | Justification |
|---|---|---|---|
| **User accounts** | Until user deletion | User requests deletion or account inactive 2+ years | No business requirement for indefinite storage |
| **Ratings & watchlists** | Until user deletion | User deletion or individual item deletion | User's own content; deleted on request |
| **Follow relationships** | Until user deletion | User unfollow or deletion | Transient relationship data |
| **Subscription data** | Until user deletion + 90 days | Account deletion + 90d archive period | 90d for audit/refund disputes |
| **Database backups** | 30 days (R2 lifecycle rule), `age`-encrypted | Automatic expiry of each nightly file | Disaster recovery now that the database runs on Supabase's Free plan (no provider backups). ⚠ A deleted account's data remains in backups for up to 30 days; backups are never restored selectively, so a restore must re-apply pending erasure requests. |
| **Audit logs** | 90 days | Automatic daily cleanup (pg_cron) | Privacy policy promise: 30d for personal data, audit logs retained for 90d per regulatory need |
| **Session tokens** | 24 hours | Token expiration | Security best practice; user can manually logout |
| **Marketing email preference** | Until user deletion | Account deletion or user toggles preference | GDPR Art. 21 — user can withdraw consent |

---

## 13. Data Subject Rights & Fulfillment

watchpapa ensures the following GDPR rights are implemented:

| Right | GDPR Article | How Implemented | Timeline |
|---|---|---|---|
| **Right to Access** | Art. 15 | Export data via Settings or GDPR rights request → CSV file | 30 days |
| **Right to Rectification** | Art. 16 | Edit profile info in Settings; contact support for historical data | 30 days |
| **Right to Erasure** | Art. 17 | Delete Account in Settings (immediate soft delete) + manual purge of remaining rows per the SOP |30 days |
| **Right to Restrict Processing** | Art. 18 | Contact support; will disable non-essential processing (if any) | 30 days |
| **Right to Data Portability** | Art. 20 | Export to CSV via Settings or data rights request | 30 days |
| **Right to Object** | Art. 21 | Opt-out via Settings (marketing); contact support for other processing | 30 days |
| **Right Against Automated Decisions** | Art. 22 | Not applicable — watchpapa does not use automated profiling/decisions | N/A |
| **Right to Lodge Complaint** | Art. 77 | Users can contact supervisory authority directly | N/A |


> ⚠️ *Corrected 2026-10-13:* the app's delete is immediate and a **soft delete** (`delete_account()`): follows and OAuth identities are removed and the account is banned/renamed, but ratings, watch log, watchlists, favourites and notifications are **not** deleted and no job purges them; backups keep the data up to 30 days. A manual purge is part of the erasure SOP.

**Contact for rights requests:** support@watchpapa.tv

---

## 14. Data Protection Impact Assessment (DPIA)

**Current status:** A full DPIA is recommended but not required for watchpapa because:
- **Low risk** profile: no automated decision-making, no large-scale profiling, no data sales
- **Lawful basis:** Mostly Art. 6(1)(b) (contract), not reliant on legitimate interest
- **Data categories:** No sensitive data (no health, biometrics, financial, genetic)

**DPIA triggered if:**
- Automated decision-making is added (Art. 35(3)(a))
- Systematic profiling for behavioral tracking (Art. 35(3)(b))
- Large-scale processing of special category data (Art. 35(3)(c))

**Recommendation:** Document this decision. If features change, reassess.

---

## 15. Data Breach History

| Date | Nature | Users Affected | Action Taken | Notification Sent |
|---|---|---|---|---|
| None recorded | — | — | — | — |

---

## 16. Approval & Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| **Data Controller** | Krzysztof Durski | 2026-06-03 | — |
| **Last Reviewed** | Krzysztof Durski | 2026-06-03 | — |
| **Next Review Date** | — | 2026-12-03 | — |

**Review Frequency:** Annually (or immediately if new processing activity added, data processor changes, or security incident occurs)

---

## 17. Appendix: Legal Bases Reference

- **Art. 6(1)(b)** — Necessary for contract performance (user account, ratings, watchlists)
- **Art. 6(1)(a)** — Explicit user consent (marketing email opt-in, cookie consent)
- **Art. 6(1)(f)** — Legitimate interest in security/fraud prevention (audit logs)

---

## 18. Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-06-03 | Initial RoPA created for GDPR compliance |
| — | — | — |

---

**This Records of Processing Activities document is confidential and intended for regulatory review and internal compliance purposes. Retain indefinitely.**
