-- NOTE: multiplayer migration lives in backend/multiplayer_schema.sql.
-- ============================================================
-- InternX Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users / Profiles ────────────────────────────────────────
create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text unique not null,
  name          text not null,
  avatar_url    text,
  github_username text unique,
  role          text not null default 'intern' check (role in ('intern', 'mentor', 'admin')),
  intern_role   text check (intern_role in ('frontend', 'backend', 'fullstack', 'devops', 'design')),
  bio           text,
  created_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Sprints ─────────────────────────────────────────────────
create table public.sprints (
  id          uuid default uuid_generate_v4() primary key,
  title       text not null,
  description text,
  start_date  date not null,
  end_date    date not null,
  is_active   boolean default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- ─── Tasks ───────────────────────────────────────────────────
create table public.tasks (
  id            uuid default uuid_generate_v4() primary key,
  sprint_id     uuid references public.sprints(id) on delete cascade,
  title         text not null,
  description   text not null,
  assigned_to   uuid references public.profiles(id),
  intern_role   text not null check (intern_role in ('frontend', 'backend', 'fullstack', 'devops', 'design')),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date      timestamptz,
  github_pr_url text,
  score         integer check (score between 0 and 100),
  feedback      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Mentor Chat Sessions ────────────────────────────────────
create table public.mentor_sessions (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete set null,
  created_at timestamptz default now()
);

create table public.mentor_messages (
  id         uuid default uuid_generate_v4() primary key,
  session_id uuid references public.mentor_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz default now()
);

-- ─── Certificates ─────────────────────────────────────────────
create table public.certificates (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  intern_role text not null,
  pdf_url     text,
  skills      jsonb default '[]',
  issued_at   timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.sprints          enable row level security;
alter table public.tasks            enable row level security;
alter table public.mentor_sessions  enable row level security;
alter table public.mentor_messages  enable row level security;
alter table public.certificates     enable row level security;

-- Profiles: users see their own, mentors/admins see all
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Mentors and admins can view all profiles"
  on public.profiles for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Sprints: everyone can read, only mentors/admins can write
create policy "Anyone can view sprints"
  on public.sprints for select using (true);
create policy "Mentors can manage sprints"
  on public.sprints for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );

-- Tasks: interns see their own, mentors see all
create policy "Interns can view their own tasks"
  on public.tasks for select using (assigned_to = auth.uid());
create policy "Mentors can view all tasks"
  on public.tasks for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );
create policy "Interns can update their own tasks"
  on public.tasks for update using (assigned_to = auth.uid());
create policy "Mentors can manage all tasks"
  on public.tasks for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('mentor', 'admin'))
  );

-- Mentor sessions/messages: users see their own only
create policy "Users see own mentor sessions"
  on public.mentor_sessions for all using (user_id = auth.uid());
create policy "Users see own mentor messages"
  on public.mentor_messages for all using (
    exists (select 1 from public.mentor_sessions where id = session_id and user_id = auth.uid())
  );

