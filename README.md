# Memordle

A daily memory game. Come back every day for a new set — same four games, new puzzles, and everyone gets the same ones (like Wordle).

## The games

| Game | What you do | Stars |
|------|-------------|-------|
| **Echo** | Repeat a growing sequence of tiles on a 3×3 grid | Reach 5 / 7 / 10 |
| **Flash** | Tap every cell from a pattern that flashed briefly (3 rounds) | 1 per round |
| **Pairs** | Match 8 pairs of cards in as few moves as possible | ≤22 / ≤16 / ≤12 moves |
| **Digits** | Type back a number shown for a few seconds (5, 7, 9 digits) | 1 per round |

Max score is 12★, and the results screen shows how you did against everyone who played today. One attempt per day; leaving a game mid-way scores it 0. Streaks and stats are saved in your browser, and you can share an emoji summary of your result.

## How it works

- Puzzles are generated from a seeded random generator keyed on the local date, so no server is needed.
- Puzzle #1 is November 5, 2026.
- Plain HTML/CSS/JS — no build step.
- Scores go to a small Supabase database so the game can show "better than x% of today's players". Until the backend is set up (or while fewer than 5 people have played), it shows an estimate instead.

## Run it

Open `index.html` in a browser, or host the folder anywhere static. To publish with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.

## Backend setup (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Paste them into [`config.js`](config.js) and commit.

The anon key is meant to be public. The database only lets visitors insert one score per day (validated: 0–3★ per game, today's date) and read per-day totals through the `day_distribution` function — no one can read, edit or delete individual rows.

Note: like any client-side game, a determined person could submit a fake score. For a casual daily game that's usually fine.
