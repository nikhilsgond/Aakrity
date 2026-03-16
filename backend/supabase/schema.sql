create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default 'Anonymous',
  avatar_url text,
  color text not null default '#3498DB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  name text not null,
  board_title text not null default 'Untitled Board',
  owner_id uuid not null references auth.users (id) on delete cascade,
  password_hash text not null,
  max_users integer not null default 10 check (max_users between 2 and 25),
  snapshot_json jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_members_user_id_idx on public.room_members (user_id);
create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();
