-- ═══════════════════════════════════════════════════════════
--  Kirenga Blog — Supabase Database Schema  v3.0
--  Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ═══════════════════════════
--  USERS TABLE
-- ═══════════════════════════
create table if not exists public.users (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  username    text unique not null,
  email       text unique not null,
  password    text,
  via         text default 'email',
  bio         text,
  website     text,
  profile_pic text,
  joined_at   timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ═══════════════════════════
--  POSTS TABLE
-- ═══════════════════════════
create table if not exists public.posts (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  content     text not null,
  category    text not null default 'General',
  tags        text[] default '{}',
  image       text,
  author_id   uuid references public.users(id) on delete set null,
  author_name text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ═══════════════════════════
--  REACTIONS TABLE
-- ═══════════════════════════
create table if not exists public.reactions (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references public.posts(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  user_email text not null,
  emoji_key  text not null,
  created_at timestamptz default now(),
  unique(post_id, user_email)
);

-- ═══════════════════════════
--  COMMENTS TABLE
-- ═══════════════════════════
create table if not exists public.comments (
  id           uuid primary key default uuid_generate_v4(),
  post_id      uuid references public.posts(id) on delete cascade,
  parent_id    uuid references public.comments(id) on delete cascade,
  author_id    uuid references public.users(id) on delete set null,
  author_name  text not null,
  author_email text not null,
  author_via   text default 'email',
  text         text not null,
  likes        int default 0,
  liked_by     text[] default '{}',
  created_at   timestamptz default now()
);

-- ═══════════════════════════
--  MEDIA TABLE
-- ═══════════════════════════
create table if not exists public.media (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.users(id) on delete cascade,
  name       text not null,
  type       text not null,
  size       int,
  data       text,
  url        text,
  created_at timestamptz default now()
);

-- ═══════════════════════════
--  NEWSLETTER TABLE
-- ═══════════════════════════
create table if not exists public.newsletter (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  subscribed_at timestamptz default now()
);

-- ═══════════════════════════
--  CONTACT MESSAGES TABLE
-- ═══════════════════════════
create table if not exists public.contact_messages (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text not null,
  subject    text,
  message    text not null,
  created_at timestamptz default now()
);

-- ═══════════════════════════
--  FEEDBACK TABLE
-- ═══════════════════════════
create table if not exists public.feedback (
  id         uuid primary key default uuid_generate_v4(),
  type       text,
  rating     int check (rating between 0 and 5),
  text       text not null,
  email      text,
  created_at timestamptz default now()
);

-- ═══════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════
alter table public.posts            enable row level security;
alter table public.users            enable row level security;
alter table public.reactions        enable row level security;
alter table public.comments         enable row level security;
alter table public.media            enable row level security;
alter table public.newsletter       enable row level security;
alter table public.contact_messages enable row level security;
alter table public.feedback         enable row level security;

-- Posts: full public access (demo mode)
create policy "Public read posts"   on public.posts for select using (true);
create policy "Public insert posts" on public.posts for insert with check (true);
create policy "Public update posts" on public.posts for update using (true);
create policy "Public delete posts" on public.posts for delete using (true);

-- Users: full public access (demo mode)
create policy "Public read users"   on public.users for select using (true);
create policy "Public insert users" on public.users for insert with check (true);
create policy "Public update users" on public.users for update using (true);

-- Reactions: full public access
create policy "Public reactions"    on public.reactions for all using (true) with check (true);

-- Comments: full public access
create policy "Public comments"     on public.comments  for all using (true) with check (true);

-- Media: full public access
create policy "Public media"        on public.media     for all using (true) with check (true);

-- Newsletter / contact / feedback: insert only
create policy "Insert newsletter"   on public.newsletter       for insert with check (true);
create policy "Insert contact"      on public.contact_messages for insert with check (true);
create policy "Insert feedback"     on public.feedback         for insert with check (true);

-- ═══════════════════════════
--  VIEW: posts with reaction counts
-- ═══════════════════════════
create or replace view public.posts_with_reactions as
  select
    p.*,
    coalesce(
      json_object_agg(r.emoji_key, r.cnt) filter (where r.emoji_key is not null),
      '{}'::json
    ) as reaction_counts
  from public.posts p
  left join (
    select post_id, emoji_key, count(*) as cnt
    from public.reactions
    group by post_id, emoji_key
  ) r on r.post_id = p.id
  group by p.id;

-- ═══════════════════════════
--  SEED DATA (3 demo posts)
-- ═══════════════════════════
insert into public.posts (title, content, category, tags, author_name) values
(
  'Welcome to Kirenga Blog!',
  'This is the first post on Kirenga Blog. Built from scratch on a phone using TrebEdit, then polished in VS Code. Everything is now powered by a real Supabase database — your posts, comments, reactions and users all sync across devices in real time!',
  'General',
  array['welcome','blog','intro'],
  'Kirenga Isaac'
),
(
  'Why I build on my phone',
  'Most people think you need a powerful laptop to build great web projects. I proved that wrong. Using TrebEdit on Android, I built a full-featured blog with authentication, reactions, comments, a mega menu, dark mode and a real database backend. Your tools do not define your output — your creativity does.',
  'Ideas',
  array['mobile','android','coding','inspiration'],
  'Kirenga Isaac'
),
(
  'localStorage vs Real Database',
  'localStorage is great for getting started — it is fast, simple and requires no setup. But it has limits: data only lives in one browser, there is a 5–10 MB cap, and it is cleared when users wipe their browser data. A real database like Supabase PostgreSQL fixes all of this: data syncs across devices, supports millions of rows, and persists forever.',
  'Coding',
  array['database','supabase','localstorage','javascript'],
  'Kirenga Isaac'
)
on conflict do nothing;
