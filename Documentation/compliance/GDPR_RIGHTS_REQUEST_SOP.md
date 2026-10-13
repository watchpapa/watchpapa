# GDPR Rights Request Standard Operating Procedure

**Organization:** watchpapa  
**Data Controller:** Krzysztof Durski  
**Contact:** support@watchpapa.tv  
**Effective Date:** June 2026

---

## 1. Overview

This SOP defines how to handle requests from data subjects exercising their GDPR rights under Articles 12-22. All requests must be processed within **30 calendar days** of receipt (extendable by 60 days if complex).

## 2. Rights Covered

Users may request:
- **Right to Access** (Art. 15) — copy of their personal data
- **Right to Rectification** (Art. 16) — correct inaccurate data
- **Right to Erasure** (Art. 17) — delete their account and data
- **Right to Restrict Processing** (Art. 18) — limit how data is used
- **Right to Data Portability** (Art. 20) — export data in machine-readable format
- **Right to Object** (Art. 21) — object to processing
- **Right Against Automated Decisions** (Art. 22) — request human review
- **Right to Lodge a Complaint** (Art. 77) — contact supervisory authority

---

## 3. Request Receipt & Logging

### 3.1 Identification
When a request arrives at support@watchpapa.tv:

1. **Record immediately:**
   - Date received
   - Requester email
   - Type of request (access, erasure, rectification, etc.)
   - Request ID (YYYY-MM-##, e.g., 2026-06-01)

2. **Log template:**
   ```
   | Request ID | Date Received | Requester Email | Type | Identity Verified | Date Resolved | Outcome |
   |---|---|---|---|---|---|---|
   | 2026-06-01 | 2026-06-01 | user@example.com | Access | ✓ | 2026-06-15 | CSV sent |
   ```

### 3.2 Identity Verification (Days 1-2)
- Email requestor asking to confirm they own the account
- Require them to either:
  - Log into watchpapa.tv and submit from Settings, OR
  - Reply from the email associated with their watchpapa account
- **Note:** For erasure requests, accept requests from the registered email; for access requests, require email verification
- **Document:** Attach proof of verification to the request record

---

## 4. Processing by Request Type

### 4.1 Right to Access (Art. 15)
**Timeline:** 30 days  
**Process:**

1. **Retrieve data:** Query user's data from these tables:
   - `profile` (all columns)
   - `user_rating` (all ratings)
   - `user_subscriptions` (tier, expiry, early adopter status)
   - `watchlist` & `watchlist_item` (all watchlists and items)
   - `user_followed_movies` & `user_followed_shows` (all follows)
   - `profile_favourite` (all favourites)
   - `audit_events` (user's own audit logs, if any)

2. **Format:** Export as CSV or JSON, plaintext

3. **Deliver:** Email to requester with file attachment or download link (max 7-day expiry)

4. **Record:** Log completion date and method of delivery

**Template Email:**
```
Subject: Your watchpapa Data Export (Request ID: YYYY-MM-##)

Dear [Name],

Per your request under GDPR Article 15 (Right to Access), attached is your 
complete personal data held by watchpapa.

Data includes: account info, ratings, watchlists, follows, preferences.

This export is valid for 7 days. Contact support@watchpapa.tv with questions.

Best regards,
watchpapa Team
```

### 4.2 Right to Rectification (Art. 16)
**Timeline:** 30 days  
**Process:**

1. **Assess claim:** Verify the data is actually inaccurate
2. **Correct:** Update the profile table directly (e.g., bio, username, date of birth)
3. **Notify:** Email confirmation of change
4. **Record:** Log what was changed and when

**Ineligible edits:**
- Ratings (subjective, user's expression) — user can delete & re-rate instead
- Historical data (audit_events, created_at dates)

### 4.3 Right to Erasure (Art. 17) — Account Deletion
**Timeline:** 30 days (actual deletion: within 30 days)  
**Process:**

> ⚠️ **Corrected 2026-10-13 against the live database.** Earlier versions of this SOP described a 24-hour grace period and a cascading hard delete. Neither exists. **Settings → Account → Delete account** calls `public.delete_account()` (reference copy: `Backend/src/db/migrations/reference/delete_account.sql`), which acts **immediately** and only **soft-deletes**: it removes the user's follows and OAuth identities, sets `profile.deleted_at`, renames the username to `deleted_<id>`, switches adult content off, bans the auth user (`banned_until = 9999-12-31`) and suffixes the e-mail with `-deleted|id=<uid>`. It does **not** delete ratings, rating history, watch log, watchlists, favourites, notifications or `audit_events`, and no scheduled job purges them (the only `pg_cron` job is the 90-day `audit_events` cleanup). On 2026-10-13: 9 soft-deleted profiles still had 195 ratings and 1 watchlist.

1. **Verify request:** Confirm from the registered email address (the user can also self-serve in Settings)
2. **Delete:** If the user has not already, have them use Settings → Account → Delete account (immediate, no grace period). For an account that cannot sign in, an admin runs the equivalent steps manually.
3. **Erase the remaining data manually** (needed for a true Art. 17 erasure until a purge is automated): delete the user's rows from `user_rating`, `user_rating_history`, `watch_log`, `watchlist` (cascades `watchlist_item`), `profile_favourite`, `notification`, `user_subscriptions`, `import_job`, `tier_reward`, observe/block tables, and their `audit_events`; delete the avatar object from the `avatars` bucket (note: a client-side `storage.remove()` silently deletes nothing — remove it from the dashboard); then delete the `profile` row and the `auth.users` row.
4. **Backups:** the user's data remains in the encrypted nightly backups (Cloudflare R2) until they expire after 30 days. Backups are never restored selectively; if one is ever restored, re-apply all erasures received since.
5. **Confirm:** Email "Your data has been permanently removed" only after step 3 is done
6. **Record:** Log deletion date

### 4.4 Right to Data Portability (Art. 20)
**Timeline:** 30 days  
**Process:**

1. **Format:** Export to CSV (same as Right to Access)
2. **Include:** All data user provided (ratings, watchlists, follows, profile)
3. **Exclude:** Derived data, audit logs
4. **Deliver:** Email with plaintext, machine-readable file
5. **Record:** Log completion

### 4.5 Right to Restrict Processing (Art. 18)
**Timeline:** 30 days  
**Process:**

1. **Clarify scope:** What processing should be restricted? (e.g., analytics, follow suggestions, etc.)
2. **Action:** Add a flag to profile table (if requested by multiple users, plan for future implementation)
3. **Document:** Record what was restricted and until when
4. **Note:** Currently watchpapa doesn't use analytics, so restrictions are minimal

### 4.6 Right to Object (Art. 21)
**Timeline:** 30 days  
**Process:**

1. **Assess claim:** Verify legitimate grounds (e.g., "don't profile me for recommendations")
2. **Action:** If based on legitimate interest, must stop that processing
3. **Document:** Record objection and action taken
4. **Current:** watchpapa has no marketing profiling, so most objections don't apply

### 4.7 Right Against Automated Decisions (Art. 22)
**Timeline:** 30 days  
**Process:**

1. **Assess:** Does watchpapa use automated decision-making?
   - **No:** watchpapa doesn't make automated decisions about users (ratings are user-controlled)
2. **Response:** Email explaining watchpapa doesn't use automated profiling/decisions

---

## 5. Deadline Management

### 5.1 Response Timeline
- **Day 1-5:** Receive request, verify identity
- **Day 6-25:** Process request, prepare response
- **Day 26-30:** Final delivery and confirmation

### 5.2 Extensions
If a request is complex (e.g., very large data export, multiple data sources), you may:
- Notify the requester by Day 30
- Extend by up to 60 additional days
- Document the reason for extension

### 5.3 Deadline Tracking
Maintain a spreadsheet:
```
Request ID | Received | Deadline | Type | Status | Notes
2026-06-01 | 2026-06-01 | 2026-07-01 | Access | In Progress | Sent CSV on 2026-06-15
```

---

## 6. Refusals & Special Cases

### 6.1 Manifestly Unfounded Requests
If a request is clearly frivolous or excessive:
- Refuse it
- Document the reason
- Notify the requester and explain grounds

**Example:** Same user requests data 10 times in one week → may refuse as "manifestly unfounded"

### 6.2 Cannot Identify User
If you cannot verify identity after reasonable effort:
- Request additional info (photo ID, payment record, etc.)
- If still unverifiable, you may refuse
- Document the verification attempts

### 6.3 Third-Party Data
If the user requests data about other people (e.g., followers' names):
- Provide only data directly about the requester
- Redact other users' personal data
- Explain why in your response

---

## 7. Documentation & Records

**Keep for minimum 3 years:**
- Request log (date, type, identity verification proof)
- Copies of all responses sent
- Outcome (approved/refused/extended)
- Any refusal reasons

**Storage:** 
- Spreadsheet: `/docs/GDPR_Requests.csv` (local, not in code repo)
- Email: Archive sent responses in support@watchpapa.tv folder "GDPR Requests"

---

## 8. Contacts

**Data Controller:** Krzysztof Durski  
**Email:** support@watchpapa.tv  
**Supervisory Authority (User complaints):** Data Protection Authority in user's EU member state

---

## 9. Training & Updates

- Review this SOP every 6 months
- Update for new features that collect data
- Train anyone handling support@watchpapa.tv on these procedures
