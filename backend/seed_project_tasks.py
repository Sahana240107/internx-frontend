"""
InternX — Project-Specific Task Seeder
Each project gets its own realistic tasks that feel like real intern work at that company.

Usage:
    cd backend
    python seed_project_tasks.py

Make sure you've already run seed_projects.py first.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv()

from app.core.database import db

INTERN_ID = "8a5160e7-9c80-4de3-9661-ddf7b60e1d79"  # Sahana's ID
START_DATE = datetime.now(timezone.utc)

def due(days):
    return (START_DATE + timedelta(days=days)).date().isoformat()

def now():
    return datetime.now(timezone.utc).isoformat()

# ── TASKS PER PROJECT ────────────────────────────────────────────────────────
# Key = company_name (must match exactly what was seeded in seed_projects.py)

PROJECT_TASKS = {

    # ─── NEXORA (Frontend) ───────────────────────────────────────────────────
    "Nexora": [
        {
            "title": "Set up the Nexora dashboard project",
            "description": (
                "Clone the starter repo and get it running locally. Install all dependencies, "
                "connect to the dev API (credentials in the team Notion), and verify the app "
                "loads without errors. Then set up Tailwind CSS and create the base layout with "
                "a Navbar placeholder and main content area. Commit: 'chore: initial setup'."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://vitejs.dev/guide/\nhttps://tailwindcss.com/docs/guides/vite",
        },
        {
            "title": "Build the Nexora Navbar component",
            "description": (
                "The current Navbar is hardcoded HTML with no interactivity. Replace it with a "
                "proper React component. It must show: Nexora logo (SVG provided in /assets), "
                "nav links (Home, Browse, My List, Search), user avatar with dropdown (Profile, Settings, Logout). "
                "Mobile responsive — collapses to hamburger below 768px. Use the Figma spec in the team drive."
            ),
            "priority": "high", "due_days": 3, "status": "todo",
            "resources": "https://www.figma.com\nhttps://headlessui.com/react/menu",
        },
        {
            "title": "Implement the Watch History row component",
            "description": (
                "Build a horizontally scrollable row of content cards showing the user's recently watched titles. "
                "Each card: thumbnail (16:9), title, progress bar showing % watched, 'Resume' button. "
                "Fetch data from GET /api/user/watch-history. Handle loading state (show 5 skeleton cards), "
                "empty state ('Start watching something!'), and error state. "
                "Cards must be keyboard navigable (arrow keys scroll the row)."
            ),
            "priority": "high", "due_days": 5, "status": "todo",
            "resources": "https://react-query.tanstack.com\nhttps://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API",
        },
        {
            "title": "Build the Content Card with hover preview",
            "description": (
                "The ContentCard component is used across the entire dashboard. Build it with: "
                "thumbnail image, title overlay on hover, genre badges, match percentage badge (green/yellow/red), "
                "and a 300ms delayed hover preview that expands the card showing description + action buttons. "
                "The hover preview must not be cut off at row edges (flip direction if near edge). "
                "Matches the Nexora design spec exactly."
            ),
            "priority": "high", "due_days": 6, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect",
        },
        {
            "title": "Integrate the Watchlist feature",
            "description": (
                "Users can add/remove titles from their watchlist by clicking the '+' icon on any ContentCard. "
                "Requirements: optimistic UI (toggle instantly, revert on error), "
                "persist via POST /api/watchlist and DELETE /api/watchlist/:id, "
                "sync state across all cards showing the same title, "
                "show a toast notification on add/remove. "
                "Use Zustand to manage watchlist state globally."
            ),
            "priority": "medium", "due_days": 8, "status": "todo",
            "resources": "https://zustand-demo.pmnd.rs\nhttps://sonner.emilkowal.ski",
        },
        {
            "title": "Build the Watch Time Analytics chart",
            "description": (
                "Add an analytics section to the user's profile page showing: "
                "a bar chart of watch time per day (last 14 days), "
                "a donut chart of genres watched (% breakdown), "
                "a stat card showing total watch time this month vs last month. "
                "Use Recharts. Data from GET /api/analytics/watch-time. "
                "Charts must be responsive and animate on mount."
            ),
            "priority": "medium", "due_days": 10, "status": "todo",
            "resources": "https://recharts.org/en-US/api/BarChart",
        },
        {
            "title": "Fix the infinite scroll bug on Browse page",
            "description": (
                "Bug report from QA: When scrolling to the bottom of the Browse page, "
                "duplicate content appears and the page sometimes freezes. "
                "Root cause: the IntersectionObserver callback fires multiple times before the "
                "next page fetch completes. Fix by: adding an 'isFetching' ref guard, "
                "deduplicating results by ID, and adding a 500ms debounce. "
                "Write a regression test that verifies no duplicates appear after 3 pages of scroll."
            ),
            "priority": "high", "due_days": 11, "status": "todo",
            "resources": "https://react.dev/reference/react/useRef",
        },
        {
            "title": "Write component tests and ship to staging",
            "description": (
                "Set up Vitest + React Testing Library. Write tests for: "
                "ContentCard (renders correctly, hover preview appears after 300ms, watchlist toggle works), "
                "WatchHistory row (shows skeletons while loading, shows empty state, cards render), "
                "Navbar (links render, dropdown opens, logout calls clearAuth). "
                "All tests must pass. Then create a PR and request review from Alex Chen (Senior FE). "
                "Fix any review comments and merge to main."
            ),
            "priority": "high", "due_days": 13, "status": "todo",
            "resources": "https://vitest.dev\nhttps://testing-library.com/docs/react-testing-library/intro",
        },
    ],

    # ─── VELOTECH (Frontend) ─────────────────────────────────────────────────
    "Velotech": [
        {
            "title": "Set up Velotech driver app and Mapbox",
            "description": (
                "Initialize the project with Vite + React. Install mapbox-gl and create a basic "
                "MapView component that renders a full-screen map centered on San Francisco. "
                "Add a Mapbox access token to .env. The map must load in under 2 seconds. "
                "Commit: 'chore: project setup with mapbox'."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://docs.mapbox.com/mapbox-gl-js/guides/\nhttps://visgl.github.io/react-map-gl/",
        },
        {
            "title": "Build the Live Driver Location tracker",
            "description": (
                "Connect to the WebSocket endpoint ws://localhost:8000/ws/driver/{driver_id} "
                "and update the driver's marker on the map in real time. "
                "The marker must rotate to match the driver's heading. "
                "When connection drops, show a 'Reconnecting...' banner and retry every 3 seconds. "
                "Smooth the marker movement with CSS transitions (don't jump between coordinates)."
            ),
            "priority": "high", "due_days": 4, "status": "todo",
            "resources": "https://docs.mapbox.com/mapbox-gl-js/example/animate-a-point/",
        },
        {
            "title": "Build the Ride Request card",
            "description": (
                "When a ride request comes in via WebSocket, show a card overlay on the map with: "
                "pickup location name, destination name, estimated distance and time, surge multiplier badge (if > 1x), "
                "estimated earnings, and Accept/Decline buttons. "
                "The card must auto-dismiss after 15 seconds with an animated countdown ring. "
                "Accepting calls POST /api/rides/accept. Declining calls POST /api/rides/decline."
            ),
            "priority": "high", "due_days": 6, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/WebSocket",
        },
        {
            "title": "Implement route display on active ride",
            "description": (
                "When a ride is accepted, draw the route on the map using Mapbox Directions API. "
                "Show two markers: pickup (green) and destination (red). "
                "As the driver moves, update the route to show remaining distance. "
                "Display a bottom sheet with: next turn instruction, distance to pickup, ETA. "
                "Route must recalculate if driver goes off-route by more than 100 meters."
            ),
            "priority": "high", "due_days": 8, "status": "todo",
            "resources": "https://docs.mapbox.com/api/navigation/directions/",
        },
        {
            "title": "Build the Earnings dashboard",
            "description": (
                "Create an Earnings tab showing: today's earnings (large stat), "
                "this week vs last week comparison, hourly breakdown bar chart (when do they earn most), "
                "trip history list with fare, distance, and rating per trip. "
                "Data from GET /api/driver/earnings. "
                "All numbers must animate counting up when the page loads (use a counter animation hook)."
            ),
            "priority": "medium", "due_days": 10, "status": "todo",
            "resources": "https://recharts.org",
        },
        {
            "title": "Add offline mode detection",
            "description": (
                "Drivers lose connection in tunnels and basements. Handle this gracefully: "
                "detect online/offline using navigator.onLine + the 'online'/'offline' events, "
                "show a persistent banner when offline ('No connection — you won't receive ride requests'), "
                "queue any failed API calls and retry when back online, "
                "cache the last known map state so the map doesn't go blank."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine",
        },
        {
            "title": "Performance audit and optimisation",
            "description": (
                "Run Lighthouse on the app. Current scores: Performance 61, Best Practices 74. "
                "Target: Performance > 85. Fix the top issues: "
                "lazy load the Mapbox GL JS bundle (it's 780kb), "
                "memoize the RideRequestCard and EarningsChart components, "
                "virtualize the trip history list (currently renders all 200 trips). "
                "Document the before/after Lighthouse scores in your PR description."
            ),
            "priority": "medium", "due_days": 12, "status": "todo",
            "resources": "https://web.dev/performance\nhttps://react.dev/reference/react/memo",
        },
        {
            "title": "Cross-browser testing and final PR",
            "description": (
                "Test the app on Chrome, Firefox, Safari, and Chrome Mobile (use DevTools device emulation). "
                "Fix any layout issues on mobile — the map and ride request card must work on 375px screens. "
                "Write an end-to-end test using Playwright that simulates: "
                "driver goes online → receives ride request → accepts → completes ride → checks earnings. "
                "Open final PR with video recording of the flow."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://playwright.dev/docs/intro",
        },
    ],

    # ─── SHOPNEST (Frontend) ─────────────────────────────────────────────────
    "Shopnest": [
        {
            "title": "Audit and profile the current listing page",
            "description": (
                "Before writing any code, measure the problem. Run Lighthouse and Chrome DevTools "
                "Performance tab on the current /products page. Record: LCP, FID, CLS, bundle size, "
                "number of API calls, render time. Write a 1-page audit report with screenshots. "
                "This will be your baseline — every optimization will be measured against it."
            ),
            "priority": "high", "due_days": 1, "status": "todo",
            "resources": "https://web.dev/vitals\nhttps://developer.chrome.com/docs/devtools/performance/",
        },
        {
            "title": "Build the ProductCard component",
            "description": (
                "Create a ProductCard component: product image (lazy loaded), title (2 lines max, ellipsis), "
                "price with original price crossed out if discounted, star rating (show half stars), "
                "Prime badge if applicable, 'Add to Cart' button with loading state. "
                "Must render in under 16ms (no layout thrash). "
                "Write snapshot tests. Match the Figma spec pixel-perfectly."
            ),
            "priority": "high", "due_days": 3, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API",
        },
        {
            "title": "Implement the filter panel",
            "description": (
                "Build a left-sidebar filter panel with: category tree (collapsible), "
                "price range slider (min/max inputs + draggable range), "
                "star rating filter (checkboxes), brand filter (search + checkboxes, max 5 shown then 'Show more'), "
                "Prime only toggle. "
                "Filters must update URL query params (so filters survive page refresh). "
                "Apply filters client-side for instant feedback, then sync with API."
            ),
            "priority": "high", "due_days": 5, "status": "todo",
            "resources": "https://nextjs.org/docs/app/api-reference/functions/use-search-params",
        },
        {
            "title": "Implement virtual scrolling for the product grid",
            "description": (
                "The current grid renders all 500 products at once — that's why it's slow. "
                "Replace it with virtual scrolling using react-virtual. "
                "Only render products visible in the viewport + 2 rows buffer. "
                "The scroll must feel native — no jank. "
                "Show skeleton cards for items not yet loaded. "
                "Measure and document the improvement in DOM node count."
            ),
            "priority": "high", "due_days": 7, "status": "todo",
            "resources": "https://tanstack.com/virtual/latest/docs/introduction",
        },
        {
            "title": "Build the search with instant suggestions",
            "description": (
                "The search bar must show instant suggestions as the user types. "
                "Debounce API calls by 200ms. Show: top 5 matching products (with thumbnail), "
                "top 3 matching categories, recent searches (from localStorage). "
                "Keyboard navigable (up/down arrows, Enter to select, Escape to close). "
                "Analytics: log every search query to POST /api/analytics/search."
            ),
            "priority": "medium", "due_days": 9, "status": "todo",
            "resources": "https://www.w3.org/WAI/ARIA/apg/patterns/combobox/",
        },
        {
            "title": "Implement optimistic Add to Cart",
            "description": (
                "When user clicks 'Add to Cart': immediately update the cart count in the Navbar (+1), "
                "show a success toast, call POST /api/cart in the background. "
                "If the API call fails, revert the count, show an error toast, and log the error. "
                "Cart state must persist across page refreshes (sync with localStorage). "
                "The cart drawer must open from the right showing added items."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://zustand-demo.pmnd.rs",
        },
        {
            "title": "A/B test the card layout",
            "description": (
                "Product wants to test two card layouts: current (image top, text below) vs new (image left, text right). "
                "Implement a simple A/B test: use localStorage to assign users to variant A or B (50/50 split). "
                "Track: add-to-cart rate per variant, time spent on page per variant. "
                "Send events to POST /api/analytics/ab-event. "
                "Add a ?variant=A or ?variant=B query param to force a variant for testing."
            ),
            "priority": "low", "due_days": 12, "status": "todo",
            "resources": "https://www.optimizely.com/optimization-glossary/ab-testing/",
        },
        {
            "title": "Final performance validation and PR",
            "description": (
                "Re-run Lighthouse. You must hit: LCP < 2s, Performance score > 85. "
                "If not, profile and fix the bottleneck. "
                "Write a summary comparing baseline vs final metrics. "
                "Open a PR with: before/after screenshots, Lighthouse scores, "
                "description of each optimization made. Get approval from James Liu."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://web.dev/vitals",
        },
    ],

    # ─── PAYVAULT (Backend) ──────────────────────────────────────────────────
    "Payvault": [
        {
            "title": "Set up the payments microservice",
            "description": (
                "Initialize FastAPI project with the folder structure from your onboarding doc. "
                "Set up PostgreSQL connection with SQLAlchemy async, Alembic for migrations. "
                "Create the initial migration with the payments table: "
                "id (UUID), amount (integer, cents), currency (3-char code), status (enum), "
                "idempotency_key (unique), customer_id, created_at, updated_at. "
                "Add /health endpoint that checks DB connectivity. Deploy locally with Docker."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://fastapi.tiangolo.com\nhttps://alembic.sqlalchemy.org",
        },
        {
            "title": "Implement payment intent creation",
            "description": (
                "POST /payments/intents — creates a payment intent. "
                "Request body: amount (int, min 50 cents), currency, customer_id, metadata (optional dict). "
                "Returns: intent_id, client_secret, status='requires_payment_method'. "
                "Implement idempotency: if same idempotency_key is sent twice, return the existing intent (don't create duplicate). "
                "Validate: amount > 0, currency must be valid ISO 4217 code, customer must exist."
            ),
            "priority": "high", "due_days": 4, "status": "todo",
            "resources": "https://stripe.com/docs/api/payment_intents/create",
        },
        {
            "title": "Implement payment confirmation",
            "description": (
                "POST /payments/intents/{id}/confirm — confirms and processes a payment intent. "
                "Must: verify intent is in 'requires_payment_method' status (reject otherwise), "
                "call the mock payment processor (POST http://mock-processor/charge), "
                "handle processor responses: success → status='succeeded', "
                "insufficient_funds → status='failed' with decline_code, "
                "timeout → status='processing' and schedule a webhook. "
                "All state transitions must be atomic (use DB transactions)."
            ),
            "priority": "high", "due_days": 6, "status": "todo",
            "resources": "https://docs.sqlalchemy.org/en/20/orm/session_transaction.html",
        },
        {
            "title": "Build the refunds endpoint",
            "description": (
                "POST /refunds — refunds a payment. "
                "Validations: payment must be in 'succeeded' status, "
                "amount must be <= original payment amount, "
                "can't refund more than once (check existing refunds sum). "
                "Support partial refunds. "
                "Create a refunds table linked to payments. "
                "On success, call mock processor to reverse the charge. "
                "Return: refund_id, amount, status, payment_id."
            ),
            "priority": "high", "due_days": 8, "status": "todo",
            "resources": "https://stripe.com/docs/api/refunds",
        },
        {
            "title": "Implement webhooks delivery",
            "description": (
                "When payment status changes, deliver a webhook to the customer's registered endpoint. "
                "POST /webhooks/endpoints — register an endpoint URL. "
                "Webhook payload: event_type (payment.succeeded, payment.failed, refund.created), "
                "data (the full object), created_at, signature (HMAC-SHA256 of payload + secret). "
                "Retry failed webhooks with exponential backoff: 1min, 5min, 30min, 2hr, 8hr. "
                "Use Celery for the retry queue."
            ),
            "priority": "medium", "due_days": 10, "status": "todo",
            "resources": "https://stripe.com/docs/webhooks\nhttps://docs.celeryq.dev",
        },
        {
            "title": "Add rate limiting and fraud detection",
            "description": (
                "Add rate limiting: 100 payment attempts per customer per hour, "
                "5 failed attempts locks the customer for 24 hours. "
                "Basic fraud signals: flag payments where amount > 10x customer's average, "
                "flag if same card used from 2 different IPs in 10 minutes, "
                "flag rapid consecutive payments (> 3 in 60 seconds). "
                "Flagged payments go to status='requires_review' instead of processing."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://slowapi.readthedocs.io",
        },
        {
            "title": "Write comprehensive payment tests",
            "description": (
                "Write pytest tests covering: "
                "payment intent creation (happy path, duplicate idempotency key, invalid amount, invalid currency), "
                "payment confirmation (success, insufficient funds, timeout), "
                "refunds (full refund, partial refund, over-refund rejected, refund failed payment rejected), "
                "rate limiting (exceed limit, lockout). "
                "Use a test database. Mock the payment processor. Aim for 90%+ coverage. "
                "All tests must pass in under 30 seconds."
            ),
            "priority": "high", "due_days": 13, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/testing",
        },
        {
            "title": "Security audit and documentation",
            "description": (
                "Run a security checklist: are all endpoints authenticated? "
                "Are amounts validated server-side (never trust client)? "
                "Is the webhook signature verified? Are secrets in env vars (not code)? "
                "Write OpenAPI documentation for every endpoint including error responses. "
                "Write a README with: setup instructions, architecture diagram, "
                "how idempotency works, how webhooks work. "
                "Final PR for David Kim's review."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://owasp.org/www-project-api-security/",
        },
    ],

    # ─── TRAKR (Backend) ─────────────────────────────────────────────────────
    "Trakr": [
        {
            "title": "Set up Trakr API with auth",
            "description": (
                "Initialize FastAPI project. Set up PostgreSQL + Alembic. "
                "Create users table and implement JWT auth: POST /auth/register, POST /auth/login, POST /auth/refresh. "
                "Passwords hashed with bcrypt. Access token expires in 15min, refresh in 7 days. "
                "Create get_current_user dependency. All subsequent endpoints will use this."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/",
        },
        {
            "title": "Build workspaces and members",
            "description": (
                "POST /workspaces — create a workspace (creator becomes admin). "
                "GET /workspaces/me — list workspaces the user belongs to. "
                "POST /workspaces/{id}/members — invite a member (admin only), roles: admin, member, viewer. "
                "DELETE /workspaces/{id}/members/{user_id} — remove member (admin only). "
                "Implement permission middleware: check user is member of workspace before any workspace action."
            ),
            "priority": "high", "due_days": 4, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/dependencies/",
        },
        {
            "title": "Build boards and sprints",
            "description": (
                "POST /workspaces/{id}/boards — create a board. "
                "POST /boards/{id}/sprints — create a sprint with start_date, end_date, goal. "
                "POST /sprints/{id}/start — mark sprint as active (only one active sprint per board). "
                "POST /sprints/{id}/complete — complete sprint, move unfinished issues to backlog. "
                "GET /boards/{id}/sprints — list all sprints with issue counts."
            ),
            "priority": "high", "due_days": 6, "status": "todo",
            "resources": "https://www.atlassian.com/agile/scrum/sprints",
        },
        {
            "title": "Build the issues CRUD",
            "description": (
                "Issues are the core of Trakr. POST /sprints/{id}/issues — create issue with: "
                "title, description (markdown), type (bug/feature/task/story), priority, assignee, story_points, labels. "
                "PATCH /issues/{id} — update any field. "
                "POST /issues/{id}/transition — move to status (backlog/todo/in_progress/review/done). "
                "POST /issues/{id}/comments — add a comment. "
                "All changes must create an audit log entry (what changed, who changed it, when)."
            ),
            "priority": "high", "due_days": 8, "status": "todo",
            "resources": "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
        },
        {
            "title": "Implement real-time notifications with SSE",
            "description": (
                "When an issue is assigned to a user, they should see a notification instantly. "
                "Implement Server-Sent Events: GET /notifications/stream — keeps connection open and pushes events. "
                "Trigger notifications for: issue assigned to you, comment on your issue, issue status changed. "
                "Store notifications in DB (unread count, mark as read). "
                "Use Redis pub/sub to fan out to multiple server instances."
            ),
            "priority": "medium", "due_days": 10, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events",
        },
        {
            "title": "Add search and filtering",
            "description": (
                "GET /workspaces/{id}/issues/search — full text search across title and description. "
                "Filters: assignee, status, priority, type, label, sprint, created_by, date_range. "
                "Sort: created_at, updated_at, priority, story_points. "
                "Pagination: cursor-based (not offset — must work correctly with real-time updates). "
                "Search must return results in under 200ms for workspaces with 10k+ issues."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://www.postgresql.org/docs/current/textsearch.html",
        },
        {
            "title": "Write API tests with full coverage",
            "description": (
                "pytest tests for: auth (register, login, token refresh, expired token), "
                "workspaces (create, invite member, permission checks — viewer can't create issues), "
                "issues (CRUD, transitions, comments, audit log), "
                "search (basic search, filters, pagination). "
                "Use httpx.AsyncClient with a test database. "
                "CI must run all tests on every push. Aim for 85%+ coverage."
            ),
            "priority": "high", "due_days": 13, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/testing/",
        },
        {
            "title": "API documentation and performance testing",
            "description": (
                "Write complete OpenAPI docs: every endpoint, every request/response schema, every error code. "
                "Load test with Locust: simulate 100 concurrent users doing typical actions "
                "(create issue, transition, comment, search). "
                "The API must handle 100 req/sec with p95 latency < 200ms. "
                "Fix any slow queries (add indexes where needed). "
                "Final PR with load test results included."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://locust.io/\nhttps://www.postgresql.org/docs/current/indexes.html",
        },
    ],

    # ─── CHATLY (Fullstack) ──────────────────────────────────────────────────
    "Chatly": [
        {
            "title": "Set up Chatly monorepo",
            "description": (
                "Set up a monorepo with /frontend (React + Vite) and /backend (FastAPI). "
                "docker-compose.yml that starts both + PostgreSQL + Redis together. "
                "Backend: JWT auth endpoints working. "
                "Frontend: login page that authenticates and stores JWT. "
                "Both communicate correctly. README with setup instructions."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://docs.docker.com/compose/",
        },
        {
            "title": "Build the WebSocket server",
            "description": (
                "FastAPI WebSocket endpoint: ws://localhost:8000/ws/{room_id}?token={jwt}. "
                "On connect: verify JWT, add connection to room's connection pool (store in Redis). "
                "On message: save to PostgreSQL, broadcast to all connections in room. "
                "On disconnect: remove from pool. "
                "Handle multiple server instances with Redis pub/sub. "
                "Support message types: text, image_url, system (user joined/left)."
            ),
            "priority": "high", "due_days": 4, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/advanced/websockets/",
        },
        {
            "title": "Build channels and rooms API",
            "description": (
                "REST endpoints: POST /channels (create), GET /channels (list user's channels), "
                "POST /channels/{id}/join, POST /channels/{id}/leave. "
                "GET /channels/{id}/messages — paginated history (cursor-based, 50 per page). "
                "GET /channels/{id}/members — list online/offline status. "
                "POST /channels/{id}/typing — broadcast typing indicator via WebSocket."
            ),
            "priority": "high", "due_days": 6, "status": "todo",
            "resources": "https://fastapi.tiangolo.com/tutorial/bigger-applications/",
        },
        {
            "title": "Build the React chat UI",
            "description": (
                "Channel sidebar (list of channels, unread counts, click to switch). "
                "Message list (infinite scroll upward to load history, auto-scroll to bottom on new message). "
                "Message input (Enter to send, Shift+Enter for newline, emoji picker). "
                "Each message: avatar, name, timestamp, content. "
                "Typing indicator ('Alex is typing...'). "
                "WebSocket hook that connects, sends, and receives messages."
            ),
            "priority": "high", "due_days": 9, "status": "todo",
            "resources": "https://developer.mozilla.org/en-US/docs/Web/API/WebSocket",
        },
        {
            "title": "Add message threads and reactions",
            "description": (
                "Threads: click 'Reply in thread' on any message opens a right panel with the thread. "
                "Thread replies are separate WebSocket messages with parent_id set. "
                "Reactions: hover a message → emoji picker → click to add/remove reaction. "
                "Show reaction counts on messages (👍 3, ❤️ 1). "
                "Backend: POST /messages/{id}/reactions, DELETE /messages/{id}/reactions/{emoji}."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://api.slack.com/messaging/composing/formatting",
        },
        {
            "title": "Ship with CI/CD",
            "description": (
                "GitHub Actions: on PR → run backend pytest + frontend vitest + eslint. "
                "On merge to main → build Docker images, push to Docker Hub, deploy to Render. "
                "The app must be live on a public URL. "
                "Write an end-to-end test with Playwright: two browser instances, "
                "user A sends a message, verify user B receives it in real time."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://docs.github.com/en/actions\nhttps://playwright.dev",
        },
    ],

    # ─── CLOUDNEST (DevOps) ──────────────────────────────────────────────────
    "Cloudnest": [
        {
            "title": "Containerise the three microservices",
            "description": (
                "Write Dockerfiles for: api (FastAPI, port 8000), worker (Celery), nginx (reverse proxy). "
                "Requirements: use multi-stage builds, non-root user, alpine base images. "
                "Final images must be under: api < 200MB, worker < 180MB, nginx < 30MB. "
                "Test each image builds and runs correctly. "
                "docker-compose.yml that starts all three + postgres + redis."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://docs.docker.com/build/building/multi-stage/",
        },
        {
            "title": "Write the CI GitHub Actions workflow",
            "description": (
                ".github/workflows/ci.yml that triggers on push to main and all PRs: "
                "job 1 (parallel): backend tests (pytest), frontend tests (vitest), lint (ruff + eslint). "
                "job 2 (after job 1 passes): build all Docker images, run docker-compose up, "
                "run smoke tests (curl /health on each service). "
                "PR must be blocked from merging if CI fails. "
                "Add build status badge to README."
            ),
            "priority": "high", "due_days": 4, "status": "todo",
            "resources": "https://docs.github.com/en/actions/writing-workflows",
        },
        {
            "title": "Write Terraform for AWS infrastructure",
            "description": (
                "Provision with Terraform: VPC with public + private subnets, "
                "EC2 t2.micro in public subnet, RDS PostgreSQL db.t3.micro in private subnet, "
                "S3 bucket for static assets, security groups (EC2: ports 80/443/22, RDS: port 5432 from EC2 only). "
                "All resources tagged with project=cloudnest, env=production. "
                "terraform plan must show 0 errors before applying."
            ),
            "priority": "high", "due_days": 7, "status": "todo",
            "resources": "https://registry.terraform.io/providers/hashicorp/aws/latest/docs",
        },
        {
            "title": "Write the CD deployment workflow",
            "description": (
                ".github/workflows/deploy.yml — triggers on merge to main: "
                "build and push Docker images to Docker Hub (tagged with git SHA), "
                "SSH into EC2, pull new images, run docker-compose up -d with zero-downtime (blue/green), "
                "run health checks, rollback automatically if health checks fail. "
                "Deployment must complete in under 3 minutes."
            ),
            "priority": "high", "due_days": 9, "status": "todo",
            "resources": "https://docs.docker.com/compose/production/",
        },
        {
            "title": "Set up Prometheus + Grafana monitoring",
            "description": (
                "Add /metrics endpoint to the FastAPI app (use prometheus-fastapi-instrumentator). "
                "docker-compose.yml: add prometheus (scrapes /metrics every 15s) and grafana services. "
                "Create a Grafana dashboard showing: request rate, error rate (4xx/5xx), "
                "p50/p95/p99 latency, CPU usage, memory usage. "
                "Set up an alert: PagerDuty notification when error rate > 5% for 2 minutes."
            ),
            "priority": "medium", "due_days": 11, "status": "todo",
            "resources": "https://prometheus.io/docs\nhttps://grafana.com/docs/grafana/latest/",
        },
        {
            "title": "Security hardening",
            "description": (
                "Run Trivy on all Docker images — fix any CRITICAL or HIGH CVEs. "
                "Add GitHub Actions step that fails CI if Trivy finds critical issues. "
                "Rotate all secrets to AWS Secrets Manager (no secrets in env files or code). "
                "Enable RDS encryption at rest. Enable S3 bucket versioning and block public access. "
                "Document all security decisions in SECURITY.md."
            ),
            "priority": "medium", "due_days": 12, "status": "todo",
            "resources": "https://aquasecurity.github.io/trivy/\nhttps://aws.amazon.com/secrets-manager/",
        },
        {
            "title": "Runbook and disaster recovery test",
            "description": (
                "Write a runbook (RUNBOOK.md): how to deploy, how to rollback, how to access logs, "
                "how to connect to the database, what to do if the app is down. "
                "Simulate a disaster: terminate the EC2 instance, time how long until the app is back up. "
                "Target: < 5 minutes. If longer, automate the recovery. "
                "Final PR with a video walkthrough of the full deployment pipeline."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://sre.google/sre-book/table-of-contents/",
        },
    ],

    # ─── FINOVA (Design) ─────────────────────────────────────────────────────
    "Finova": [
        {
            "title": "User research — interview 3 Finova users",
            "description": (
                "Interview 3 people who invest (friends, family, classmates). "
                "Ask: what app do you use now, what's confusing about it, "
                "walk me through the last time you bought a stock, what would make you trust an app with your money. "
                "Record (with permission) or take notes. Synthesize findings: "
                "top 3 pain points, top 3 goals, surprising insights. "
                "Deliver: interview notes + synthesis document in FigJam."
            ),
            "priority": "high", "due_days": 2, "status": "todo",
            "resources": "https://www.nngroup.com/articles/user-interviews/",
        },
        {
            "title": "Create 2 user personas",
            "description": (
                "Based on research, create 2 personas in Figma: "
                "Persona 1: casual investor (25yo, invests small amounts, wants simplicity), "
                "Persona 2: active trader (35yo, checks portfolio daily, wants data density). "
                "Each persona: photo, name, age, bio, goals (3), frustrations (3), "
                "tech comfort, quote that captures their mindset. "
                "Design must look professional — no generic templates."
            ),
            "priority": "high", "due_days": 3, "status": "todo",
            "resources": "https://www.figma.com/community/file/1233483882259463062",
        },
        {
            "title": "Build the Finova design system",
            "description": (
                "Create a Figma design system file: "
                "Colors: primary green (#00d4aa), semantic colors (gain/loss/neutral), neutrals. "
                "Typography: display (portfolio value), heading, body, caption, mono (prices). "
                "Components: Button (4 variants), Input, Card, Badge (gain/loss), Sparkline, Avatar. "
                "All components use auto-layout. Named with BEM convention. "
                "Add a usage guide page showing when to use each component."
            ),
            "priority": "high", "due_days": 5, "status": "todo",
            "resources": "https://www.figma.com/best-practices/components-styles-and-shared-libraries/",
        },
        {
            "title": "Design the Home feed screen",
            "description": (
                "The home feed is the first thing users see after login. Design it for both personas: "
                "portfolio value (large, with 24h change), top movers, watchlist, news feed. "
                "Create: mobile (375px) and tablet (768px) layouts. "
                "Show 3 states: loading skeleton, populated, empty (new user). "
                "Use real stock data (AAPL, TSLA, GOOGL) — no placeholder text."
            ),
            "priority": "high", "due_days": 7, "status": "todo",
            "resources": "https://www.figma.com/community/file/1114186471935948807",
        },
        {
            "title": "Design the Stock Detail and Buy/Sell flow",
            "description": (
                "Stock detail page: price chart (1D/1W/1M/1Y), key stats, news, analyst ratings. "
                "Buy flow (3 steps): enter amount → review order → confirmation. "
                "Show both market order and limit order variants. "
                "Every screen needs: empty state, loading state, error state. "
                "Add motion annotations: how the chart animates, how the buy sheet slides up."
            ),
            "priority": "high", "due_days": 10, "status": "todo",
            "resources": "https://developer.apple.com/design/human-interface-guidelines/",
        },
        {
            "title": "Run usability testing on the prototype",
            "description": (
                "Create an interactive Figma prototype connecting all screens. "
                "Test with 3 participants. Tasks: "
                "1) Find out how much Apple stock you own. "
                "2) Buy $50 of Tesla. "
                "3) Set a price alert for Google at $200. "
                "Record time-on-task, errors, and satisfaction (1-5). "
                "Make at least 5 design changes based on findings. Document what changed and why."
            ),
            "priority": "high", "due_days": 12, "status": "todo",
            "resources": "https://maze.co/guides/usability-testing/",
        },
        {
            "title": "Design handoff and developer specs",
            "description": (
                "Prepare the design for engineering handoff: "
                "export all assets at 1x/2x/3x (icons as SVG, images as WebP). "
                "Write specs for every interactive component: tap targets (min 44px), "
                "animation timings, color values with dark mode variants. "
                "Create a Zeroheight page documenting the design system. "
                "Record a 5-minute Loom walking engineers through the designs."
            ),
            "priority": "high", "due_days": 14, "status": "todo",
            "resources": "https://zeroheight.com\nhttps://www.figma.com/best-practices/",
        },
    ],
}


def seed():
    print("🌱 InternX Project Task Seeder")
    print("=" * 50)

    # Fetch all projects
    projects_res = db.table("projects").select("id, company_name, intern_role").execute()
    if not projects_res.data:
        print("❌ No projects found. Run seed_projects.py first!")
        sys.exit(1)

    projects_map = {p["company_name"]: p for p in projects_res.data}
    print(f"✓ Found {len(projects_map)} projects\n")

    total_created = 0

    for company_name, tasks in PROJECT_TASKS.items():
        project = projects_map.get(company_name)
        if not project:
            print(f"  ⚠ Project '{company_name}' not found in DB — skipping")
            continue

        project_id = project["id"]
        intern_role = project["intern_role"]
        print(f"📋 [{intern_role.upper()}] {company_name} — seeding {len(tasks)} tasks...")

        # Create a sprint for this project
        sprint_res = db.table("sprints").insert({
            "title": f"Sprint 1 — {company_name}",
            "description": f"Main sprint for the {company_name} internship project.",
            "start_date": START_DATE.date().isoformat(),
            "end_date": (START_DATE + timedelta(days=14)).date().isoformat(),
            "is_active": True,
            "created_by": INTERN_ID,
        }).execute()

        sprint_id = sprint_res.data[0]["id"]
        created = 0

        for task in tasks:
            try:
                db.table("tasks").insert({
                    "title": task["title"],
                    "description": task["description"],
                    "sprint_id": sprint_id,
                    "project_id": project_id,
                    "assigned_to": INTERN_ID,
                    "intern_role": intern_role,
                    "priority": task["priority"],
                    "status": task["status"],
                    "due_date": due(task["due_days"]),
                    "resources": task.get("resources", ""),
                    "created_by": INTERN_ID,
                    "created_at": now(),
                    "updated_at": now(),
                }).execute()
                created += 1
            except Exception as e:
                print(f"    ✗ {task['title']}: {e}")

        print(f"  ✓ Created {created}/{len(tasks)} tasks (sprint: {sprint_id})\n")
        total_created += created

    print(f"🎉 Done! Total tasks created: {total_created}")
    print("\nEach project now has its own sprint and realistic tasks.")
    print("The dashboard will show tasks filtered by the intern's assigned project.")


if __name__ == "__main__":
    seed()