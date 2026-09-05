-- Lets a user delete individual entries from their own rating history
-- (RatingHistoryPanel.jsx) — e.g. to remove a value they logged by mistake.
-- Purely edits the historical record; the live user_rating.value (and the
-- log_user_rating_change trigger from migration 039) are unaffected.
CREATE POLICY "user_rating_history: own delete"
  ON public.user_rating_history
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());
