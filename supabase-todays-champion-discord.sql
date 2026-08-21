-- Discord通知の重複防止。Edge Functionだけが読み書きするためRLSを有効のままポリシーは作らない。
create table todays_champion_notices (
  score_id bigint primary key references todays_champion_scores(id) on delete cascade,
  day integer not null,
  created_at timestamptz not null default now()
);

alter table todays_champion_notices enable row level security;
