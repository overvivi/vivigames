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
