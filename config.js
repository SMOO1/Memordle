// Memordle backend settings.
// Paste your Supabase project URL and anon (public) key here — see README "Backend setup".
// The anon key is safe to publish: the database only allows inserting a score and
// reading per-day totals (see supabase/schema.sql).
// Leave these empty and the game falls back to an estimated percentile.
window.MEMORDLE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
