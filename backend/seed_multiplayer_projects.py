"""
seed_multiplayer_projects.py
─────────────────────────────
Adds multi-role team projects to the projects table.
Run AFTER migration_multiplayer.sql has been applied.

Usage:
    cd backend
    python seed_multiplayer_projects.py
"""

import os, sys
from dotenv import load_dotenv
load_dotenv()

from app.core.database import db

# ── Multiplayer projects ──────────────────────────────────────────────────────
# team_roles: { role: number_of_slots }
# intern_role: None (signals this is a multiplayer project)

MULTIPLAYER_PROJECTS = [
    {
        "company_name": "BuildOS",
        "company_tagline": "The dev platform that ships products, not tickets.",
        "company_color": "#6366f1",
        "company_emoji": "🚀",
        "project_title": "Build the BuildOS SaaS Dashboard",
        "project_description": (
            "BuildOS is a YC-backed startup that needs a team of interns to ship their v2 dashboard. "
            "The frontend intern builds the React UI, the backend intern builds the FastAPI service, "
            "the designer creates the Figma design system, and the tester writes the Playwright e2e suite. "
            "The team shares a GitHub repo under the InternX organisation — just like a real job. "
            "Ship it in 2 weeks."
        ),
        "tech_stack": ["React 18", "FastAPI", "PostgreSQL", "Playwright", "Figma", "Tailwind CSS", "Docker"],
        "difficulty": "advanced",
        "duration_weeks": 2,
        "intern_role": None,
        "team_roles": {"frontend": 1, "backend": 1, "design": 1, "tester": 1},
        "max_team_size": 4,
        "project_status": "open",
        "folder_structure": {
            "buildos-dashboard": {
                "frontend": {
                    "src": {
                        "components": ["Sidebar.tsx", "Header.tsx", "Dashboard.tsx", "ProjectCard.tsx"],
                        "pages": ["Home.tsx", "Projects.tsx", "Settings.tsx"],
                        "hooks": ["useAuth.ts", "useProjects.ts"],
                        "App.tsx": None,
                    },
                    "package.json": None,
                    "tsconfig.json": None,
                },
                "backend": {
                    "app": {
                        "routers": ["projects.py", "auth.py", "health.py"],
                        "models": ["project.py", "user.py"],
                        "services": ["project_service.py"],
                        "main.py": None,
                    },
                    "tests": ["test_projects.py", "test_auth.py", "conftest.py"],
                    "requirements.txt": None,
                },
                "e2e": {
                    "tests": ["auth.spec.ts", "dashboard.spec.ts", "projects.spec.ts"],
                    "playwright.config.ts": None,
                },
                "design": ["design-system.fig", "wireframes.fig", "components.fig", "handoff.md"],
                "docker-compose.yml": None,
                "README.md": None,
            }
        },
        "team": [
            {"name": "Arjun Sharma", "role": "Engineering Manager", "avatar": "AS", "color": "#6366f1"},
            {"name": "Maya Chen", "role": "Senior Engineer", "avatar": "MC", "color": "#00c896"},
            {"name": "Your Team", "role": "Intern Squad", "avatar": "IT", "color": "#f59e0b"},
        ],
    },
    {
        "company_name": "Launchpad",
        "company_tagline": "Zero to product in 30 days.",
        "company_color": "#10b981",
        "company_emoji": "🛸",
        "project_title": "Build the Launchpad MVP — Product Hunt Clone",
        "project_description": (
            "Launchpad is building a product-hunt-style platform for indie hackers. "
            "Your team builds it from scratch: a frontend intern owns the Next.js UI, "
            "a backend intern builds the FastAPI REST API, and a tester writes the full test suite. "
            "You share a GitHub repo under the InternX org and open PRs for each feature — "
            "exactly like a real startup."
        ),
        "tech_stack": ["Next.js 14", "FastAPI", "Supabase", "TypeScript", "pytest", "Tailwind CSS"],
        "difficulty": "intermediate",
        "duration_weeks": 2,
        "intern_role": None,
        "team_roles": {"frontend": 1, "backend": 1, "tester": 1},
        "max_team_size": 3,
        "project_status": "open",
        "folder_structure": {
            "launchpad": {
                "frontend": {
                    "app": {
                        "page.tsx": None,
                        "products": {"page.tsx": None, "[id]": {"page.tsx": None}},
                        "submit": {"page.tsx": None},
                        "layout.tsx": None,
                    },
                    "components": ["ProductCard.tsx", "Navbar.tsx", "VoteButton.tsx", "SearchBar.tsx"],
                    "lib": ["api.ts", "supabase.ts"],
                    "package.json": None,
                    "tsconfig.json": None,
                },
                "backend": {
                    "app": {
                        "routers": ["products.py", "votes.py", "auth.py", "comments.py"],
                        "models": ["product.py", "vote.py", "user.py"],
                        "schemas": ["product.py", "vote.py"],
                        "services": ["product_service.py", "vote_service.py"],
                        "main.py": None,
                    },
                    "tests": {
                        "unit": ["test_product_service.py", "test_vote_service.py"],
                        "integration": ["test_products_api.py", "test_votes_api.py"],
                        "conftest.py": None,
                    },
                    "requirements.txt": None,
                },
                "README.md": None,
            }
        },
        "team": [
            {"name": "Priya Nair", "role": "Product Lead", "avatar": "PN", "color": "#10b981"},
            {"name": "Your Team", "role": "Intern Squad", "avatar": "IT", "color": "#f59e0b"},
        ],
    },
    {
        "company_name": "Nexus",
        "company_tagline": "Social for builders.",
        "company_color": "#f97316",
        "company_emoji": "🌐",
        "project_title": "Build the Nexus Developer Community Platform",
        "project_description": (
            "Nexus is a GitHub-meets-Twitter platform for developers to share projects and discuss tech. "
            "A big team of interns will build it together: frontend (React feed UI), backend (FastAPI + WebSockets "
            "for real-time), designer (Figma design system + mobile wireframes), and two backend engineers to "
            "split the API work. This is the most complex project on InternX — real team, real codebase."
        ),
        "tech_stack": ["React 18", "FastAPI", "WebSockets", "PostgreSQL", "Redis", "Figma", "Docker", "Tailwind CSS"],
        "difficulty": "advanced",
        "duration_weeks": 3,
        "intern_role": None,
        "team_roles": {"frontend": 2, "backend": 2, "design": 1},
        "max_team_size": 5,
        "project_status": "open",
        "folder_structure": {
            "nexus": {
                "frontend": {
                    "src": {
                        "components": {
                            "feed": ["PostCard.tsx", "FeedList.tsx", "CreatePost.tsx"],
                            "profile": ["ProfileHeader.tsx", "ProjectGrid.tsx"],
                            "shared": ["Navbar.tsx", "Button.tsx", "Avatar.tsx"],
                        },
                        "pages": ["Feed.tsx", "Profile.tsx", "Explore.tsx", "Notifications.tsx"],
                        "hooks": ["useWebSocket.ts", "useFeed.ts", "useAuth.ts"],
                        "App.tsx": None,
                    },
                    "package.json": None,
                },
                "backend": {
                    "app": {
                        "routers": ["posts.py", "users.py", "comments.py", "notifications.py", "ws.py"],
                        "models": ["post.py", "user.py", "comment.py"],
                        "services": ["feed_service.py", "ws_manager.py", "notification_service.py"],
                        "main.py": None,
                    },
                    "requirements.txt": None,
                },
                "design": {
                    "research": ["personas.fig", "user-flows.fig"],
                    "design-system": ["colors.fig", "typography.fig", "components.fig"],
                    "screens": ["feed.fig", "profile.fig", "mobile.fig"],
                    "handoff.md": None,
                },
                "docker-compose.yml": None,
                "README.md": None,
            }
        },
        "team": [
            {"name": "Omar Hassan", "role": "CTO", "avatar": "OH", "color": "#f97316"},
            {"name": "Your Team", "role": "Intern Squad", "avatar": "IT", "color": "#f59e0b"},
        ],
    },
]


# ── Multiplayer tasks templates ───────────────────────────────────────────────
# These are the template tasks (assigned_to=null) for each project+role combo.
# They get cloned per-user when they join.

BUILDOS_TASKS = {
    "frontend": [
        {
            "title": "Set up the BuildOS React project",
            "description": (
                "Bootstrap the React 18 + TypeScript project with Vite. Configure Tailwind CSS, "
                "set up absolute imports (@ alias), and create the base folder structure matching "
                "the project layout. Add placeholder pages for Home, Projects, Settings. "
                "Verify hot reload works. Commit: 'chore: frontend scaffold'."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://vitejs.dev/guide/\nhttps://tailwindcss.com/docs/guides/vite",
        },
        {
            "title": "Build the Sidebar and Header layout",
            "description": (
                "Create the app shell: a fixed Sidebar (with nav links: Dashboard, Projects, Team, Settings) "
                "and a top Header (showing page title, user avatar, and notifications bell). "
                "Both must be responsive — sidebar collapses to icon-only on tablet. "
                "Use Tailwind for all styling. No hardcoded widths."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://tailwindcss.com/docs",
        },
        {
            "title": "Build the ProjectCard and Dashboard grid",
            "description": (
                "Create a ProjectCard component showing: project name, status badge, tech stack pills, "
                "team avatar stack, and a progress bar (tasks done / total). "
                "Wire up the Dashboard page to fetch from GET /api/projects and render cards in a responsive grid. "
                "Handle loading skeletons and empty states."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://react-query.tanstack.com/guides/queries",
        },
    ],
    "backend": [
        {
            "title": "Set up the FastAPI project and database models",
            "description": (
                "Bootstrap the FastAPI application with the folder structure from the project spec. "
                "Define SQLAlchemy models for Project and User. Set up Alembic and create the initial migration. "
                "Add a /health endpoint. Run the app locally and confirm it starts without errors."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/\nhttps://alembic.sqlalchemy.org/en/latest/tutorial.html",
        },
        {
            "title": "Implement the Projects CRUD API",
            "description": (
                "Build RESTful endpoints: GET /projects (list), POST /projects (create), "
                "GET /projects/{id} (detail), PATCH /projects/{id} (update), DELETE /projects/{id} (delete). "
                "All endpoints require auth (JWT). Include pagination on list. "
                "Write Pydantic schemas for request/response. Return 404 for missing resources."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/sql-databases/",
        },
        {
            "title": "Add auth middleware and user endpoints",
            "description": (
                "Implement JWT authentication: POST /auth/login (returns token), GET /auth/me (current user). "
                "Create a get_current_user dependency used by all protected routes. "
                "Add rate limiting (10 req/s per IP) using slowapi."
            ),
            "priority": "medium", "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/",
        },
    ],
    "design": [
        {
            "title": "Audit the current BuildOS UI and create a design brief",
            "description": (
                "Review the existing BuildOS dashboard (screenshot provided in Notion). "
                "Identify the top 5 UX problems. Write a design brief (1 page) covering: "
                "target user, key use cases, design principles, and success metrics. "
                "Share in Figma with the team before moving to wireframes."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://www.figma.com/",
        },
        {
            "title": "Create the BuildOS design system in Figma",
            "description": (
                "Build a design system covering: color palette (primary, secondary, semantic), "
                "typography scale (4 sizes, 2 weights), spacing scale, and a component library "
                "with Button (4 variants), Input, Badge, Card, Avatar, and Sidebar item. "
                "All components must have interactive states: default, hover, active, disabled."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://www.figma.com/best-practices/",
        },
        {
            "title": "Design high-fidelity Dashboard and Projects screens",
            "description": (
                "Using the design system, create hi-fi Figma screens for: "
                "Dashboard (project grid, stats cards, recent activity), "
                "Projects list, and Project detail page. "
                "Include mobile (375px) and desktop (1440px) variants. "
                "Link screens into a clickable prototype and share the link with the frontend intern."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://www.figma.com/prototyping/",
        },
    ],
    "tester": [
        {
            "title": "Set up Playwright and write the auth test suite",
            "description": (
                "Install Playwright and configure it to run against http://localhost:3000. "
                "Write e2e tests for: login flow (valid creds, invalid creds, empty form), "
                "redirect to dashboard after login, and logout. "
                "All tests must be independent (no shared state). Run: npx playwright test."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://playwright.dev/docs/intro",
        },
        {
            "title": "Write the Projects feature test suite",
            "description": (
                "Write Playwright tests for: viewing the projects list, creating a new project (form validation, "
                "success toast), viewing project detail, and editing a project. "
                "Use data-testid attributes — coordinate with the frontend intern to add them. "
                "Tests must pass in CI (no sleep() calls, use await expect().toBeVisible())."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://playwright.dev/docs/best-practices",
        },
    ],
}

LAUNCHPAD_TASKS = {
    "frontend": [
        {
            "title": "Set up Next.js 14 project with App Router",
            "description": (
                "Create the Next.js 14 project using the App Router. Configure TypeScript and Tailwind CSS. "
                "Set up the layout.tsx with a Navbar. Create placeholder routes for /, /products/[id], /submit. "
                "Add a reusable ProductCard component (image, name, tagline, vote count). Verify locally."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://nextjs.org/docs/app",
        },
        {
            "title": "Build the Product Feed and Voting UI",
            "description": (
                "Fetch products from GET /api/products and render them in a ranked list. "
                "Each row: rank number, thumbnail, name, tagline, tag badges, and a vote button. "
                "Vote button calls POST /api/products/{id}/vote — update the count optimistically. "
                "Add filters by tag (tech, design, productivity, other). Handle loading and error states."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://nextjs.org/docs/app/building-your-application/data-fetching",
        },
        {
            "title": "Build the Submit Product form",
            "description": (
                "Create /submit page with a form: product name, tagline, description, URL, tags (multi-select), "
                "thumbnail upload (client-side preview + upload to Supabase storage). "
                "Client-side validation (name required, URL valid, tagline ≤60 chars). "
                "On success, redirect to the product page with a success toast."
            ),
            "priority": "medium", "status": "todo",
            "resources": "https://supabase.com/docs/guides/storage",
        },
    ],
    "backend": [
        {
            "title": "Set up FastAPI with Supabase and auth",
            "description": (
                "Scaffold the FastAPI project. Configure the Supabase Python client. "
                "Implement POST /auth/login (Supabase OAuth), GET /auth/me (current user from JWT). "
                "Create a get_current_user dependency. Add a /health endpoint. Test with curl."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://supabase.com/docs/reference/python/introduction",
        },
        {
            "title": "Build the Products API",
            "description": (
                "GET /api/products – list all, sorted by vote count desc, with ?tag= filter. "
                "POST /api/products – create (auth required, insert into Supabase). "
                "GET /api/products/{id} – detail view. "
                "POST /api/products/{id}/vote – toggle vote (upsert into votes table, auth required). "
                "Return 409 if product name already exists."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://supabase.com/docs/reference/python/select",
        },
        {
            "title": "Add comments and rate limiting",
            "description": (
                "GET /api/products/{id}/comments – list comments. "
                "POST /api/products/{id}/comments – add comment (auth required, max 500 chars). "
                "Add slowapi rate limiting: 60 req/min per user on write endpoints. "
                "Write pytest tests for all endpoints in tests/integration/."
            ),
            "priority": "medium", "status": "todo",
            "resources": "https://github.com/laurentS/slowapi",
        },
    ],
    "tester": [
        {
            "title": "Write Playwright e2e tests for product browsing",
            "description": (
                "Set up Playwright against localhost:3000. Write tests for: "
                "loading the home page (products list renders), filtering by tag, "
                "clicking into a product detail page (name, description, vote count visible). "
                "Tests must not depend on live data — use page.route() to mock the API."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://playwright.dev/docs/mock",
        },
        {
            "title": "Write pytest API tests for the backend",
            "description": (
                "Using pytest + httpx, write integration tests for: "
                "GET /api/products (status 200, returns list), "
                "POST /api/products (creates product, returns 201), "
                "POST /api/products/{id}/vote (toggle vote, check count changes), "
                "voting without auth (returns 401). "
                "Use a test Supabase project (set TEST_SUPABASE_URL in env)."
            ),
            "priority": "high", "status": "todo",
            "resources": "https://www.encode.io/httpx/async/",
        },
    ],
}


def seed_multiplayer():
    print("🌱 InternX Multiplayer Project Seeder")
    print("=" * 50)
    print(f"Seeding {len(MULTIPLAYER_PROJECTS)} multiplayer projects...\n")

    created = 0
    project_ids = {}

    for p in MULTIPLAYER_PROJECTS:
        try:
            result = db.table("projects").insert(p).execute()
            project_id = result.data[0]["id"]
            project_ids[p["company_name"]] = project_id
            roles = ", ".join(f"{r}×{n}" for r, n in p["team_roles"].items())
            print(f"  ✓ [{roles}] {p['company_name']} — {p['project_title']}")
            created += 1
        except Exception as e:
            print(f"  ✗ {p['company_name']}: {e}")

    print(f"\n🎉 Created {created}/{len(MULTIPLAYER_PROJECTS)} projects.")
    print("\n🌱 Seeding template tasks...")

    tasks_seeded = 0
    task_map = {
        "BuildOS":   BUILDOS_TASKS,
        "Launchpad": LAUNCHPAD_TASKS,
    }

    from datetime import datetime, timedelta, timezone
    now_dt = datetime.now(timezone.utc)

    for company, tasks_by_role in task_map.items():
        project_id = project_ids.get(company)
        if not project_id:
            print(f"  ✗ {company}: project not found in project_ids")
            continue

        for role, tasks in tasks_by_role.items():
            for i, t in enumerate(tasks):
                try:
                    db.table("tasks").insert({
                        "project_id":  project_id,
                        "assigned_to": None,      # template — no assignee yet
                        "intern_role": role,
                        "title":       t["title"],
                        "description": t["description"],
                        "priority":    t.get("priority", "medium"),
                        "status":      "todo",
                        "due_date":    (now_dt + timedelta(days=(i + 1) * 3)).date().isoformat(),
                        "resources":   t.get("resources"),
                        "created_at":  now_dt.isoformat(),
                        "updated_at":  now_dt.isoformat(),
                    }).execute()
                    tasks_seeded += 1
                except Exception as e:
                    print(f"    ✗ Task '{t['title']}': {e}")

        print(f"  ✓ {company}: tasks seeded")

    print(f"\n✅ Done! {tasks_seeded} template tasks seeded.")
    print("\nNext steps:")
    print("  1. Apply migration_multiplayer.sql in Supabase SQL Editor")
    print("  2. Add GITHUB_ORG_TOKEN and GITHUB_ORG to .env")
    print("  3. Restart the backend")


if __name__ == "__main__":
    seed_multiplayer()
