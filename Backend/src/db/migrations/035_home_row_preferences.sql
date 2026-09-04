-- Home page row customization: which rows show and in what order. Empty
-- setting_home_row_order means "use the app default order" (see
-- Frontend/src/lib/homeRows.js DEFAULT_HOME_ROW_ORDER) rather than baking the
-- row list into the DB — new rows added later just aren't in anyone's saved
-- array yet and get appended after their existing ones by the frontend.
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS setting_home_row_order TEXT[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(setting_home_row_order) <= 20),
  ADD COLUMN IF NOT EXISTS setting_home_hidden_rows TEXT[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(setting_home_hidden_rows) <= 20);
