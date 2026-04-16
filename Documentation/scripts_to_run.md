# Scripts to Run

## TMDB jobs and departments ingestion

Command:

`npm run seed:tmdb:jobs`

Description:

Fetches TMDB job configuration data and inserts normalized records into `department` and `job` tables in Supabase/Postgres. The ingestion is transactional (all-or-nothing) and safe to rerun because existing records are skipped.
