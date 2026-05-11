"""
seed_recruiters.py — Run once to create recruiter accounts in the DB.
Supports seeding as many recruiters as you want.

Usage:
    cd INTERNX/backend
    python seed_recruiters.py
"""

import os, sys, hashlib, uuid
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client

SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

# ─────────────────────────────────────────────────────────────────────────────
# ✏️  ADD / EDIT RECRUITERS HERE
# Each dict = one recruiter account.
# You can add as many as you want.
# ─────────────────────────────────────────────────────────────────────────────
RECRUITERS = [
    {
        "name":     "Alice Recruiter",
        "email":    "alice@company.com",
        "password": "alice123",          # change before going live
        "company":  "TechCorp",
    },
    {
        "name":     "Bob HR",
        "email":    "bob@startup.io",
        "password": "bob123",
        "company":  "Startup IO",
    },
    # Add more here ↓
    # {
    #     "name":     "Carol Hunt",
    #     "email":    "carol@bigco.com",
    #     "password": "carol_secure_pw",
    #     "company":  "BigCo",
    # },
]

# ─────────────────────────────────────────────────────────────────────────────

print(f"\n🌱  Seeding {len(RECRUITERS)} recruiter(s)…\n")
results = []

for r in RECRUITERS:
    email    = r["email"].strip().lower()
    name     = r["name"].strip()
    password = r["password"]
    company  = r.get("company", "")

    # Check if profile already exists (by email)
    existing = db.table("profiles").select("id").eq("email", email).execute()
    if existing.data:
        uid = existing.data[0]["id"]
        print(f"  ↻  {email} already exists (id={uid}) — updating password")
    else:
        uid = str(uuid.uuid4())
        print(f"  +  Creating {email} (id={uid})")

    # Upsert profile
    db.table("profiles").upsert({
        "id":         uid,
        "email":      email,
        "name":       name,
        "role":       "recruiter",
        "company":    company,           # column may not exist yet — safe to ignore if so
    }).execute()

    # Upsert password in admin_credentials (same table used for admin)
    db.table("admin_credentials").upsert({
        "user_id":       uid,
        "password_hash": hash_pw(password),
    }).execute()

    results.append({ "email": email, "password": password, "id": uid })

print()
print("╔══════════════════════════════════════════════════════╗")
print("║  ✅  Recruiters seeded successfully!                 ║")
print("╠══════════════════════════════════════════════════════╣")
for r in results:
    print(f"║  {r['email']:<30}  pw: {r['password']:<12}  ║")
print("╠══════════════════════════════════════════════════════╣")
print("║  Login URL: /auth/recruiter-login                    ║")
print("╚══════════════════════════════════════════════════════╝")
print()
print("⚠️  Change passwords before going to production!")