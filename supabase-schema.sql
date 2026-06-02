create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  douyin_open_id text unique,
  nickname text not null default '抖音玩家',
  avatar_url text,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.player_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins integer not null default 1286000,
  gems integer not null default 0,
  energy integer not null default 120,
  scout_tickets integer not null default 2,
  matches_played integer not null default 0,
  wins integer not null default 0,
  daily_task_date date not null default current_date,
  claimed_tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete set null,
  opponent_is_bot boolean not null default true,
  opponent_name text not null,
  mode text not null default 'ai',
  player_score integer not null,
  opponent_score integer not null,
  result text not null check (result in ('win', 'draw', 'lose')),
  formation_id text not null,
  lineup jsonb not null default '[]'::jsonb,
  opponent_formation_id text,
  opponent_lineup jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  rewards jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists matches_player_id_ended_at_idx
on public.matches (player_id, ended_at desc);

create index if not exists matches_cleanup_idx
on public.matches (ended_at);

insert into public.profiles (douyin_open_id, nickname, avatar_url, is_bot)
values
  ('bot-spark-001', '星河前锋', null, true),
  ('bot-spark-002', '青柠队长', null, true),
  ('bot-spark-003', '风暴经理人', null, true),
  ('bot-spark-004', '南看台小王', null, true),
  ('bot-spark-005', '凌空抽射', null, true),
  ('bot-spark-006', '今晚补时绝杀', null, true),
  ('bot-spark-007', '蓝焰十一人', null, true),
  ('bot-spark-008', '门线救险', null, true)
on conflict (douyin_open_id) do update
set
  nickname = excluded.nickname,
  is_bot = true;

insert into public.profiles (douyin_open_id, nickname, avatar_url, is_bot)
values ('douyin:web-local-001', '本地测试经理', '/assets/players/generated/saka.png', false)
on conflict (douyin_open_id) do update
set
  nickname = excluded.nickname,
  avatar_url = excluded.avatar_url,
  is_bot = false,
  last_login_at = now();

insert into public.player_state (user_id)
select id
from public.profiles
where douyin_open_id = 'douyin:web-local-001'
on conflict (user_id) do nothing;

update public.player_state
set gems = 0
where user_id in (
  select id
  from public.profiles
  where douyin_open_id = 'douyin:web-local-001'
)
and gems = 5688;

alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.matches enable row level security;

drop policy if exists "anon can read bot profiles" on public.profiles;
create policy "anon can read bot profiles"
on public.profiles for select
to anon
using (is_bot = true);

drop policy if exists "anon can read own light profile" on public.profiles;
create policy "anon can read own light profile"
on public.profiles for select
to anon
using (true);

drop policy if exists "anon can read recent matches" on public.matches;
create policy "anon can read recent matches"
on public.matches for select
to anon
using (ended_at >= now() - interval '7 days');

create or replace function public.cleanup_old_matches()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.matches
  where ended_at < now() - interval '7 days';
$$;

create or replace function public.apply_match_result(
  p_user_id uuid,
  p_win boolean,
  p_coins integer,
  p_scout_tickets integer,
  p_energy_cost integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.player_state
  set
    coins = coins + greatest(p_coins, 0),
    scout_tickets = scout_tickets + greatest(p_scout_tickets, 0),
    energy = greatest(0, energy - greatest(p_energy_cost, 0)),
    matches_played = matches_played + 1,
    wins = wins + case when p_win then 1 else 0 end,
    updated_at = now()
  where user_id = p_user_id;
$$;

-- If pg_cron is enabled in Supabase, run this once in SQL editor:
-- select cron.schedule('cleanup-old-matches', '15 3 * * *', $$select public.cleanup_old_matches();$$);
