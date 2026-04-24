# InternX multiplayer project model

## Core change

Single-player InternX used one `project_id` per profile and cloned a private copy of the same project for every user. That does not work once the same project template needs multiple interns in different roles, and once the same template can run for many parallel teams.

The backend now targets this model:

- `projects`: reusable project templates
- `project_roles`: required roles and vacancy counts per template
- `project_cohorts`: each live team running a template
- `project_members`: which users joined a cohort and in which role
- `tasks`: template rows when `cohort_id` and `assigned_to` are null, cohort task instances otherwise
- `sprints`: cohort-level sprint records

## Assignment flow

1. User completes onboarding and chooses an `intern_role`.
2. `POST /api/projects/assign` looks for an active cohort with a vacancy in that role.
3. If none exists, it creates a new `project_cohort` for a matching template.
4. The user is inserted into `project_members`.
5. Role-matching template tasks are cloned into cohort task rows for that user.

## GitHub flow

- One official repo should exist per `project_cohort`.
- `project_cohorts.repo_url` stores the InternX-owned repository URL.
- `project_members.github_branch` stores the user branch name inside that shared repo.
- `project_members.github_repo_url` can remain as a temporary compatibility field while the frontend still asks users for a repo URL.

## Seed data shape

For each project template:

- insert one `projects` row
- insert one `project_roles` row per required role
- insert unassigned template rows into `tasks` with:
  - `project_id` set
  - `cohort_id = null`
  - `assigned_to = null`
  - `intern_role` set to the role that owns the task

## GitHub app recommendation

For production, do not use a personal PAT for repo creation and collaborator management. Create an `internx` GitHub organization and a GitHub App with:

- repository administration
- repository contents
- pull requests
- members / collaborators write access

That lets InternX create one repo per cohort and invite assigned interns cleanly.
