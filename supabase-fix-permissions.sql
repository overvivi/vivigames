-- テーブルへの基本アクセス権限(GRANT)を付与する。
-- RLSポリシーだけでは足りず、この権限が無いと「permission denied」になる。
grant select, insert on runner_scores to anon, authenticated;
grant select, insert on boss_battle_scores to anon, authenticated;

-- id列(bigint generated always as identity)の採番に必要な権限
grant usage on all sequences in schema public to anon, authenticated;
