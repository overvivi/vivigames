-- 本日の最強決定戦 Remaster: フレンド対戦の部屋コード用。
-- 公開テーブルを直接UPDATEさせず、部屋ごとの座席トークンを受け取るRPCだけを公開する。

create table if not exists mind_duel_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host_token uuid not null,
  guest_token uuid,
  host_name text not null check (char_length(host_name) between 1 and 12),
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 12),
  host_character_id text check (host_character_id is null or host_character_id in ('raven','mika','brick','noise','kiri','vivi','tomega9')),
  guest_character_id text check (guest_character_id is null or guest_character_id in ('raven','mika','brick','noise','kiri','vivi','tomega9')),
  host_move text check (host_move is null or host_move in ('attack','guard','break','ultimate')),
  guest_move text check (guest_move is null or guest_move in ('attack','guard','break','ultimate')),
  round integer not null default 1 check (round between 1 and 99),
  status text not null default 'waiting' check (status in ('waiting','selecting','duel','finished')),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

create index if not exists mind_duel_rooms_expires_at on mind_duel_rooms (expires_at);
alter table mind_duel_rooms enable row level security;

-- ルームの生成。衝突時は再抽選して、ホストだけに座席トークンを返す。
create or replace function mind_duel_create_room(p_name text)
returns table(code text, seat_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  new_token uuid := gen_random_uuid();
begin
  if char_length(trim(p_name)) not between 1 and 12 then raise exception '名前は1〜12文字です'; end if;
  loop
    -- pgcryptoのgen_random_bytesは環境によって有効化されていないため使わない。
    -- 6文字の部屋コードは衝突時にINSERTをやり直すので、標準の乱数ハッシュで十分。
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into mind_duel_rooms (code, host_token, host_name) values (new_code, new_token, trim(p_name));
      exit;
    exception when unique_violation then
      -- 6文字コードが偶然重なった時だけ再抽選する。
    end;
  end loop;
  return query select new_code, new_token;
end;
$$;

-- 相手の入室。満員・期限切れを弾き、ゲスト専用トークンだけを返す。
create or replace function mind_duel_join_room(p_code text, p_name text)
returns table(code text, seat_token uuid)
language plpgsql security definer set search_path = public as $$
declare new_token uuid := gen_random_uuid();
begin
  if char_length(trim(p_name)) not between 1 and 12 then raise exception '名前は1〜12文字です'; end if;
  update mind_duel_rooms r
     set guest_token = new_token, guest_name = trim(p_name), status = 'selecting', updated_at = now()
   where r.code = upper(trim(p_code)) and r.guest_token is null and r.expires_at > now();
  if not found then raise exception '部屋が見つからないか、すでに満員です'; end if;
  return query select upper(trim(p_code)), new_token;
end;
$$;

-- キャラ選択の同期。両者が選ぶまでは対戦開始を許可しない。
create or replace function mind_duel_set_character(p_code text, p_token uuid, p_character_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update mind_duel_rooms
     set host_character_id = case when host_token = p_token then p_character_id else host_character_id end,
         guest_character_id = case when guest_token = p_token then p_character_id else guest_character_id end,
         updated_at = now()
   where code = upper(trim(p_code)) and p_token in (host_token, guest_token)
     and p_character_id in ('raven','mika','brick','noise','kiri','vivi','tomega9');
  if not found then raise exception '部屋への参加権限がありません'; end if;
end;
$$;

-- 両者の選択と自分の手だけを返す。相手の手は、両者が確定するまで隠す。
create or replace function mind_duel_room_state(p_code text, p_token uuid)
returns table(code text, host_name text, guest_name text, host_character_id text, guest_character_id text, status text, round integer, own_move text, opponent_move text)
language sql security definer set search_path = public as $$
  select r.code, r.host_name, r.guest_name, r.host_character_id, r.guest_character_id, r.status, r.round,
    case when r.host_token = p_token then r.host_move else r.guest_move end,
    case when r.host_move is not null and r.guest_move is not null then case when r.host_token = p_token then r.guest_move else r.host_move end else null end
  from mind_duel_rooms r
  where r.code = upper(trim(p_code)) and p_token in (r.host_token, r.guest_token) and r.expires_at > now();
$$;

revoke all on table mind_duel_rooms from anon, authenticated;
grant execute on function mind_duel_create_room(text), mind_duel_join_room(text), mind_duel_set_character(text, uuid, text), mind_duel_room_state(text, uuid) to anon, authenticated;

-- 以下はゲーム画面側の同期用。開始はホストだけ、手は本人だけ、次ラウンドへの
-- 繰り上げはホストだけに限定して、公開テーブルの直接更新を最後まで避ける。
create or replace function mind_duel_start_duel(p_code text, p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update mind_duel_rooms
     set status = 'duel', updated_at = now()
   where code = upper(trim(p_code)) and host_token = p_token and guest_token is not null
     and host_character_id is not null and guest_character_id is not null and expires_at > now();
  if not found then raise exception '両者のキャラ選択が完了していません'; end if;
end;
$$;

create or replace function mind_duel_submit_move(p_code text, p_token uuid, p_round integer, p_move text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_move not in ('attack','guard','break','ultimate') then raise exception '無効な手です'; end if;
  update mind_duel_rooms
     set host_move = case when host_token = p_token then p_move else host_move end,
         guest_move = case when guest_token = p_token then p_move else guest_move end,
         updated_at = now()
   where code = upper(trim(p_code)) and p_token in (host_token, guest_token)
     and status = 'duel' and round = p_round
     and ((host_token = p_token and host_move is null) or (guest_token = p_token and guest_move is null));
  if not found then raise exception 'このラウンドはすでに確定済みです'; end if;
end;
$$;

create or replace function mind_duel_finish_round(p_code text, p_token uuid, p_round integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  update mind_duel_rooms
     set round = round + 1, host_move = null, guest_move = null, updated_at = now()
   where code = upper(trim(p_code)) and host_token = p_token and status = 'duel'
     and round = p_round and host_move is not null and guest_move is not null;
  if not found then raise exception '両者の手がまだ揃っていません'; end if;
end;
$$;

grant execute on function mind_duel_start_duel(text, uuid), mind_duel_submit_move(text, uuid, integer, text), mind_duel_finish_round(text, uuid, integer) to anon, authenticated;
