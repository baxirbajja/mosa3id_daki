-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists btree_gist;

create table if not exists public.weekly_availability (
  weekday smallint primary key check (weekday between 0 and 6), -- Sunday=0
  is_open boolean not null default false,
  start_time time not null default '10:00',
  end_time time not null default '22:00',
  check (end_time > start_time),
  check (start_time >= '10:00' and end_time <= '22:00')
);

create table if not exists public.date_exceptions (
  date date primary key,
  is_open boolean not null,
  start_time time,
  end_time time,
  note text,
  check ((is_open = false) or (start_time is not null and end_time is not null and end_time > start_time)),
  check (start_time is null or start_time >= '10:00'),
  check (end_time is null or end_time <= '22:00')
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (char_length(customer_phone) between 8 and 20),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  check (end_at = start_at + interval '60 minutes'),
  check (end_at > start_at),
  constraint appointments_no_overlap exclude using gist (tstzrange(start_at, end_at, '[)') with &&) where (status = 'confirmed')
);
create index if not exists appointments_start_at_idx on public.appointments(start_at);
create index if not exists appointments_status_idx on public.appointments(status);

insert into public.weekly_availability(weekday,is_open,start_time,end_time) values
 (0,false,'10:00','22:00'), (1,true,'10:00','22:00'), (2,true,'10:00','22:00'),
 (3,true,'10:00','22:00'), (4,true,'10:00','22:00'), (5,true,'10:00','22:00'), (6,true,'10:00','22:00')
on conflict (weekday) do nothing;

-- The service-role key is used only on the server. Deny direct client access via RLS.
alter table public.weekly_availability enable row level security;
alter table public.date_exceptions enable row level security;
alter table public.appointments enable row level security;
revoke all on public.weekly_availability from anon, authenticated;
revoke all on public.date_exceptions from anon, authenticated;
revoke all on public.appointments from anon, authenticated;
