-- 奈落回避ランナー用のスコアテーブル
create table runner_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  score integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

alter table runner_scores enable row level security;

create policy "Allow public read (runner)" on runner_scores
  for select using (true);

create policy "Allow public insert (runner)" on runner_scores
  for insert with check (
    char_length(name) between 1 and 20
    and score >= 0 and score <= 10000000
  );

-- 討伐2048(チャレンジモード)用のスコアテーブル
create table boss_battle_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  score integer not null check (score >= 0 and score <= 1000000),
  created_at timestamptz not null default now()
);

alter table boss_battle_scores enable row level security;

create policy "Allow public read (boss)" on boss_battle_scores
  for select using (true);

create policy "Allow public insert (boss)" on boss_battle_scores
  for insert with check (
    char_length(name) between 1 and 20
    and score >= 0 and score <= 1000000
  );

-- HEXAMINE(デイリー)用のスコアテーブル
-- 盤面は日付から決まる種で作るので、同じ day の記録どうしは同じ問題を解いている。
-- 順位はミスの少ない順、同じならタイムの短い順。
create table hexamine_scores (
  id bigint generated always as identity primary key,
  day integer not null check (day between 20250101 and 21001231),
  name text not null check (char_length(name) between 1 and 20),
  mistakes integer not null check (mistakes >= 0 and mistakes <= 999),
  ms integer not null check (ms > 0 and ms <= 86400000),
  created_at timestamptz not null default now()
);

-- 日ごとの上位を引くための索引
create index hexamine_scores_rank on hexamine_scores (day, mistakes, ms);

alter table hexamine_scores enable row level security;

create policy "Allow public read (hexamine)" on hexamine_scores
  for select using (true);

create policy "Allow public insert (hexamine)" on hexamine_scores
  for insert with check (
    char_length(name) between 1 and 20
    and day between 20250101 and 21001231
    and mistakes >= 0 and mistakes <= 999
    and ms > 0 and ms <= 86400000
  );

-- ポリシーだけでは permission denied になる。GRANT も要る(過去にハマった)
grant select, insert on hexamine_scores to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- HELL RUNNER 2（β）用のスコアテーブル
-- βの間は無印(runner_scores)と分ける。バランス調整で点数の意味が変わるため、
-- 混ぜると比較できなくなる。完成時に本番テーブルへ移す想定。
create table runner_scores_hell_runner_2_draft (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  score integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

alter table runner_scores_hell_runner_2_draft enable row level security;

create policy "Allow public read (hr2 draft)" on runner_scores_hell_runner_2_draft
  for select using (true);

create policy "Allow public insert (hr2 draft)" on runner_scores_hell_runner_2_draft
  for insert with check (
    char_length(name) between 1 and 20
    and score >= 0 and score <= 10000000
  );

-- ポリシーだけでは permission denied になる。GRANT も要る(過去にハマった)
grant select, insert on runner_scores_hell_runner_2_draft to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
