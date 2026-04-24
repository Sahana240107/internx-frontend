"""
InternX — Project Seeder
Populates the projects table with realistic fake big tech internship projects.

Usage:
    cd backend
    python seed_projects.py
"""

import os
import sys
from dotenv import load_dotenv
load_dotenv()

from app.core.database import db

PROJECTS = [
    # ─── FRONTEND ────────────────────────────────────────────────────────────
    {
        "company_name": "Nexora",
        "company_tagline": "Stream smarter. Live deeper.",
        "company_color": "#e50914",
        "company_emoji": "🎬",
        "project_title": "Redesign the Nexora Web Dashboard",
        "project_description": (
            "Nexora's current web dashboard was built in 2019 and hasn't been touched since. "
            "Your job as a frontend intern is to redesign and rebuild it from scratch using modern React. "
            "You'll work closely with the design team (who have already delivered Figma specs) and the "
            "backend team (API is ready). The new dashboard must support 10M+ users so performance is critical. "
            "By the end of this internship you'll have shipped a feature used by real users worldwide."
        ),
        "tech_stack": ["React 18", "TypeScript", "Tailwind CSS", "React Query", "Recharts", "Vite"],
        "difficulty": "intermediate",
        "duration_weeks": 2,
        "intern_role": "frontend",
        "team": [
            {"name": "Priya Nair", "role": "Engineering Manager", "avatar": "PN", "color": "#5b4fff"},
            {"name": "Alex Chen", "role": "Senior Frontend Engineer", "avatar": "AC", "color": "#00c896"},
            {"name": "You", "role": "Frontend Intern", "avatar": "ME", "color": "#f59e0b"},
            {"name": "Sara Kim", "role": "UI/UX Designer", "avatar": "SK", "color": "#ec4899"},
        ],
        "folder_structure": {
            "nexora-dashboard": {
                "src": {
                    "components": {
                        "ui": ["Button.tsx", "Card.tsx", "Badge.tsx", "Spinner.tsx"],
                        "layout": ["Navbar.tsx", "Sidebar.tsx", "PageWrapper.tsx"],
                        "charts": ["WatchTimeChart.tsx", "GenreBreakdown.tsx"],
                    },
                    "pages": ["Dashboard.tsx", "Browse.tsx", "Profile.tsx", "Settings.tsx"],
                    "hooks": ["useAuth.ts", "useAnalytics.ts", "useWatchHistory.ts"],
                    "utils": ["api.ts", "formatters.ts", "constants.ts"],
                    "types": ["index.ts"],
                    "App.tsx": None,
                    "main.tsx": None,
                },
                "public": ["logo.svg", "favicon.ico"],
                "index.html": None,
                "vite.config.ts": None,
                "tailwind.config.ts": None,
                "package.json": None,
                "README.md": None,
            }
        },
    },
    {
        "company_name": "Velotech",
        "company_tagline": "Move the world, one ride at a time.",
        "company_color": "#000000",
        "company_emoji": "🚗",
        "project_title": "Build the Driver Live Tracking Interface",
        "project_description": (
            "Velotech is expanding to 50 new cities this quarter. Your team is building the "
            "driver-facing web app that shows real-time ride requests, navigation, and earnings. "
            "As the frontend intern, you own the live map component and the earnings dashboard. "
            "This is high-stakes — drivers depend on this interface to earn their living. "
            "You'll use WebSockets for real-time updates and Mapbox for the map."
        ),
        "tech_stack": ["React 18", "JavaScript", "Mapbox GL JS", "WebSockets", "Zustand", "Tailwind CSS"],
        "difficulty": "advanced",
        "duration_weeks": 2,
        "intern_role": "frontend",
        "team": [
            {"name": "Marcus Webb", "role": "Tech Lead", "avatar": "MW", "color": "#5b4fff"},
            {"name": "Divya Rao", "role": "Senior Frontend Engineer", "avatar": "DR", "color": "#00c896"},
            {"name": "You", "role": "Frontend Intern", "avatar": "ME", "color": "#f59e0b"},
        ],
        "folder_structure": {
            "velotech-driver-app": {
                "src": {
                    "components": {
                        "map": ["LiveMap.jsx", "RideMarker.jsx", "RouteOverlay.jsx"],
                        "rides": ["RideRequest.jsx", "ActiveRide.jsx", "RideHistory.jsx"],
                        "earnings": ["EarningsCard.jsx", "WeeklyChart.jsx"],
                        "shared": ["Button.jsx", "Modal.jsx", "Toast.jsx"],
                    },
                    "hooks": ["useWebSocket.js", "useLocation.js", "useEarnings.js"],
                    "store": ["rideStore.js", "driverStore.js"],
                    "utils": ["mapHelpers.js", "api.js", "formatCurrency.js"],
                    "pages": ["Home.jsx", "Earnings.jsx", "Profile.jsx"],
                    "App.jsx": None,
                    "main.jsx": None,
                },
                "public": ["logo.svg"],
                "package.json": None,
                "vite.config.js": None,
                "README.md": None,
            }
        },
    },
    {
        "company_name": "Shopnest",
        "company_tagline": "Everything you need, delivered fast.",
        "company_color": "#ff9900",
        "company_emoji": "🛍️",
        "project_title": "Rebuild the Product Listing & Search Experience",
        "project_description": (
            "Shopnest's product listing page handles 2 million searches per day. "
            "The current page is slow (8s load time) and has a poor mobile experience. "
            "Your internship project is to rebuild it with a focus on performance and UX. "
            "You'll implement virtual scrolling, optimistic UI, and advanced filtering. "
            "The PM has set a target: under 2s load time and 40% increase in add-to-cart rate."
        ),
        "tech_stack": ["React 18", "TypeScript", "CSS Modules", "React Virtual", "Axios", "Jest"],
        "difficulty": "intermediate",
        "duration_weeks": 2,
        "intern_role": "frontend",
        "team": [
            {"name": "Rachel Torres", "role": "Product Manager", "avatar": "RT", "color": "#f59e0b"},
            {"name": "James Liu", "role": "Senior Engineer", "avatar": "JL", "color": "#5b4fff"},
            {"name": "You", "role": "Frontend Intern", "avatar": "ME", "color": "#00c896"},
            {"name": "Nina Patel", "role": "QA Engineer", "avatar": "NP", "color": "#ec4899"},
        ],
        "folder_structure": {
            "shopnest-listing": {
                "src": {
                    "components": {
                        "product": ["ProductCard.tsx", "ProductGrid.tsx", "ProductSkeleton.tsx"],
                        "filters": ["FilterPanel.tsx", "PriceRange.tsx", "CategoryTree.tsx", "RatingFilter.tsx"],
                        "search": ["SearchBar.tsx", "SearchSuggestions.tsx", "NoResults.tsx"],
                        "cart": ["AddToCart.tsx", "CartToast.tsx"],
                    },
                    "hooks": ["useProducts.ts", "useFilters.ts", "useSearch.ts", "useCart.ts"],
                    "utils": ["api.ts", "formatPrice.ts", "analytics.ts"],
                    "types": ["product.ts", "filter.ts", "cart.ts"],
                    "pages": ["ListingPage.tsx", "ProductDetail.tsx"],
                    "App.tsx": None,
                },
                "package.json": None,
                "tsconfig.json": None,
                "README.md": None,
            }
        },
    },

    # ─── BACKEND ─────────────────────────────────────────────────────────────
    {
        "company_name": "Payvault",
        "company_tagline": "Payments infrastructure for the internet.",
        "company_color": "#635bff",
        "company_emoji": "💳",
        "project_title": "Build the Payment Processing Microservice",
        "project_description": (
            "Payvault processes $2B in transactions daily. You're joining the Core Payments team "
            "to build a new microservice that handles payment intent creation, confirmation, and refunds. "
            "Security is everything here — every endpoint is audited. You'll write the service from scratch "
            "using FastAPI, implement idempotency keys to prevent double-charges, and write comprehensive tests. "
            "This is the kind of backend work that teaches you how serious engineering is done."
        ),
        "tech_stack": ["FastAPI", "PostgreSQL", "Redis", "SQLAlchemy", "Alembic", "pytest", "Docker"],
        "difficulty": "advanced",
        "duration_weeks": 2,
        "intern_role": "backend",
        "team": [
            {"name": "David Kim", "role": "Staff Engineer", "avatar": "DK", "color": "#635bff"},
            {"name": "Amara Osei", "role": "Senior Backend Engineer", "avatar": "AO", "color": "#00c896"},
            {"name": "You", "role": "Backend Intern", "avatar": "ME", "color": "#f59e0b"},
        ],
        "folder_structure": {
            "payvault-payments-service": {
                "app": {
                    "routers": ["payments.py", "refunds.py", "webhooks.py", "health.py"],
                    "models": ["payment.py", "refund.py", "customer.py"],
                    "schemas": ["payment.py", "refund.py", "webhook.py"],
                    "services": ["payment_service.py", "refund_service.py", "idempotency.py"],
                    "core": ["config.py", "database.py", "security.py", "exceptions.py"],
                    "main.py": None,
                },
                "tests": {
                    "unit": ["test_payment_service.py", "test_idempotency.py"],
                    "integration": ["test_payments_api.py", "test_refunds_api.py"],
                    "conftest.py": None,
                },
                "alembic": {"versions": [], "env.py": None},
                "Dockerfile": None,
                "requirements.txt": None,
                "README.md": None,
            }
        },
    },
    {
        "company_name": "Trakr",
        "company_tagline": "Ship faster. Track everything.",
        "company_color": "#0052cc",
        "company_emoji": "📋",
        "project_title": "Build the Project Management API",
        "project_description": (
            "Trakr is a Jira competitor used by 500k teams. You're building the core API for "
            "their next-generation product: workspaces, boards, sprints, issues, and comments. "
            "The API must be RESTful, well-documented (auto-generated OpenAPI), and handle "
            "complex permission models (workspace admin, board member, viewer). "
            "You'll also implement real-time notifications using Server-Sent Events."
        ),
        "tech_stack": ["FastAPI", "PostgreSQL", "SQLAlchemy", "Alembic", "Redis", "SSE", "pytest"],
        "difficulty": "intermediate",
        "duration_weeks": 2,
        "intern_role": "backend",
        "team": [
            {"name": "Lena Hoffman", "role": "Engineering Manager", "avatar": "LH", "color": "#0052cc"},
            {"name": "Raj Mehta", "role": "Senior Backend Engineer", "avatar": "RM", "color": "#00c896"},
            {"name": "You", "role": "Backend Intern", "avatar": "ME", "color": "#f59e0b"},
            {"name": "Chloe Zhang", "role": "Frontend Engineer", "avatar": "CZ", "color": "#ec4899"},
        ],
        "folder_structure": {
            "trakr-api": {
                "app": {
                    "routers": ["workspaces.py", "boards.py", "sprints.py", "issues.py", "comments.py", "auth.py"],
                    "models": ["workspace.py", "board.py", "sprint.py", "issue.py", "user.py"],
                    "schemas": ["workspace.py", "board.py", "issue.py", "auth.py"],
                    "services": ["workspace_service.py", "issue_service.py", "notification_service.py"],
                    "core": ["config.py", "database.py", "auth.py", "permissions.py"],
                    "main.py": None,
                },
                "tests": ["test_workspaces.py", "test_issues.py", "test_permissions.py", "conftest.py"],
                "alembic": {"versions": [], "env.py": None},
                "requirements.txt": None,
                "README.md": None,
            }
        },
    },

    # ─── FULLSTACK ────────────────────────────────────────────────────────────
    {
        "company_name": "Chatly",
        "company_tagline": "Where teams do their best work.",
        "company_color": "#4a154b",
        "company_emoji": "💬",
        "project_title": "Build Real-Time Team Messaging",
        "project_description": (
            "Chatly is taking on Slack with a cleaner, faster product. You're the only fullstack intern "
            "on the team and you own the messaging feature end-to-end: backend WebSocket server, "
            "message persistence, and the React chat UI. By the end of this internship you'll have "
            "built a fully working real-time chat system that supports channels, threads, and reactions."
        ),
        "tech_stack": ["React", "FastAPI", "WebSockets", "PostgreSQL", "Redis", "Tailwind CSS", "Docker"],
        "difficulty": "advanced",
        "duration_weeks": 2,
        "intern_role": "fullstack",
        "team": [
            {"name": "Omar Hassan", "role": "CTO", "avatar": "OH", "color": "#4a154b"},
            {"name": "Yuki Tanaka", "role": "Senior Fullstack Engineer", "avatar": "YT", "color": "#00c896"},
            {"name": "You", "role": "Fullstack Intern", "avatar": "ME", "color": "#f59e0b"},
        ],
        "folder_structure": {
            "chatly": {
                "frontend": {
                    "src": {
                        "components": ["Sidebar.jsx", "ChannelView.jsx", "MessageList.jsx", "MessageInput.jsx", "ThreadPanel.jsx"],
                        "hooks": ["useWebSocket.js", "useMessages.js", "useChannels.js"],
                        "store": ["chatStore.js", "authStore.js"],
                        "App.jsx": None,
                    },
                    "package.json": None,
                },
                "backend": {
                    "app": {
                        "routers": ["channels.py", "messages.py", "auth.py", "ws.py"],
                        "models": ["channel.py", "message.py", "user.py"],
                        "services": ["chat_service.py", "ws_manager.py"],
                        "main.py": None,
                    },
                    "requirements.txt": None,
                },
                "docker-compose.yml": None,
                "README.md": None,
            }
        },
    },

    # ─── DEVOPS ───────────────────────────────────────────────────────────────
    {
        "company_name": "Cloudnest",
        "company_tagline": "Infrastructure that just works.",
        "company_color": "#ff9900",
        "company_emoji": "☁️",
        "project_title": "Set Up CI/CD & Cloud Infrastructure",
        "project_description": (
            "Cloudnest's engineering team deploys 50 times a day. You're joining the Platform Engineering "
            "team to build their next-gen CI/CD pipeline. You'll containerize 3 microservices with Docker, "
            "write GitHub Actions workflows for test/build/deploy, and provision AWS infrastructure using Terraform. "
            "By the end, every push to main will automatically test, build, and deploy to production."
        ),
        "tech_stack": ["Docker", "GitHub Actions", "Terraform", "AWS", "Kubernetes", "Prometheus", "Grafana"],
        "difficulty": "advanced",
        "duration_weeks": 2,
        "intern_role": "devops",
        "team": [
            {"name": "Carlos Mendez", "role": "VP Engineering", "avatar": "CM", "color": "#ff9900"},
            {"name": "Preet Singh", "role": "Senior DevOps Engineer", "avatar": "PS", "color": "#00c896"},
            {"name": "You", "role": "DevOps Intern", "avatar": "ME", "color": "#f59e0b"},
        ],
        "folder_structure": {
            "cloudnest-platform": {
                ".github": {
                    "workflows": ["ci.yml", "deploy.yml", "security-scan.yml"]
                },
                "terraform": {
                    "modules": {
                        "ec2": ["main.tf", "variables.tf", "outputs.tf"],
                        "rds": ["main.tf", "variables.tf"],
                        "vpc": ["main.tf", "variables.tf"],
                    },
                    "main.tf": None,
                    "variables.tf": None,
                },
                "docker": {
                    "api": ["Dockerfile", ".dockerignore"],
                    "worker": ["Dockerfile"],
                    "nginx": ["Dockerfile", "nginx.conf"],
                },
                "k8s": ["deployment.yaml", "service.yaml", "ingress.yaml", "configmap.yaml"],
                "monitoring": {
                    "prometheus": ["prometheus.yml", "alerts.yml"],
                    "grafana": ["dashboard.json"],
                },
                "docker-compose.yml": None,
                "Makefile": None,
                "README.md": None,
            }
        },
    },

    # ─── DESIGN ───────────────────────────────────────────────────────────────
    {
        "company_name": "Finova",
        "company_tagline": "Investing made simple for everyone.",
        "company_color": "#00d4aa",
        "company_emoji": "📈",
        "project_title": "Redesign the Finova Mobile Trading App",
        "project_description": (
            "Finova has 3M users but a 2.1 App Store rating because of its confusing UI. "
            "You're joining the Design team to redesign the core trading experience: "
            "the home feed, stock detail page, buy/sell flow, and portfolio view. "
            "You'll run user research, build a design system, create high-fidelity Figma prototypes, "
            "and conduct usability testing. Your designs will go directly to engineering."
        ),
        "tech_stack": ["Figma", "FigJam", "Maze (usability testing)", "Zeroheight", "Lottie"],
        "difficulty": "intermediate",
        "duration_weeks": 2,
        "intern_role": "design",
        "team": [
            {"name": "Isabelle Moreau", "role": "Head of Design", "avatar": "IM", "color": "#00d4aa"},
            {"name": "Tom Bradley", "role": "Senior Product Designer", "avatar": "TB", "color": "#5b4fff"},
            {"name": "You", "role": "Design Intern", "avatar": "ME", "color": "#f59e0b"},
            {"name": "Aisha Diallo", "role": "User Researcher", "avatar": "AD", "color": "#ec4899"},
        ],
        "folder_structure": {
            "finova-design": {
                "research": ["user-interviews.md", "personas.fig", "journey-map.fig", "competitive-analysis.md"],
                "design-system": ["colors.fig", "typography.fig", "components.fig", "icons.fig"],
                "wireframes": ["home-feed.fig", "stock-detail.fig", "buy-sell-flow.fig", "portfolio.fig"],
                "high-fidelity": ["mobile-screens.fig", "prototype-link.md"],
                "handoff": ["design-specs.md", "asset-exports", "developer-notes.md"],
                "usability-testing": ["test-plan.md", "session-notes.md", "findings.md", "iterations.fig"],
                "README.md": None,
            }
        },
    },
]


def seed():
    print("🌱 InternX Project Seeder")
    print("=" * 50)
    print(f"Seeding {len(PROJECTS)} projects...\n")

    created = 0
    for p in PROJECTS:
        try:
            db.table("projects").insert(p).execute()
            print(f"  ✓ [{p['intern_role'].upper()}] {p['company_name']} — {p['project_title']}")
            created += 1
        except Exception as e:
            print(f"  ✗ {p['company_name']}: {e}")

    print(f"\n🎉 Done! Created {created}/{len(PROJECTS)} projects.")
    print("\nProjects by role:")
    for role in ["frontend", "backend", "fullstack", "devops", "design"]:
        count = len([p for p in PROJECTS if p["intern_role"] == role])
        print(f"  {role}: {count} projects")


if __name__ == "__main__":
    seed()