-- ============================================================
-- InternX AI Standup System Schema
-- Run this in Supabase SQL Editor after your existing schemas
-- ============================================================

-- ─── Standup Submissions ─────────────────────────────────────
create table if not exists public.standups (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  cohort_id       uuid references public.project_cohorts(id) on delete set null,
  date            date not null default current_date,
  yesterday       text not null,
  today           text not null,
  blockers        text not null default '',
  eta_hours       numeric(4,1),
  submitted_at    timestamptz not null default now(),
  is_late         boolean not null default false,
  -- AI analysis fields
  vague_score     integer check (vague_score between 0 and 100),   -- higher = more vague
  consistency_ok  boolean,                                          -- yesterday matches prior today?
  ai_followup     text,                                             -- AI follow-up question
  unique (user_id, date)
);

-- ─── Standup Blocker Tickets ─────────────────────────────────
-- Auto-created tickets when a standup has blockers
create table if not exists public.standup_blockers (
  id              uuid default uuid_generate_v4() primary key,
  standup_id      uuid not null references public.standups(id) on delete cascade,
  blocker_text    text not null,
  tagged_role     text,        -- which role is responsible, e.g. 'backend'
  tagged_user_id  uuid references public.profiles(id),
  ticket_id       uuid,        -- references tickets table if auto-created
  status          text not null default 'open' check (status in ('open', 'resolved')),
  created_at      timestamptz not null default now()
);

-- ─── AI Scrum Master Summaries ───────────────────────────────
create table if not exists public.standup_summaries (
  id              uuid default uuid_generate_v4() primary key,
  cohort_id       uuid references public.project_cohorts(id) on delete set null,
  date            date not null default current_date,
  summary_text    text not null,
  sprint_risk     text not null default 'low' check (sprint_risk in ('low', 'medium', 'high', 'critical')),
  blocker_count   integer not null default 0,
  late_count      integer not null default 0,
  missed_count    integer not null default 0,
  submission_count integer not null default 0,
  manager_notes   jsonb default '[]'::jsonb,  -- array of AI manager follow-up messages
  generated_at    timestamptz not null default now(),
  unique (cohort_id, date)
);

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists standups_user_date on public.standups(user_id, date desc);
create index if not exists standups_cohort_date on public.standups(cohort_id, date desc);
create index if not exists standup_summaries_cohort_date on public.standup_summaries(cohort_id, date desc);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.standups enable row level security;
alter table public.standup_blockers enable row level security;
alter table public.standup_summaries enable row level security;

-- Standups: users can insert/select their own; all team members can select within same cohort
create policy "Users can manage their own standups"
  on public.standups for all using (auth.uid() = user_id);

create policy "Team members can view cohort standups"
  on public.standups for select using (
    cohort_id in (
      select cohort_id from public.project_members where user_id = auth.uid()
    )
  );

-- Blockers: readable by team, writable by system
create policy "Team members can view blockers"
  on public.standup_blockers for select using (
    standup_id in (
      select s.id from public.standups s
      join public.project_members pm on pm.cohort_id = s.cohort_id
      where pm.user_id = auth.uid()
    )
  );

-- Summaries: readable by team
create policy "Team members can view standup summaries"
  on public.standup_summaries for select using (
    cohort_id in (
      select cohort_id from public.project_members where user_id = auth.uid()
    )
  );
