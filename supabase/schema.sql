-- Memordle backend — run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.scores (
  id          bigserial primary key,
  day         date        not null,
  puzzle      int         not null,
  total       int         not null check (total between 0 and 12),
  games       int[]       not null check (array_length(games, 1) = 4),
  client_id   uuid        not null,
  created_at  timestamptz not null default now(),
  unique (day, client_id)                -- one score per player per day
);

create index if not exists scores_day_idx on public.scores (day, total);

alter table public.scores enable row level security;

-- Anyone may submit a score for (roughly) today. Nobody can read, edit or delete rows directly.
drop policy if exists "submit today's score" on public.scores;
create policy "submit today's score" on public.scores
  for insert to anon
  with check (
    day between current_date - 1 and current_date + 1       -- allows for time zones
    and total = games[1] + games[2] + games[3] + games[4]
    and games[1] between 0 and 3 and games[2] between 0 and 3
    and games[3] between 0 and 3 and games[4] between 0 and 3
  );

-- Read-only aggregate: how many players got each total on a given day.
create or replace function public.day_distribution(p_day date)
returns table (total int, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.total, count(*)::bigint
  from public.scores s
  where s.day = p_day
  group by s.total
  order by s.total;
$$;

revoke all on function public.day_distribution(date) from public;
grant execute on function public.day_distribution(date) to anon;
