-- 本日の最強決定戦。日付ごとに最速の反応速度を王者として扱う。
create table todays_champion_scores (
  id bigint generated always as identity primary key,
  day integer not null check (day between 20250101 and 21001231),
  name text not null check (char_length(name) between 1 and 20),
  character_id text not null check (character_id in ('raven','mika','brick','noise','kiri')),
  ms integer not null check (ms between 0 and 3000),
  created_at timestamptz not null default now()
);

create index todays_champion_scores_rank on todays_champion_scores (day, ms, created_at);

alter table todays_champion_scores enable row level security;

create policy "Allow public read (todays champion)" on todays_champion_scores
  for select using (true);

create policy "Allow public insert (todays champion)" on todays_champion_scores
  for insert with check (
    char_length(name) between 1 and 20
    and character_id in ('raven','mika','brick','noise','kiri')
    and day between 20250101 and 21001231
    and ms between 0 and 3000
  );

grant select, insert on todays_champion_scores to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
