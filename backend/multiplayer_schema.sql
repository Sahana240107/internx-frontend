-- InternX multiplayer migration
-- Apply this in Supabase SQL editor against the existing single-player schema.

create extension if not exists "uuid-ossp";

alter table public.profiles
  add column if not exists github_username text,
  add column if not exists bio text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_github_username_key'
  ) then
    alter table public.profiles add constraint profiles_github_username_key unique (github_username);
  end if;
end $$;

create table if not exists public.projects (
  id                  uuid default uuid_generate_v4() primary key,
  slug                text unique not null,
  company_name        text not null,
  company_tagline     text,
  company_color       text,
  company_emoji       text,
  project_title       text not null,
  project_description text not null,
  tech_stack          jsonb not null default '[]'::jsonb,
  difficulty          text not null default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  duration_weeks      integer not null default 2 check (duration_weeks > 0),
  intern_role         text check (intern_role in ('frontend', 'backend', 'fullstack', 'devops', 'design', 'tester', 'ui_ux')),
  team                jsonb not null default '[]'::jsonb,
  folder_structure    jsonb,
  is_active           boolean not null default true,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create table if not exists public.project_roles (
  id               uuid default uuid_generate_v4() primary key,
  project_id       uuid not null references public.projects(id) on delete cascade,
  role             text not null check (role in ('frontend', 'backend', 'fullstack', 'devops', 'design', 'tester', 'ui_ux')),
  min_members      integer not null default 1 check (min_members >= 0),
  max_members      integer not null default 1 check (max_members >= min_members),
  responsibilities jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  unique (project_id, role)
);

create table if not exists public.project_cohorts (
  id                     uuid default uuid_generate_v4() primary key,
  project_id             uuid not null references public.projects(id) on delete cascade,
  cohort_number          integer not null,
  status                 text not null default 'forming' check (status in ('forming', 'active', 'completed', 'archived')),
  github_org             text not null default 'internx',
  repo_name              text,
  repo_url               text,
  repo_private           boolean not null default false,
  github_repo_id         bigint,
  github_installation_id bigint,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  started_at             timestamptz,
  completed_at           timestamptz,
  unique (project_id, cohort_number)
);

create table if not exists public.project_members (
  id              uuid default uuid_generate_v4() primary key,
  cohort_id       uuid not null references public.project_cohorts(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('frontend', 'backend', 'fullstack', 'devops', 'design', 'tester', 'ui_ux')),
  status          text not null default 'active' check (status in ('active', 'completed', 'removed')),
  github_repo_url text,
  github_branch   text,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  unique (cohort_id, user_id)
);

create index if not exists idx_project_members_user_status
  on public.project_members (user_id, status);

create index if not exists idx_project_members_cohort_role
  on public.project_members (cohort_id, role, status);

alter table public.sprints
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists cohort_id uuid references public.project_cohorts(id) on delete cascade;

alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists cohort_id uuid references public.project_cohorts(id) on delete cascade,
  add column if not exists template_task_id uuid references public.tasks(id) on delete set null,
  add column if not exists resources text,
  add column if not exists created_by uuid references public.profiles(id);

create index if not exists idx_tasks_assigned_to_status
  on public.tasks (assigned_to, status);

create index if not exists idx_tasks_project_template
  on public.tasks (project_id, cohort_id, intern_role);

alter table public.projects enable row level security;
alter table public.project_roles enable row level security;
alter table public.project_cohorts enable row level security;
alter table public.project_members enable row level security;

drop policy if exists "Anyone can view active projects" on public.projects;
create policy "Anyone can view active projects"
  on public.projects for select using (is_active = true);

drop policy if exists "Mentors can manage projects" on public.projects;
create policy "Mentors can manage projects"
  on public.projects for all using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );

drop policy if exists "Anyone can view project roles" on public.project_roles;
create policy "Anyone can view project roles"
  on public.project_roles for select using (true);

drop policy if exists "Mentors can manage project roles" on public.project_roles;
create policy "Mentors can manage project roles"
  on public.project_roles for all using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );

drop policy if exists "Members can view their cohorts" on public.project_cohorts;
create policy "Members can view their cohorts"
  on public.project_cohorts for select using (
    exists (
      select 1
      from public.project_members pm
      where pm.cohort_id = project_cohorts.id
        and pm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );

drop policy if exists "Mentors can manage cohorts" on public.project_cohorts;
create policy "Mentors can manage cohorts"
  on public.project_cohorts for all using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );

drop policy if exists "Members can view project membership" on public.project_members;
create policy "Members can view project membership"
  on public.project_members for select using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.project_members peer
      where peer.cohort_id = project_members.cohort_id
        and peer.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );

drop policy if exists "Users can update their own membership row" on public.project_members;
create policy "Users can update their own membership row"
  on public.project_members for update using (user_id = auth.uid());

drop policy if exists "Mentors can manage memberships" on public.project_members;
create policy "Mentors can manage memberships"
  on public.project_members for all using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role in ('mentor', 'admin')
    )
  );
