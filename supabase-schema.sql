create table if not exists public.player_saves (
  user_id text primary key,
  nickname text not null default '本地经理',
  coins integer not null default 1286000,
  gems integer not null default 5688,
  energy integer not null default 120,
  scout_tickets integer not null default 2,
  matches_played integer not null default 0,
  wins integer not null default 0,
  collection jsonb not null default '[]'::jsonb,
  claimed_tasks jsonb not null default '[]'::jsonb,
  daily_task_date text not null default '',
  selected_formation_id text not null default '433',
  lineup jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_saves add column if not exists scout_tickets integer not null default 2;
alter table public.player_saves add column if not exists matches_played integer not null default 0;
alter table public.player_saves add column if not exists wins integer not null default 0;
alter table public.player_saves add column if not exists collection jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists claimed_tasks jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists daily_task_date text not null default '';

alter table public.player_saves enable row level security;

-- Development policy for the current client-only prototype.
-- Before release, replace this with Supabase Auth or a Douyin login Edge Function
-- so players can only read/write their own user_id.
drop policy if exists "prototype anon read player saves" on public.player_saves;
create policy "prototype anon read player saves"
on public.player_saves for select
to anon
using (true);

drop policy if exists "prototype anon upsert player saves" on public.player_saves;
create policy "prototype anon upsert player saves"
on public.player_saves for insert
to anon
with check (true);

drop policy if exists "prototype anon update player saves" on public.player_saves;
create policy "prototype anon update player saves"
on public.player_saves for update
to anon
using (true)
with check (true);
