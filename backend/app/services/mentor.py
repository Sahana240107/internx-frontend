"""
backend/app/services/mentor.py
Enterprise-grade AI review service — Groq API (Llama 3.3 70B)

Review layers:
  1. Security & Breach      — secrets, PII, unsafe transport, log leakage
  2. Enterprise Governance  — naming conventions, deps, boilerplate standards
  3. Maintainability Audit  — complexity, dead code, documentation, bus factor
  4. Performance & Reliability — N+1 queries, memory leaks, missing error handling

Role-specific rubrics for: frontend | backend | ui_ux | tester

internx_repo_url (from projects.internx_repo_url) is used as main-codebase context
so the AI can cross-reference the intern's PR against the actual project structure.
"""

import json
import re
import math
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import httpx
import os
from groq import Groq
from app.core.config import get_settings

settings = get_settings()

# ─── Role-Specific Rubric Weights ───────────────────────────────────────────

ROLE_RUBRICS: Dict[str, Dict[str, int]] = {
    "frontend": {
        "task_completion":         35,
        "correctness_reliability": 20,
        "code_quality":            15,
        "security_best_practices":  8,
        "testing_signals":          7,
        "performance_reliability":  8,
        "maintainability":          7,
    },
    "backend": {
        "task_completion":         30,
        "correctness_reliability": 25,
        "code_quality":            15,
        "security_best_practices": 15,
        "testing_signals":          8,
        "performance_reliability":  7,
    },
    "ui_ux": {
        "task_completion":         40,
        "correctness_reliability": 15,
        "code_quality":            20,
        "security_best_practices":  5,
        "testing_signals":          5,
        "maintainability":         15,
    },
    "tester": {
        "task_completion":         25,
        "correctness_reliability": 20,
        "code_quality":            15,
        "security_best_practices": 10,
        "testing_signals":         30,
    },
    # default fallback
    "default": {
        "task_completion":         40,
        "correctness_reliability": 25,
        "code_quality":            20,
        "security_best_practices": 10,
        "testing_signals":          5,
    },
}

# ─── Audit Category Config ───────────────────────────────────────────────────

AUDIT_CATEGORIES = ["security", "governance", "maintainability", "performance"]

AUDIT_STATUS = {
    "block":  {"emoji": "🔴", "label": "BLOCK",   "color": "#dc2626"},
    "warn":   {"emoji": "🟡", "label": "WARN",    "color": "#d97706"},
    "pass":   {"emoji": "🟢", "label": "PASS",    "color": "#16a34a"},
    "info":   {"emoji": "🔵", "label": "INFO",    "color": "#2563eb"},
}

# ─── Secret / PII Patterns (deterministic pre-scan) ─────────────────────────

SECRET_PATTERNS = [
    (r"sk-[A-Za-z0-9]{20,}", "OpenAI API Key", "critical"),
    (r"xoxb-[A-Za-z0-9\-]{20,}", "Slack Bot Token", "critical"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token", "critical"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID", "critical"),
    (r"(?i)AWS_SECRET_ACCESS_KEY\s*=\s*['\"]?[A-Za-z0-9/+=]{40}", "AWS Secret Access Key", "critical"),
    (r"(?i)(password|passwd|secret|api_key|apikey|token)\s*=\s*['\"][^'\"]{8,}['\"]", "Hardcoded Credential", "high"),
    (r"(?i)stripe[_\s]*(secret|sk)[_\s]*[=:]\s*['\"]sk_live_[A-Za-z0-9]{24}", "Stripe Secret Key", "critical"),
    (r"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*", "Bearer Token in Code", "high"),
    # PII
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "Hardcoded Email Address", "medium"),
    (r"\b(\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "Phone Number", "medium"),
    # Unsafe transport
    (r"http://(?!localhost|127\.0\.0\.1)[A-Za-z0-9\-./]+", "Unencrypted HTTP URL (should be HTTPS)", "medium"),
    # Log leakage
    (r"(?i)(console\.log|print|logger\.(info|debug|warn))\s*\(.*?(password|token|secret|api_key|request\.body)", "Sensitive Data in Logs", "high"),
]


def deterministic_security_scan(diff: str) -> List[Dict[str, Any]]:
    """
    Pattern-based pre-scan for secrets / PII / unsafe transport.
    Returns list of findings before AI is even called.
    """
    findings = []
    lines = diff.split("\n")
    for i, line in enumerate(lines, 1):
        # Only scan added lines (+) in diff
        if not line.startswith("+"):
            continue
        clean = line[1:]  # strip leading +
        for pattern, label, severity in SECRET_PATTERNS:
            if re.search(pattern, clean):
                findings.append({
                    "severity": severity,
                    "category": "security",
                    "label": label,
                    "line": i,
                    "snippet": clean[:120].strip(),
                    "fix": _secret_fix_hint(label),
                })
                break  # one finding per line max
    return findings


def _secret_fix_hint(label: str) -> str:
    hints = {
        "OpenAI API Key": "Move to .env file and access via os.environ.get('OPENAI_API_KEY'). Add .env to .gitignore.",
        "Slack Bot Token": "Store in environment variable. Never commit tokens to version control.",
        "GitHub Personal Access Token": "Revoke this token immediately on GitHub. Add to .env instead.",
        "AWS Access Key ID": "Rotate your AWS credentials immediately. Use IAM roles or environment variables.",
        "AWS Secret Access Key": "This is a critical breach. Rotate AWS credentials immediately.",
        "Stripe Secret Key": "Revoke on Stripe dashboard immediately. Use STRIPE_SECRET_KEY env variable.",
        "Hardcoded Credential": "Move to environment variable. Use python-dotenv or dotenv package.",
        "Bearer Token in Code": "Never hardcode bearer tokens. Load from environment at runtime.",
        "Hardcoded Email Address": "Use placeholder emails in test fixtures (e.g. test@example.com).",
        "Phone Number": "Remove real PII from code. Use placeholder data in tests.",
        "Unencrypted HTTP URL (should be HTTPS)": "Replace http:// with https:// to ensure encrypted transport.",
        "Sensitive Data in Logs": "Never log passwords, tokens, or user objects. Log only non-sensitive fields.",
    }
    return hints.get(label, "Remove sensitive data from source code and use environment variables instead.")


# ─── Role-aware complexity hints ────────────────────────────────────────────

ROLE_AUDIT_HINTS = {
    "frontend": """
Role-specific checks for FRONTEND developers:
- React: Missing useEffect cleanup functions (memory leaks from subscriptions/timers)
- React: Excessive re-renders (missing useMemo/useCallback)
- React: Direct DOM manipulation instead of state
- CSS: Inline styles that should be in CSS modules/Tailwind
- API calls: No loading/error states handled
- camelCase for variables/functions (JS convention)
- const/let only, never var
- No console.log left in production code
- Accessibility: Missing alt tags, aria-labels, keyboard navigation
- Responsive design: Hard-coded pixel values instead of relative units
""",
    "backend": """
Role-specific checks for BACKEND developers:
- N+1 query problems (loop with individual DB calls instead of bulk query)
- Missing database indexes on frequently queried columns
- Unhandled promise rejections / missing try-catch
- No input validation / missing Pydantic models
- Raw SQL string concatenation (SQL injection risk)
- Passwords not hashed (bcrypt/argon2)
- Missing rate limiting on auth endpoints
- snake_case for Python variables/functions
- Unused imports that bloat the module
- Missing environment variable checks at startup
""",
    "ui_ux": """
Role-specific checks for UI/UX developers:
- Accessibility: Missing alt tags, aria-labels, keyboard nav
- Responsive design: Hard-coded pixel values instead of relative units
- Color contrast ratios (WCAG AA minimum 4.5:1)
- Missing loading/skeleton states for async content
- Form validation UX (inline errors vs alert boxes)
- Component reusability (repeated JSX that should be a component)
- Prop drilling (should use context or state manager)
- camelCase for JS, BEM or consistent naming for CSS classes
- Missing focus states and tab order for keyboard users
- Empty states: what does the UI show when there's no data?
""",
    "tester": """
Role-specific checks for TESTERS:
- Test coverage: Are all happy paths covered?
- Edge cases: Empty arrays, null values, boundary conditions tested?
- Test isolation: Tests should not depend on each other
- Mock quality: Are external services properly mocked?
- Test naming: Should clearly describe what is being tested (given/when/then)
- No hardcoded test data that could break on different environments
- Assert specificity: Overly broad assertions that pass even when broken
- Missing negative test cases (what happens when things fail?)
- Missing teardown / cleanup after tests
- Flaky async tests: missing await or improper async handling
""",
}


# ─── Role display labels ─────────────────────────────────────────────────────

ROLE_DISPLAY = {
    "frontend": "Frontend Developer",
    "backend":  "Backend Developer",
    "ui_ux":    "UI/UX Developer",
    "tester":   "Tester / QA",
    "default":  "Software Engineer",
}

# ─── Prompt Builders ─────────────────────────────────────────────────────────

def build_requirement_audit_prompt(
    task_title: str,
    task_description: str,
    pr_diff: str,
    internx_repo_url: str = "",
) -> str:
    repo_context = (
        f"\nMAIN PROJECT CODEBASE: {internx_repo_url}\n"
        "The intern's PR should be a contribution to this project. "
        "Use this to judge whether the PR is relevant to the actual codebase.\n"
    ) if internx_repo_url else ""

    return f"""You are a senior engineering reviewer at a tech company.

TASK TITLE: {task_title}

TASK REQUIREMENTS:
{task_description}
{repo_context}
SUBMITTED PR DIFF:
```
{pr_diff[:8000]}
```

CRITICAL SCORING RULES:
- If PR implements a completely different project → completion_score MUST be 0
- Partially implemented → 1-20
- Fully implemented with minor issues → 21-40
- Do NOT give score above 0 if code is unrelated to the task

Return ONLY valid JSON (no markdown, no preamble):
{{
  "requirement_check": {{
    "core_requirements_met": true or false,
    "requirements_met": ["requirement 1"],
    "missing_requirements": ["missing 1"],
    "completion_score": 0-40
  }},
  "requirement_summary": "summary text"
}}"""


def build_quality_review_prompt(
    task_title: str,
    task_description: str,
    pr_diff: str,
    intern_role: str = "default",
    internx_repo_url: str = "",
) -> str:
    role_hints = ROLE_AUDIT_HINTS.get(intern_role, "")
    rubric = ROLE_RUBRICS.get(intern_role, ROLE_RUBRICS["default"])
    correctness_max = rubric.get("correctness_reliability", 25)
    quality_max     = rubric.get("code_quality", 20)
    security_max    = rubric.get("security_best_practices", 10)
    testing_max     = rubric.get("testing_signals", 5)

    repo_context = (
        f"\nMAIN PROJECT CODEBASE: {internx_repo_url}\n"
        "Cross-reference the PR against this project's conventions and structure.\n"
    ) if internx_repo_url else ""

    return f"""You are a senior engineering reviewer. Analyze this PR for quality.

INTERN ROLE: {intern_role.upper()} ({ROLE_DISPLAY.get(intern_role, intern_role)})
TASK TITLE: {task_title}
TASK REQUIREMENTS: {task_description[:500]}
{repo_context}{role_hints}

DIFF:
```
{pr_diff[:8000]}
```

IMPORTANT: If this code is completely unrelated to the task, all scores should be 0-5.

Evaluate with these MAX scores (role-adjusted):
1. Correctness & Reliability (0-{correctness_max})
2. Code Quality (0-{quality_max})
3. Security & Best Practices (0-{security_max})
4. Testing Signals (0-{testing_max})

Return ONLY valid JSON (no markdown):
{{
  "scores": {{
    "correctness_reliability": 0-{correctness_max},
    "code_quality": 0-{quality_max},
    "security_best_practices": 0-{security_max},
    "testing_signals": 0-{testing_max}
  }},
  "strengths": ["strength 1"],
  "blocking_issues": [
    {{
      "severity": "critical|high|medium|low",
      "file": "path/to/file",
      "line": 42,
      "issue": "Issue title",
      "why_it_matters": "Why",
      "fix": "How to fix"
    }}
  ],
  "improvements": [
    {{
      "priority": "high|medium",
      "item": "Improvement",
      "expected_outcome": "Outcome"
    }}
  ]
}}"""


def build_enterprise_audit_prompt(
    task_title: str,
    pr_diff: str,
    intern_role: str = "default",
    security_findings: List[Dict] = None,
    internx_repo_url: str = "",
) -> str:
    """
    Builds the prompt for the 4-layer enterprise audit report.
    The deterministic security findings are injected so the AI can incorporate them.
    Role-specific hints drive the governance and maintainability checks.
    internx_repo_url is included so the AI can judge whether the PR fits the project.
    """
    preknown_security = ""
    if security_findings:
        items = "\n".join(
            f"  - Line {f['line']}: [{f['severity'].upper()}] {f['label']} — {f['snippet'][:80]}"
            for f in security_findings
        )
        preknown_security = f"\nPRE-SCANNED SECURITY FINDINGS (already detected, confirm and expand):\n{items}\n"

    role_hints = ROLE_AUDIT_HINTS.get(intern_role, "")

    repo_context = (
        f"\nMAIN PROJECT CODEBASE: {internx_repo_url}\n"
        "Use this to verify the PR is contributing to the correct project and follows its conventions.\n"
    ) if internx_repo_url else ""

    # Role-specific governance rules
    governance_rules = {
        "frontend": "Enforce camelCase for JS/TS variables/functions, const/let only (no var), no console.log in production, component files PascalCase.",
        "backend":  "Enforce snake_case for Python variables/functions, PascalCase for classes, UPPER_SNAKE_CASE for constants. No unused imports.",
        "ui_ux":    "Enforce camelCase for JS, BEM or consistent naming for CSS classes, PascalCase for React components. No magic numbers in CSS.",
        "tester":   "Enforce descriptive test names (given/when/then pattern), test file naming (*spec* or *test*), proper describe/it nesting.",
        "default":  "Enforce language-appropriate naming conventions, no magic strings, consistent file naming.",
    }
    gov_rule = governance_rules.get(intern_role, governance_rules["default"])

    return f"""You are an Enterprise Code Auditor reviewing a PR for a {ROLE_DISPLAY.get(intern_role, intern_role)} intern on a real-world internship simulation platform.

INTERN ROLE: {intern_role.upper()}
TASK: {task_title}
{repo_context}{preknown_security}
GOVERNANCE RULES FOR THIS ROLE: {gov_rule}
{role_hints}

PR DIFF:
```
{pr_diff[:10000]}
```

Produce a 4-category structured audit report. Be SPECIFIC: mention actual variable names, line numbers, file paths, and function names from the diff where possible.

SECURITY: Scan for hardcoded secrets (high-entropy strings, API keys), PII (emails, phone numbers, addresses), unencrypted HTTP URLs, and sensitive data in logs. A critical secret → status must be "block".

GOVERNANCE: Check naming conventions for this role, dependency hygiene (unnecessary large packages), and boilerplate/error-handling consistency.

MAINTAINABILITY: Check cyclomatic complexity (flag functions with >5 nested conditions), missing documentation on complex logic ("bus factor"), dead code, and unresolved TODO comments.

PERFORMANCE: Check for N+1 query patterns, missing cleanup in useEffect/subscriptions, unclosed connections, and missing error handling for async operations.

For each category, assign one of: "block" (must fix before merge), "warn" (should fix), "pass" (looks good).

Return ONLY valid JSON (no markdown, no preamble):
{{
  "audit": {{
    "security": {{
      "status": "block|warn|pass",
      "summary": "One sentence status",
      "findings": [
        {{
          "severity": "critical|high|medium|low",
          "title": "Short title",
          "detail": "What exactly was found (file, line, code snippet)",
          "cwe": "CWE-798 or relevant CWE if applicable",
          "fix": "Specific fix instruction"
        }}
      ]
    }},
    "governance": {{
      "status": "block|warn|pass",
      "summary": "One sentence status",
      "findings": [
        {{
          "severity": "high|medium|low",
          "title": "Short title",
          "detail": "e.g. Variable 'userData' should be 'user_data' (snake_case) per Python convention",
          "fix": "Specific fix instruction"
        }}
      ]
    }},
    "maintainability": {{
      "status": "block|warn|pass",
      "summary": "One sentence status",
      "findings": [
        {{
          "severity": "high|medium|low",
          "title": "Short title",
          "detail": "e.g. Function handleSubmit() is 120 lines with 7 nested conditionals. Cyclomatic complexity: ~12",
          "fix": "Specific fix instruction"
        }}
      ]
    }},
    "performance": {{
      "status": "block|warn|pass",
      "summary": "One sentence status",
      "findings": [
        {{
          "severity": "high|medium|low",
          "title": "Short title",
          "detail": "e.g. DB query inside for-loop on line 45 — N+1 problem. Will cause 100 queries for 100 users.",
          "fix": "Specific fix instruction"
        }}
      ]
    }}
  }}
}}"""


# ─── GitHub Fetcher ──────────────────────────────────────────────────────────

def fetch_pr_diff_from_github(pr_url: str) -> Optional[str]:
    try:
        diff_url = pr_url.rstrip("/") + ".diff"
        response = httpx.get(
            diff_url,
            timeout=20,
            follow_redirects=True,
            headers={"Accept": "text/plain"},
        )
        if response.status_code == 200:
            text = response.text
            return text if text and len(text.strip()) >= 10 else None
        print(f"[REVIEW] GitHub returned {response.status_code} for {diff_url}")
        return None
    except Exception as e:
        print(f"[REVIEW] Error fetching PR diff: {e}")
        return None


# ─── Precheck ────────────────────────────────────────────────────────────────

def precheck_diff(pr_diff: str, task_keywords: list) -> Dict[str, Any]:
    if not pr_diff or len(pr_diff.strip()) < 10:
        return {"is_valid": False, "caps": {}, "reason": "Diff is empty or too small."}
    if len(pr_diff) > 50000:
        return {"is_valid": True, "caps": {"task_completion": 30}, "reason": "Very large diff; task completion capped at 30."}

    diff_lower = pr_diff.lower()
    keyword_matches = sum(1 for kw in task_keywords if kw.lower() in diff_lower)
    if len(task_keywords) > 0 and keyword_matches == 0:
        return {"is_valid": True, "caps": {"overall": 20}, "reason": "Diff does not appear to match the task. Score hard-capped at 20."}

    return {"is_valid": True, "caps": {}, "reason": "OK"}


# ─── Groq Caller ─────────────────────────────────────────────────────────────

def _run_groq_review(prompt: str, max_tokens: int = 2000) -> Dict[str, Any]:
    response_text = ""
    try:
        api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
        if not api_key:
            print("[GROQ] ❌ GROQ_API_KEY not set")
            return {}

        client = Groq(api_key=api_key)
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.2,
        )
        response_text = message.choices[0].message.content.strip()

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        return json.loads(cleaned)

    except json.JSONDecodeError as e:
        print(f"[GROQ] ❌ JSON parse error: {e} | Response: {response_text[:200]}")
        return {}
    except Exception as e:
        print(f"[GROQ] ❌ Error: {e}")
        return {}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _clamp(value, min_val: int, max_val: int) -> int:
    return max(min_val, min(max_val, int(value or 0)))


def _merge_reviews(
    req_data: Dict[str, Any],
    qual_data: Dict[str, Any],
    precheck_caps: Dict[str, int],
    intern_role: str = "default",
) -> Dict[str, Any]:
    rubric = ROLE_RUBRICS.get(intern_role, ROLE_RUBRICS["default"])
    req_check   = req_data.get("requirement_check", {})
    qual_scores = qual_data.get("scores", {})

    breakdown = {k: _clamp(0, 0, v) for k, v in rubric.items()}
    breakdown["task_completion"] = _clamp(
        req_check.get("completion_score", 0), 0, rubric.get("task_completion", 40)
    )
    for k in ["correctness_reliability", "code_quality", "security_best_practices", "testing_signals"]:
        if k in rubric:
            breakdown[k] = _clamp(qual_scores.get(k, 0), 0, rubric[k])

    # Apply precheck caps
    if "overall" in precheck_caps:
        raw_total = sum(breakdown.values())
        if raw_total > 0:
            scale = precheck_caps["overall"] / raw_total
            breakdown = {k: int(v * scale) for k, v in breakdown.items()}
        else:
            breakdown = {k: 0 for k in breakdown}
    for k, cap_val in precheck_caps.items():
        if k != "overall" and k in breakdown:
            breakdown[k] = min(breakdown[k], cap_val)

    return {
        "score":               sum(breakdown.values()),
        "breakdown":           breakdown,
        "strengths":           qual_data.get("strengths", []),
        "blocking_issues":     qual_data.get("blocking_issues", []),
        "missing_requirements": req_check.get("missing_requirements", []),
        "improvements":        qual_data.get("improvements", []),
        "review_summary":      req_data.get("requirement_summary", "Review complete"),
    }


def _compute_confidence(merged: Dict[str, Any]) -> float:
    confidence = 0.85
    blocking = merged.get("blocking_issues", [])
    if len(blocking) > 5:       confidence -= 0.1
    if any(b.get("severity") == "critical" for b in blocking): confidence -= 0.05
    if len(merged.get("missing_requirements", [])) > 3:        confidence -= 0.1
    return max(0.5, min(1.0, round(confidence, 2)))


def _build_next_steps(verdict: str, blocking_issues: list, audit: Dict = None) -> list:
    if verdict == "pass" and not (audit and any(
        a["status"] == "block" for a in audit.values() if isinstance(a, dict)
    )):
        return [
            "Great job! Your code meets all requirements.",
            "Consider the suggested improvements in future tasks.",
            "Mark this task as complete.",
        ]
    steps = []
    critical = [b for b in blocking_issues if b.get("severity") == "critical"]
    if critical:
        steps.append(f"Fix {len(critical)} critical issue(s) first — these are blocking your pass.")
    if audit:
        blocked_cats = [cat for cat, data in audit.items() if isinstance(data, dict) and data.get("status") == "block"]
        if blocked_cats:
            steps.append(f"Resolve BLOCKED audit categories: {', '.join(blocked_cats)}.")
    steps.extend([
        "Review all blocking issues and implement the suggested fixes.",
        "Re-test your changes thoroughly before resubmitting.",
        "Run `internx pr` to resubmit your PR for review.",
    ])
    return steps


def _build_error_review(task_id: str, error_msg: str, intern_role: str = "default") -> Dict[str, Any]:
    rubric = ROLE_RUBRICS.get(intern_role, ROLE_RUBRICS["default"])
    return {
        "version":    "2.0",
        "task_id":    task_id,
        "intern_role": intern_role,
        "verdict":    "resubmit",
        "score":      0,
        "confidence": 0.5,
        "breakdown":  {k: 0 for k in rubric},
        "strengths":  [],
        "blocking_issues": [{
            "severity":       "critical",
            "issue":          "Could not review PR",
            "why_it_matters": error_msg,
            "fix":            "Verify your GitHub PR URL is correct and the repository is public.",
        }],
        "missing_requirements": ["PR could not be processed"],
        "improvements": [],
        "review_summary": error_msg,
        "next_steps": [
            "Check your GitHub PR URL is correct",
            "Ensure the repository is public",
            "Try submitting again",
        ],
        "audit_report": {
            cat: {"status": "warn", "summary": "Could not audit — PR fetch failed.", "findings": []}
            for cat in AUDIT_CATEGORIES
        },
        "security_block": False,
    }

# ─── UI/UX Design Review ─────────────────────────────────────────────────────
 
DESIGN_RUBRIC = {
    "task_completion":          40,
    "visual_design_quality":    20,
    "accessibility_compliance": 15,
    "handoff_completeness":     15,
    "responsiveness":           10,
}
 
HANDOFF_CHECKLIST_LABELS = {
    "spacing":       "Spacing & layout documented",
    "colors":        "Color tokens / palette defined",
    "typography":    "Typography scale specified",
    "components":    "Component states covered (hover, active, disabled)",
    "assets":        "Assets exported at correct resolutions",
    "accessibility": "Accessibility annotations present",
    "responsive":    "Responsive breakpoints defined",
    "interactions":  "Interactions / animations specified",
}
 
 
def build_design_review_prompt(
    task_title: str,
    task_description: str,
    figma_url: str,
    explanation: str,
    handoff_checklist: dict,
    internx_repo_url: str = "",
    has_image: bool = False,
) -> str:
    checklist_lines = "\n".join(
        f"  {'✅' if v else '❌'} {HANDOFF_CHECKLIST_LABELS.get(k, k)}"
        for k, v in (handoff_checklist or {}).items()
    ) or "  (no checklist submitted)"
 
    figma_section = f"FIGMA URL: {figma_url}" if figma_url else "FIGMA URL: (not provided)"
    image_section = "SCREENSHOT/EXPORT: Provided (see image in prompt)" if has_image else "SCREENSHOT/EXPORT: Not provided"
    repo_section  = f"\nMAIN PROJECT CODEBASE: {internx_repo_url}\nJudge whether the design fits the project's tech stack and existing components." if internx_repo_url else ""
 
    return f"""You are a senior UI/UX design mentor reviewing an intern's design submission for a real-world internship simulation platform.
 
TASK TITLE: {task_title}
 
TASK REQUIREMENTS:
{task_description}
{repo_section}
 
SUBMISSION:
{figma_section}
{image_section}
 
INTERN'S EXPLANATION:
{explanation or "(no explanation provided)"}
 
HANDOFF CHECKLIST COMPLETED BY INTERN:
{checklist_lines}
 
SCORING RUBRIC (max points per category):
1. Task Completion (0–40): Does the design address all requirements? If completely off-task → 0.
2. Visual Design Quality (0–20): Hierarchy, contrast, consistency, overall aesthetics.
3. Accessibility Compliance (0–15): Color contrast, text sizing, keyboard/screen-reader considerations, WCAG AA signals.
4. Handoff Completeness (0–15): Are specs, tokens, and states documented clearly for a developer?
5. Responsiveness (0–10): Are mobile and tablet breakpoints addressed?
 
IMPORTANT SCORING RULES:
- If Figma URL is missing AND no screenshot provided AND explanation is vague → task_completion = 0–5 only.
- If handoff checklist is mostly unchecked → handoff_completeness = 0–5.
- If the submission is clearly for a completely different project → all scores 0–5.
 
Evaluate as if you are a real senior UX reviewer at a tech company.
 
Return ONLY valid JSON (no markdown, no preamble):
{{
  "scores": {{
    "task_completion":          0-40,
    "visual_design_quality":    0-20,
    "accessibility_compliance": 0-15,
    "handoff_completeness":     0-15,
    "responsiveness":           0-10
  }},
  "strengths": ["strength 1", "strength 2"],
  "blocking_issues": [
    {{
      "severity": "critical|high|medium|low",
      "issue": "Issue title",
      "why_it_matters": "Why this matters for the product",
      "fix": "Concrete fix instruction"
    }}
  ],
  "improvements": [
    {{
      "priority": "high|medium",
      "item": "Improvement",
      "expected_outcome": "Outcome"
    }}
  ],
  "review_summary": "2–3 sentence professional summary of the design submission",
  "missing_requirements": ["requirement not addressed"]
}}"""
 
 
def review_design_professional(
    task_id: str,
    task_title: str,
    task_description: str,
    figma_url: str,
    explanation: str,
    handoff_checklist: dict,
    image_base64: str | None,
    image_mime: str,
    internx_repo_url: str = "",
) -> dict:
    """
    Full design review for UI/UX role.
    Uses vision model turn if image is attached (falls back to text-only if image absent).
    Vision model: meta-llama/llama-4-scout-17b-16e-instruct (replaces decommissioned llama-3.2-11b-vision-preview)
    """
    print(f"[DESIGN_REVIEW] Starting — task={task_title}")
 
    has_image = bool(image_base64 and image_base64.strip())
 
    # Build text prompt
    prompt = build_design_review_prompt(
        task_title=task_title,
        task_description=task_description,
        figma_url=figma_url,
        explanation=explanation,
        handoff_checklist=handoff_checklist,
        internx_repo_url=internx_repo_url,
        has_image=has_image,
    )
 
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
    review_data = {}
 
    try:
        client = Groq(api_key=api_key)
 
        if has_image:
            # Vision model: meta-llama/llama-4-scout-17b-16e-instruct
            # (llama-3.2-11b-vision-preview was decommissioned April 2025)
            message_content = [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_mime};base64,{image_base64}"
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
            model = "meta-llama/llama-4-scout-17b-16e-instruct"
        else:
            message_content = prompt
            model = "llama-3.3-70b-versatile"
 
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": message_content}],
            max_tokens=2500,
            temperature=0.2,
        )
        response_text = response.choices[0].message.content.strip()
        cleaned = response_text
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned).strip()
        review_data = json.loads(cleaned)
        print(f"[DESIGN_REVIEW] ✓ AI review parsed (model: {model})")
 
    except json.JSONDecodeError as e:
        print(f"[DESIGN_REVIEW] JSON parse error: {e}")
        review_data = {}
    except Exception as e:
        print(f"[DESIGN_REVIEW] Error: {e}")
        return _build_error_review(task_id, f"Design review AI failed: {str(e)}", "ui_ux")
 
    if not review_data:
        return _build_error_review(task_id, "AI review returned no data. Please try again.", "ui_ux")
 
    raw_scores = review_data.get("scores", {})
    breakdown = {
        k: _clamp(raw_scores.get(k, 0), 0, v)
        for k, v in DESIGN_RUBRIC.items()
    }
    total = sum(breakdown.values())
 
    # Penalty: missing Figma + no image → cap at 30
    if not figma_url and not has_image:
        scale = min(1.0, 30 / max(total, 1))
        breakdown = {k: int(v * scale) for k, v in breakdown.items()}
        total = sum(breakdown.values())
 
    blocking_issues = review_data.get("blocking_issues", [])
    critical_blocks  = [b for b in blocking_issues if b.get("severity") == "critical"]
    verdict = "pass" if total >= 70 and not critical_blocks else "resubmit"
 
    return {
        "version":              "2.0",
        "task_id":              task_id,
        "intern_role":          "ui_ux",
        "role_display":         "UI/UX Developer",
        "submission_type":      "design",
        "verdict":              verdict,
        "score":                total,
        "confidence":           _compute_confidence({"blocking_issues": blocking_issues, "missing_requirements": review_data.get("missing_requirements", [])}),
        "breakdown":            breakdown,
        "rubric_maxes":         DESIGN_RUBRIC,
        "strengths":            review_data.get("strengths", []),
        "blocking_issues":      blocking_issues,
        "missing_requirements": review_data.get("missing_requirements", []),
        "improvements":         review_data.get("improvements", []),
        "review_summary":       review_data.get("review_summary", "Design review complete."),
        "next_steps":           _build_next_steps(verdict, blocking_issues),
        "audit_report":         None,
        "security_block":       False,
        "figma_url":            figma_url or None,
    }
 
 
# ─── QA / Tester Review ──────────────────────────────────────────────────────
 
QA_RUBRIC = {
    "task_completion":         25,
    "correctness_reliability": 20,
    "code_quality":            15,
    "security_best_practices": 10,
    "testing_signals":         30,
}
def build_bug_report_prompt(
    task_title: str,
    task_description: str,
    request,
    internx_repo_url: str = "",
) -> str:
    repo_ctx = f"\nPROJECT CODEBASE: {internx_repo_url}\n" if internx_repo_url else ""

    return f"""You are a senior QA mentor reviewing an intern's bug report on a real-world
internship simulation platform called InternX.

PROJECT CONTEXT: {task_title}
{repo_ctx}
BUG REPORT SUBMITTED:
Title       : {request.bug_title or '(none)'}
Severity    : {request.bug_severity or '(not specified)'}
Environment : {request.bug_environment or '(not specified)'}
Steps to Reproduce:
{request.bug_steps or '(none provided)'}
Expected Behavior : {request.bug_expected or '(none)'}
Actual Behavior   : {request.bug_actual or '(none)'}

═══════════════════════════════════════════════════════════
IMPORTANT RULE — TASK RELEVANCE DOES NOT MATTER FOR BUG REPORTS
═══════════════════════════════════════════════════════════
A tester's job is to find ANY real bug in the application, not just bugs
related to the current task. A login bug, a payment bug, a UI glitch —
all are valid and valuable regardless of what task the tester was assigned.

Score this bug report purely on:
  - Is the bug LOGICAL and PLAUSIBLE in a real web application?
  - Is it WELL DOCUMENTED with clear steps, expected vs actual behaviour?
  - Is it SPECIFIC enough for a developer to reproduce and fix?

DO NOT penalise for being unrelated to the task title.

═══════════════════════════════════════════════════════════
SCORING RUBRIC
═══════════════════════════════════════════════════════════
1. Bug Credibility          (0–25): Is this a plausible, logical bug in a real app?
                                    Not related to task relevance — only to whether
                                    the bug makes sense technically.
                                    Vague/impossible bugs → 0–5.
                                    Clear, realistic bugs → 20–25.

2. Reproducibility          (0–20): Are the steps clear enough to reproduce?
                                    Can a developer follow them exactly?

3. Report Quality           (0–15): Clarity, precision, professionalism.
                                    Good title? Correct severity? Environment specified?

4. Security Awareness       (0–10): Severity correctly assessed? No PII in report?
                                    Security-relevant bugs (auth, data exposure)
                                    flagged appropriately?

5. Testing Depth            (0–30): Root cause hypothesised? Edge cases mentioned?
                                    Impact scope described? Workaround noted?

═══════════════════════════════════════════════════════════
TICKETING DECISION
═══════════════════════════════════════════════════════════
is_ticketable: true if the bug is credible and actionable. false if vague,
               impossible, or clearly fabricated.

ticket_priority: Map from severity (critical→critical, high→high, etc.).
                 Downgrade one level if steps are incomplete.

affected_roles: Which intern roles are most likely responsible for this bug?
  - UI rendering / component / CSS bugs     → ["frontend"]
  - API / auth / database / server bugs     → ["backend"]
  - Layout / design / accessibility bugs    → ["ui_ux", "frontend"]
  - Test infrastructure bugs                → ["tester"]
  - Full-stack (data flow end-to-end)       → ["frontend", "backend"]

ticket_title       : Concise professional title (max 80 chars).
ticket_description : Markdown with ## Summary, ## Steps to Reproduce,
                     ## Expected vs Actual, ## Environment, ## Suggested Fix.

═══════════════════════════════════════════════════════════
CRITICAL — JSON KEY NAMES MUST MATCH EXACTLY (copy these verbatim):
  "task_completion"         → Bug Credibility score (0–25)
  "correctness_reliability" → Reproducibility score (0–20)
  "code_quality"            → Report Quality score (0–15)
  "security_best_practices" → Security Awareness score (0–10)
  "testing_signals"         → Testing Depth score (0–30)

Return ONLY valid JSON — no markdown fences, no preamble:
{{
  "scores": {{
    "task_completion": 0-25,
    "correctness_reliability": 0-20,
    "code_quality": 0-15,
    "security_best_practices": 0-10,
    "testing_signals": 0-30
  }},
  "strengths": ["strength"],
  "blocking_issues": [
    {{
      "severity": "critical|high|medium|low",
      "issue": "Issue title",
      "why_it_matters": "Why",
      "fix": "Fix instruction"
    }}
  ],
  "improvements": [{{"priority": "high|medium", "item": "...", "expected_outcome": "..."}}],
  "review_summary": "2–3 sentence summary — mention if this is a cross-task bug find",
  "missing_requirements": [],
  "is_ticketable": true,
  "ticket_priority": "critical|high|medium|low",
  "affected_roles": ["frontend"],
  "ticket_title": "Short ticket title",
  "ticket_description": "## Summary\\n..."
}}"""

def create_ticket_from_bug_report(
    supabase,
    *,
    task_id: str,
    project_id: str,
    group_id: Optional[str],        # tester's group — becomes from_group_id
    created_by: str,                 # tester's user_id
    ticket_title: str,
    ticket_description: str,
    ticket_priority: str,
    affected_roles: List[str],
    bug_severity: Optional[str],
) -> Dict[str, Any]:
    """
    1. Insert a row into `tickets`.
    2. Find all group_members whose intern_role is in affected_roles
       (scoped to the same project via project_groups).
    3. Insert a `notifications` row for each affected member.
 
    Returns {"ticket_id": str, "notified_users": [str], "error": str|None}
    """
    print(f"[TICKET] Creating ticket: {ticket_title!r} | roles={affected_roles}")
 
    # ── Map bug_severity → ticket type ───────────────────────────────────────
    severity_to_type = {
        "critical": "bug",
        "high":     "bug",
        "medium":   "bug",
        "low":      "improvement",
    }
    ticket_type = severity_to_type.get(bug_severity or "medium", "bug")
 
    # ── 1. Insert ticket ──────────────────────────────────────────────────────
    try:
        ticket_insert = supabase.table("tickets").insert({
            "title":           ticket_title[:255],
            "description":     ticket_description,
            "type":            ticket_type,
            "priority":        ticket_priority,
            "status":          "open",
            "project_id":      project_id,
            "from_group_id":   group_id,        # tester's group
            "to_group_id":     None,             # resolved below if possible
            "created_by":      created_by,
            "created_at":      datetime.now(timezone.utc).isoformat(),
            "updated_at":      datetime.now(timezone.utc).isoformat(),
        }).execute()
 
        if not ticket_insert.data:
            print("[TICKET] ❌ Insert returned no data")
            return {"ticket_id": None, "notified_users": [], "error": "Ticket insert failed"}
 
        ticket_id = ticket_insert.data[0]["id"]
        print(f"[TICKET] ✓ Ticket created: {ticket_id}")
 
    except Exception as e:
        print(f"[TICKET] ❌ Insert error: {e}")
        return {"ticket_id": None, "notified_users": [], "error": str(e)}
 
    # ── 2. Find affected group members ────────────────────────────────────────
    notified_users: List[str] = []
    try:
        # Get all groups in this project
        groups_result = supabase.table("project_groups") \
            .select("id") \
            .eq("project_id", project_id) \
            .execute()
        group_ids = [g["id"] for g in (groups_result.data or [])]
 
        if group_ids:
            members_result = supabase.table("group_members") \
                .select("user_id, intern_role, group_id") \
                .in_("group_id", group_ids) \
                .in_("intern_role", affected_roles) \
                .execute()
 
            members = members_result.data or []
            print(f"[TICKET] Found {len(members)} affected member(s)")
 
            # Pick the first matching group as to_group_id (best-effort)
            to_group_id = None
            if members:
                to_group_id = members[0].get("group_id")
                # Update ticket with to_group_id
                supabase.table("tickets").update(
                    {"to_group_id": to_group_id}
                ).eq("id", ticket_id).execute()
 
            # ── 3. Fire notifications ─────────────────────────────────────────
            role_emoji = {
                "frontend": "🖥️",
                "backend":  "⚙️",
                "ui_ux":    "🎨",
                "tester":   "🧪",
            }
            roles_label = " & ".join(
                r.replace("_", "/").title() for r in affected_roles
            )
            affected_emoji = role_emoji.get(affected_roles[0], "🐛") if affected_roles else "🐛"
 
            notifications = []
            seen_users = set()
            for member in members:
                uid = member["user_id"]
                if uid in seen_users:
                    continue          # skip duplicates and the reporter
                seen_users.add(uid)
                notifications.append({
                    "user_id":    uid,
                    "key":        f"ticket:{ticket_id}",
                    "type":       "ticket",
                    "title":      f"{affected_emoji} New Bug Ticket: {ticket_title[:60]}",
                    "body":       (
                        f"A {ticket_priority}-priority bug has been raised by QA "
                        f"that affects your role ({roles_label}). "
                        f"Priority: {ticket_priority.upper()}."
                    ),
                    "icon":       "🐛",
                    "href":       f"/dashboard/tickets/{ticket_id}",
                    "count":      1,
                    "is_read":    False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                notified_users.append(uid)
 
            if notifications:
                supabase.table("notifications").insert(notifications).execute()
                print(f"[TICKET] ✓ Notified {len(notifications)} user(s)")
 
    except Exception as e:
        print(f"[TICKET] ⚠️  Notification error (ticket still created): {e}")
 
    return {
        "ticket_id":      ticket_id,
        "notified_users": notified_users,
        "error":          None,
    }
 
def build_test_plan_prompt(
    task_title: str,
    task_description: str,
    request,
    internx_repo_url: str = "",
) -> str:
    repo_ctx = f"\nPROJECT CODEBASE: {internx_repo_url}\n" if internx_repo_url else ""

    return f"""You are a senior QA mentor reviewing an intern's test plan submission.

TASK TITLE: {task_title}
TASK REQUIREMENTS: {task_description}
{repo_ctx}
TEST PLAN SUBMITTED:
Scope          : {request.test_plan_scope or '(not defined)'}
Coverage Areas : {request.test_coverage_areas or '(not specified)'}
Test Cases:
{request.test_cases or '(none provided)'}

═══════════════════════════════════════════════════════════
IMPORTANT RULE — TASK RELEVANCE IS MANDATORY FOR TEST PLANS
═══════════════════════════════════════════════════════════
Unlike bug reports (which can cover any part of the app), a test plan
MUST be written specifically for the assigned task. Test cases that test
unrelated features should be flagged as missing the point entirely.

If the test plan scope does not match the task requirements → task_completion = 0–10.
If test cases test completely different functionality → task_completion = 0.

═══════════════════════════════════════════════════════════
SCORING RUBRIC
═══════════════════════════════════════════════════════════
1. Task Completion          (0–25): Do the test cases directly cover the
                                    requirements of THIS specific task?
                                    Off-task test plans score 0–5 here.

2. Correctness & Reliability(0–20): Are test cases correct and executable?
                                    Would they actually catch real bugs in the task?

3. Report Quality           (0–15): Structure, naming, given/when/then format,
                                    readability, professional presentation.

4. Security Best Practices  (0–10): Are security-relevant flows tested?
                                    No hardcoded PII in test data?

5. Testing Signals          (0–30): Coverage breadth for THIS task —
                                    happy paths, edge cases, negative cases,
                                    boundary conditions, error states.
                                    A plan with only happy paths scores 0–10 here.

═══════════════════════════════════════════════════════════
Return ONLY valid JSON (no markdown):
{{
  "scores": {{
    "task_completion": 0-25,
    "correctness_reliability": 0-20,
    "code_quality": 0-15,
    "security_best_practices": 0-10,
    "testing_signals": 0-30
  }},
  "strengths": ["strength"],
  "blocking_issues": [
    {{
      "severity": "critical|high|medium|low",
      "issue": "Issue",
      "why_it_matters": "Why",
      "fix": "Fix"
    }}
  ],
  "improvements": [{{"priority": "high|medium", "item": "...", "expected_outcome": "..."}}],
  "review_summary": "2–3 sentence summary — explicitly mention if test plan is off-task",
  "missing_requirements": ["task requirement not covered by any test case"]
}}""" 
QA_RUBRIC = {
    "task_completion":         25,
    "correctness_reliability": 20,
    "code_quality":            15,
    "security_best_practices": 10,
    "testing_signals":         30,
}
 
def review_qa_professional(
    task_id: str,
    task_title: str,
    task_description: str,
    submission_type: str,
    request,
    internx_repo_url: str = "",
) -> dict:
    """
    QA/Tester role review.
    - bug_report    → structured bug report scoring + ticketing decision
    - test_plan     → test plan quality scoring
    - automation_pr → delegates to standard PR review with tester rubric
    """
    print(f"[QA_REVIEW] type={submission_type}")

    # ── Automation PR: reuse PR pipeline ─────────────────────────────────────
    if submission_type == "automation_pr":
        framework_note = (
            f" (framework: {request.automation_framework})"
            if request.automation_framework else ""
        )
        print(f"[QA_REVIEW] Delegating automation PR to standard review{framework_note}")
        return review_pr_professional(
            task_id=task_id,
            pr_url=request.pr_url,
            task_description=task_description,
            task_title=task_title,
            intern_role="tester",
            internx_repo_url=internx_repo_url,
        )

    # ── Build prompt ──────────────────────────────────────────────────────────
    if submission_type == "bug_report":
        prompt = build_bug_report_prompt(
            task_title, task_description, request, internx_repo_url
        )
    else:
        prompt = build_test_plan_prompt(
            task_title, task_description, request, internx_repo_url
        )

    print(f"[QA_REVIEW] Calling Groq...")
    review_data = _run_groq_review(prompt, max_tokens=2500)
    print(f"[QA_REVIEW] Raw scores from AI: {review_data.get('scores', 'MISSING')}")  # debug
    print(f"[QA_REVIEW] Groq returned: {bool(review_data)}")

    if not review_data:
        return _build_error_review(
            task_id, "QA review AI returned no data. Please try again.", "tester"
        )

    raw_scores = review_data.get("scores", {})
    breakdown = {
        k: _clamp(raw_scores.get(k, 0), 0, v) for k, v in QA_RUBRIC.items()
    }
    total = sum(breakdown.values())
    print(f"[QA_REVIEW] Score: {total} | breakdown: {breakdown}")

    blocking_issues = review_data.get("blocking_issues", [])
    critical_blocks = [b for b in blocking_issues if b.get("severity") == "critical"]
    verdict = "pass" if total >= 70 and not critical_blocks else "resubmit"

    # ── Ticket meta (bug_report only) ─────────────────────────────────────────
    ticket_meta = None
    if submission_type == "bug_report":
        is_ticketable = review_data.get("is_ticketable", False)
        print(f"[QA_REVIEW] is_ticketable={is_ticketable} | scores: testing={breakdown.get('testing_signals')} correctness={breakdown.get('correctness_reliability')} total={total}")
        score_credible = (
            breakdown.get("testing_signals", 0) >= 12
            or breakdown.get("correctness_reliability", 0) >= 12
            or total >= 45
        )
        if is_ticketable and score_credible:
            ticket_meta = {
                "is_ticketable":      True,
                "ticket_priority":    review_data.get("ticket_priority", "medium"),
                "affected_roles":     review_data.get("affected_roles", ["frontend", "backend"]),
                "ticket_title":       review_data.get("ticket_title", request.bug_title or task_title),
                "ticket_description": review_data.get(
                    "ticket_description",
                    f"## Summary\n{request.bug_title}\n\n"
                    f"## Steps to Reproduce\n{request.bug_steps or 'N/A'}\n\n"
                    f"## Expected vs Actual\n"
                    f"**Expected:** {request.bug_expected or 'N/A'}\n"
                    f"**Actual:** {request.bug_actual or 'N/A'}\n\n"
                    f"## Environment\n{request.bug_environment or 'N/A'}",
                ),
            }
            print(f"[QA_REVIEW] ✓ Ticket meta built: {ticket_meta['ticket_title']}")
        else:
            ticket_meta = {"is_ticketable": False}
            print(f"[QA_REVIEW] ✗ Not ticketable — is_ticketable={is_ticketable} score_credible={score_credible}")

    return {
        "version":              "2.0",
        "task_id":              task_id,
        "intern_role":          "tester",
        "role_display":         "Tester / QA",
        "submission_type":      submission_type,
        "verdict":              verdict,
        "score":                total,
        "confidence":           _compute_confidence({
            "blocking_issues":      blocking_issues,
            "missing_requirements": review_data.get("missing_requirements", []),
        }),
        "breakdown":            breakdown,
        "rubric_maxes":         QA_RUBRIC,
        "strengths":            review_data.get("strengths", []),
        "blocking_issues":      blocking_issues,
        "missing_requirements": review_data.get("missing_requirements", []),
        "improvements":         review_data.get("improvements", []),
        "review_summary":       review_data.get("review_summary", "QA review complete."),
        "next_steps":           _build_next_steps(verdict, blocking_issues),
        "audit_report":         None,
        "security_block":       False,
        "ticket_meta":          ticket_meta,
    } 
# ─── Main Review Function ────────────────────────────────────────────────────

def review_pr_professional(
    task_id: str,
    pr_url: str,
    task_description: str,
    task_title: str,
    intern_role: str = "default",
    internx_repo_url: str = "",
) -> Dict[str, Any]:
    """
    Full enterprise-grade review with 4 audit layers.

    intern_role is read from tasks.intern_role (NOT from review_attempts — that column
    does not exist in the schema). For dev/test overrides, the router passes the
    override_role from the request before calling this function.

    internx_repo_url comes from projects.internx_repo_url and is injected into all
    AI prompts so the reviewer can cross-reference the PR against the actual codebase.

    Returns a structured result including:
    - verdict / score / breakdown (role-adjusted rubric)
    - audit_report with security / governance / maintainability / performance
    - security_block flag (True if secrets found → deployment halted)
    - strengths / blocking_issues / improvements / next_steps
    - intern_role so the frontend can render role-specific rubric labels
    """
    print(f"[REVIEW] Starting review — role={intern_role}, task={task_title}")
    if internx_repo_url:
        print(f"[REVIEW] Main codebase context: {internx_repo_url}")

    # ── 1. Fetch PR diff ────────────────────────────────────────────────────
    print(f"[REVIEW] Fetching PR diff from {pr_url}...")
    pr_diff = fetch_pr_diff_from_github(pr_url)
    if not pr_diff:
        return _build_error_review(task_id, "Could not fetch PR from GitHub. Check the link is correct and the repo is public.", intern_role)
    print(f"[REVIEW] ✓ Fetched {len(pr_diff)} chars")

    # ── 2. Deterministic security pre-scan ─────────────────────────────────
    print("[REVIEW] Running deterministic security scan...")
    security_findings = deterministic_security_scan(pr_diff)
    has_critical_secret = any(f["severity"] == "critical" for f in security_findings)
    if has_critical_secret:
        print(f"[REVIEW] 🚨 CRITICAL secrets found — {len(security_findings)} findings")

    # ── 3. Precheck diff ────────────────────────────────────────────────────
    stop_words = {"the", "a", "an", "and", "or", "in", "on", "for", "to", "of", "with", "that", "this", "is", "are"}
    task_keywords = [w for w in (task_description or "").split()[:40] if len(w) > 3 and w.lower() not in stop_words]
    precheck = precheck_diff(pr_diff, task_keywords)
    if not precheck["is_valid"]:
        return _build_error_review(task_id, precheck["reason"], intern_role)
    print(f"[REVIEW] ✓ Precheck passed — caps: {precheck['caps']}")

    # ── 4. Run AI review passes ─────────────────────────────────────────────
    print("[REVIEW] Running requirement audit...")
    req_review = _run_groq_review(
        build_requirement_audit_prompt(task_title, task_description, pr_diff, internx_repo_url)
    )

    print("[REVIEW] Running quality review...")
    qual_review = _run_groq_review(
        build_quality_review_prompt(task_title, task_description, pr_diff, intern_role, internx_repo_url),
        max_tokens=2500,
    )

    print("[REVIEW] Running enterprise audit (4-layer)...")
    audit_raw = _run_groq_review(
        build_enterprise_audit_prompt(task_title, pr_diff, intern_role, security_findings, internx_repo_url),
        max_tokens=3000,
    )

    if not req_review or not qual_review:
        return _build_error_review(task_id, "AI review failed. Please try again.", intern_role)

    # ── 5. Build audit report ───────────────────────────────────────────────
    audit_report = _build_audit_report(audit_raw, security_findings, has_critical_secret)

    # ── 6. Merge scoring ────────────────────────────────────────────────────
    merged = _merge_reviews(req_review, qual_review, precheck.get("caps", {}), intern_role)

    # ── 7. Security override: critical secrets always block ────────────────
    if has_critical_secret:
        merged["score"] = min(merged["score"], 30)
        for sf in security_findings:
            if sf["severity"] == "critical":
                merged["blocking_issues"].insert(0, {
                    "severity":       "critical",
                    "category":       "security",
                    "file":           f"diff line {sf['line']}",
                    "line":           sf["line"],
                    "issue":          f"🔴 SECURITY INCIDENT: {sf['label']}",
                    "why_it_matters": "Committing secrets to a repository is a critical security incident. Anyone with repo access can use this credential to compromise production systems.",
                    "fix":            sf["fix"],
                })

    # ── 8. Verdict ─────────────────────────────────────────────────────────
    security_blocked = has_critical_secret
    critical_blocking = [b for b in merged["blocking_issues"] if b.get("severity") == "critical"]
    verdict = "pass" if (merged["score"] >= 70 and not critical_blocking) else "resubmit"
    # ── 9. Final result ─────────────────────────────────────────────────────
    final = {
        "version":             "2.0",
        "task_id":             task_id,
        "intern_role":         intern_role,
        "role_display":        ROLE_DISPLAY.get(intern_role, intern_role),
        "verdict":             verdict,
        "score":               merged["score"],
        "confidence":          _compute_confidence(merged),
        "breakdown":           merged["breakdown"],
        "rubric_maxes":        ROLE_RUBRICS.get(intern_role, ROLE_RUBRICS["default"]),
        "strengths":           merged.get("strengths", []),
        "blocking_issues":     merged.get("blocking_issues", []),
        "missing_requirements": merged.get("missing_requirements", []),
        "improvements":        merged.get("improvements", []),
        "review_summary":      merged.get("review_summary", "Review complete"),
        "next_steps":          _build_next_steps(verdict, merged.get("blocking_issues", []), audit_report),
        "audit_report":        audit_report,
        "security_block":      security_blocked,
        # Surface the internx repo URL in result for traceability
        "internx_repo_url":    internx_repo_url or None,
    }

    print(f"[REVIEW] ✅ Complete: {verdict.upper()} ({final['score']}/100) | Role: {intern_role} | Security block: {security_blocked}")
    return final


def _build_audit_report(
    audit_raw: Dict[str, Any],
    security_findings: List[Dict],
    has_critical: bool,
) -> Dict[str, Any]:
    """
    Merge deterministic security scan findings with AI audit results.
    Guarantees a well-structured audit_report even if AI fails.
    """
    base = {cat: {"status": "pass", "summary": "No issues detected.", "findings": []} for cat in AUDIT_CATEGORIES}

    # Merge AI results
    ai_audit = audit_raw.get("audit", {})
    for cat in AUDIT_CATEGORIES:
        if cat in ai_audit and isinstance(ai_audit[cat], dict):
            base[cat] = ai_audit[cat]

    # Override security with deterministic findings if they're more severe
    if security_findings:
        existing_sec_findings = base["security"].get("findings", [])
        det_findings = [
            {
                "severity": f["severity"],
                "title":    f["label"],
                "detail":   f"Line {f['line']}: {f['snippet']}",
                "cwe":      _label_to_cwe(f["label"]),
                "fix":      f["fix"],
            }
            for f in security_findings
        ]
        base["security"]["findings"] = det_findings + existing_sec_findings

        if has_critical:
            base["security"]["status"]  = "block"
            base["security"]["summary"] = f"🚨 SECURITY INCIDENT: {len([f for f in security_findings if f['severity']=='critical'])} secret(s) detected. Merge BLOCKED."
        elif any(f["severity"] == "high" for f in security_findings):
            if base["security"]["status"] != "block":
                base["security"]["status"]  = "warn"
                base["security"]["summary"] = f"High-severity security issues found ({len(security_findings)} total)."

    return base


def _label_to_cwe(label: str) -> str:
    mapping = {
        "OpenAI API Key":       "CWE-798",
        "Slack Bot Token":      "CWE-798",
        "GitHub Personal Access Token": "CWE-798",
        "AWS Access Key ID":    "CWE-798",
        "AWS Secret Access Key": "CWE-798",
        "Stripe Secret Key":    "CWE-798",
        "Hardcoded Credential": "CWE-259",
        "Bearer Token in Code": "CWE-522",
        "Hardcoded Email Address": "CWE-359",
        "Phone Number":         "CWE-359",
        "Unencrypted HTTP URL (should be HTTPS)": "CWE-319",
        "Sensitive Data in Logs": "CWE-532",
    }
    return mapping.get(label, "CWE-200")