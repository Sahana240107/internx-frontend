# InternX team-based product scaffold

This scaffold adds the basic folder structure and starter files needed for the new multi-team product features.

## Added frontend routes

```text
frontend/app/
+-- dashboard/
¦   +-- layout.jsx
¦   +-- page.jsx
¦   +-- analytics/page.jsx
¦   +-- calendar/page.jsx
¦   +-- chat/page.jsx
¦   +-- guide/page.jsx
¦   +-- profile/page.jsx
¦   +-- report-user/page.jsx
¦   +-- review/page.jsx
¦   +-- setup/page.jsx
¦   +-- teammates/page.jsx
+-- page.jsx
+-- projects/next/page.jsx

frontend/components/team-hub/
+-- DashboardPanel.jsx
+-- DashboardShell.jsx

frontend/lib/
+-- teamHubData.js
```

## Added backend scaffold

```text
backend/app/
+-- routers/
¦   +-- github.py
¦   +-- team_hub.py
+-- schemas/
¦   +-- team_hub.py
+-- services/
    +-- team_hub.py
```

## What this scaffold covers

- Public landing page before sign-in
- Team-based dashboard navigation
- Assigned sprint overview
- Shared guide module
- Setup and repo automation placeholders
- Chat and Meet entry point
- Sprint calendar module
- Teammates sprint summary
- Review suggestions area
- Profile and analytics placeholders
- Report user form scaffold
- Next project selection page after completion

## Recommended next implementation steps

1. Replace frontend mock data in `frontend/lib/teamHubData.js` with live API calls.
2. Connect `backend/app/routers/github.py` to a real GitHub PAT or GitHub App flow.
3. Persist team templates, sprint events, reports, and project completions in Supabase tables.
4. Add `.vscode` template files to the generated team repositories during automation.
