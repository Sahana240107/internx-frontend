"""
backend/app/services/mentor.py
Professional AI review service using Groq API (Llama 3.3 70B)
"""

import json
import re
from typing import Dict, Any, Optional, List
import httpx
import os
from groq import Groq
from app.core.config import get_settings

settings = get_settings()

# ─── Rubric Configuration ───────────────────────────────────────────────────

REVIEW_RUBRIC_WEIGHTS = {
    "task_completion": 40,
    "correctness_reliability": 25,
    "code_quality": 20,
    "security_best_practices": 10,
    "testing_signals": 5,
}

MAX_POSSIBLE = {
    "task_completion": 40,
    "correctness_reliability": 25,
    "code_quality": 20,
    "security_best_practices": 10,
    "testing_signals": 5,
}


# ─── Pre-Check Function ─────────────────────────────────────────────────────

def precheck_diff(pr_diff: str, task_keywords: list) -> Dict[str, Any]:
    """
    Deterministic pre-checks on diff before AI review.
    Returns caps that are strictly enforced after AI scoring.
    """
    if not pr_diff or len(pr_diff.strip()) < 10:
        return {
            "is_valid": False,
            "caps": {},
            "reason": "Diff is empty or too small."
        }

    if len(pr_diff) > 50000:
        return {
            "is_valid": True,
            "caps": {"task_completion": 30},
            "reason": "Very large diff; task completion capped at 30."
        }

    diff_lower = pr_diff.lower()
    keyword_matches = sum(1 for kw in task_keywords if kw.lower() in diff_lower)

    # Hard cap: if NO task keywords appear in the diff at all,
    # the overall score cannot exceed 20 regardless of what the AI says.
    if len(task_keywords) > 0 and keyword_matches == 0:
        return {
            "is_valid": True,
            "caps": {"overall": 20},
            "reason": "Diff does not appear to match the task. Score hard-capped at 20."
        }

    return {
        "is_valid": True,
        "caps": {},
        "reason": "OK"
    }


# ─── GitHub Fetcher ─────────────────────────────────────────────────────────

def fetch_pr_diff_from_github(pr_url: str) -> Optional[str]:
    """
    Fetch the .diff from a GitHub PR URL.
    """
    try:
        pr_url_clean = pr_url.rstrip('/')
        diff_url = pr_url_clean + ".diff"

        response = httpx.get(
            diff_url,
            timeout=20,
            follow_redirects=True,
            headers={"Accept": "text/plain"},
        )

        if response.status_code == 200:
            diff_text = response.text
            if not diff_text or len(diff_text.strip()) < 10:
                print(f"[REVIEW] GitHub returned empty diff for {diff_url}")
                return None
            return diff_text
        else:
            print(f"GitHub returned {response.status_code} for {diff_url}")
            return None

    except Exception as e:
        print(f"Error fetching PR diff from GitHub: {e}")
        return None


# ─── Prompt Builders ─────────────────────────────────────────────────────────

def build_requirement_audit_prompt(
    task_title: str,
    task_description: str,
    pr_diff: str
) -> str:
    return f"""You are an expert code reviewer for an internship program.

TASK TITLE: {task_title}

TASK REQUIREMENTS:
{task_description}

SUBMITTED PR DIFF:
```
{pr_diff[:8000]}
```

Your job: Audit whether this PR implements the exact requirements from the task description.

CRITICAL SCORING RULES:
- If the PR is for a completely different project or feature and does NOT implement the task at all → completion_score MUST be 0.
- If only partially implemented → completion_score between 1 and 20.
- If fully implemented but with minor issues → completion_score between 21 and 40.
- Do NOT give any completion_score above 0 if the submitted code is unrelated to the task.

Be specific:
- Which core requirements are met?
- Which are missing?
- Is there anything unrelated included?

Return ONLY valid JSON (no markdown, no preamble). Use this exact structure:
{{
  "requirement_check": {{
    "core_requirements_met": true or false,
    "requirements_met": ["requirement 1"],
    "missing_requirements": ["missing 1"],
    "completion_score": 0 to 40
  }},
  "requirement_summary": "summary text"
}}"""


def build_quality_review_prompt(
    task_title: str,
    task_description: str,
    pr_diff: str
) -> str:
    return f"""You are an expert code reviewer. Analyze this PR for quality.

TASK TITLE: {task_title}
TASK REQUIREMENTS: {task_description[:500]}

DIFF:
```
{pr_diff[:8000]}
```

IMPORTANT: If this code is completely unrelated to the task described above, all quality scores
should be very low (0-5 range) because quality cannot be judged without task context.

Evaluate:
1. Correctness & Reliability (0-25): Does it correctly implement what was asked?
2. Code Quality (0-20): Readability, structure, error handling
3. Security & Best Practices (0-10): Input validation, no secrets in code, etc.
4. Testing Signals (0-5): Tests present or testable structure

Return ONLY valid JSON (no markdown):
{{
  "scores": {{
    "correctness_reliability": 0-25,
    "code_quality": 0-20,
    "security_best_practices": 0-10,
    "testing_signals": 0-5
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


# ─── Main Review Function ─────────────────────────────────────────────────

def review_pr_professional(
    task_id: str,
    pr_url: str,
    task_description: str,
    task_title: str
) -> Dict[str, Any]:
    """
    Run professional review using Groq API (Llama 3.3 70B).
    Score is always computed from breakdown fields — the AI never sets
    the final score directly.
    """

    # 1. FETCH PR DIFF
    print(f"[REVIEW] Fetching PR diff from {pr_url}...")
    pr_diff = fetch_pr_diff_from_github(pr_url)

    if not pr_diff:
        print("[REVIEW] ❌ Failed to fetch PR diff")
        return _build_error_review(
            task_id=task_id,
            error_msg="Could not fetch PR from GitHub. Check that the link is correct and the repo is public."
        )

    print(f"[REVIEW] ✓ Fetched {len(pr_diff)} chars of diff")

    # 2. PRECHECK DIFF
    # Use meaningful task keywords (filter out common stop words for better matching)
    stop_words = {"the", "a", "an", "and", "or", "in", "on", "for", "to", "of", "with", "that", "this", "is", "are"}
    task_keywords = [
        w for w in (task_description or "").split()[:40]
        if len(w) > 3 and w.lower() not in stop_words
    ]
    precheck = precheck_diff(pr_diff, task_keywords)

    if not precheck["is_valid"]:
        print(f"[REVIEW] ❌ Precheck failed: {precheck['reason']}")
        return _build_error_review(
            task_id=task_id,
            error_msg=precheck["reason"]
        )

    print(f"[REVIEW] ✓ Precheck passed — caps: {precheck['caps']}")

    # 3. RUN AI REVIEW PASSES
    print("[REVIEW] Running requirement audit...")
    req_review = _run_groq_review(
        build_requirement_audit_prompt(task_title, task_description, pr_diff)
    )

    print("[REVIEW] Running quality review...")
    qual_review = _run_groq_review(
        build_quality_review_prompt(task_title, task_description, pr_diff)
    )

    if not req_review or not qual_review:
        print("[REVIEW] ❌ AI review failed")
        return _build_error_review(
            task_id=task_id,
            error_msg="AI review failed. Please try again."
        )

    print("[REVIEW] ✓ AI reviews completed")

    # 4. MERGE + ENFORCE CAPS
    print("[REVIEW] Merging results...")
    merged = _merge_reviews(
        req_data=req_review,
        qual_data=qual_review,
        precheck_caps=precheck.get("caps", {})
    )

    # 5. DETERMINE VERDICT
    blocking_critical = [
        b for b in merged["blocking_issues"]
        if b.get("severity") == "critical"
    ]

    verdict = "pass" if (merged["score"] >= 70 and not blocking_critical) else "resubmit"

    # 6. BUILD FINAL RESPONSE
    final = {
        "version": "1.0",
        "task_id": task_id,
        "verdict": verdict,
        "score": merged["score"],
        "confidence": _compute_confidence(merged),
        "breakdown": merged["breakdown"],
        "strengths": merged.get("strengths", []),
        "blocking_issues": merged.get("blocking_issues", []),
        "missing_requirements": merged.get("missing_requirements", []),
        "improvements": merged.get("improvements", []),
        "review_summary": merged.get("review_summary", "Review complete"),
        "next_steps": _build_next_steps(verdict, merged.get("blocking_issues", [])),
    }

    print(f"[REVIEW] ✅ Complete: {verdict.upper()} ({final['score']}/100)")
    return final


# ─── Helper Functions ───────────────────────────────────────────────────────

def _run_groq_review(prompt: str) -> Dict[str, Any]:
    """
    Call Groq API with strict JSON parsing.
    """
    response_text = ""
    try:
        api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
        if not api_key:
            print("[GROQ] ❌ GROQ_API_KEY not set in .env or environment")
            return {}

        client = Groq(api_key=api_key)

        print("[GROQ] Calling Llama 3.3 70B...")
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{
                "role": "user",
                "content": prompt
            }],
            max_tokens=2000,
            temperature=0.2  # Lower temperature for more deterministic scoring
        )

        response_text = message.choices[0].message.content.strip()
        print(f"[GROQ] ✓ Got response ({len(response_text)} chars)")

        # Strip markdown code fences if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        return json.loads(cleaned)

    except json.JSONDecodeError as e:
        print(f"[GROQ] ❌ JSON parse error: {e}")
        print(f"[GROQ] Response was: {response_text[:200]}")
        return {}
    except Exception as e:
        print(f"[GROQ] ❌ Error: {e}")
        return {}


def _clamp(value: int, min_val: int, max_val: int) -> int:
    """Clamp a value between min and max."""
    return max(min_val, min(max_val, int(value)))


def _merge_reviews(
    req_data: Dict[str, Any],
    qual_data: Dict[str, Any],
    precheck_caps: Dict[str, int]
) -> Dict[str, Any]:
    """
    Merge requirement audit + quality review into final breakdown.

    Key rule: The final score is ALWAYS computed as sum(breakdown.values()).
    The AI never sets the score directly — this prevents inflated scores
    when the AI ignores its own scoring rules.
    """
    req_check = req_data.get("requirement_check", {})
    qual_scores = qual_data.get("scores", {})

    # Pull raw scores from AI, clamped to their rubric maximums
    breakdown = {
        "task_completion":        _clamp(req_check.get("completion_score", 0),   0, MAX_POSSIBLE["task_completion"]),
        "correctness_reliability": _clamp(qual_scores.get("correctness_reliability", 0), 0, MAX_POSSIBLE["correctness_reliability"]),
        "code_quality":           _clamp(qual_scores.get("code_quality", 0),     0, MAX_POSSIBLE["code_quality"]),
        "security_best_practices": _clamp(qual_scores.get("security_best_practices", 0), 0, MAX_POSSIBLE["security_best_practices"]),
        "testing_signals":        _clamp(qual_scores.get("testing_signals", 0),  0, MAX_POSSIBLE["testing_signals"]),
    }

    # Apply precheck caps — these are hard limits, not hints
    if "overall" in precheck_caps:
        # Scale every component proportionally so total ≤ cap
        raw_total = sum(breakdown.values())
        if raw_total > 0:
            cap = precheck_caps["overall"]
            scale = cap / raw_total
            breakdown = {k: int(v * scale) for k, v in breakdown.items()}
        else:
            breakdown = {k: 0 for k in breakdown}

    # Apply per-category caps
    for k, cap_val in precheck_caps.items():
        if k != "overall" and k in breakdown:
            breakdown[k] = min(breakdown[k], cap_val)

    # ── CANONICAL SCORE: always the sum of breakdown, never from AI ──────────
    total_score = sum(breakdown.values())

    return {
        "score": total_score,
        "breakdown": breakdown,
        "strengths": qual_data.get("strengths", []),
        "blocking_issues": qual_data.get("blocking_issues", []),
        "missing_requirements": req_check.get("missing_requirements", []),
        "improvements": qual_data.get("improvements", []),
        "review_summary": req_data.get("requirement_summary", "Review complete")
    }


def _compute_confidence(merged: Dict[str, Any]) -> float:
    """Heuristic confidence score."""
    confidence = 0.85

    blocking = merged.get("blocking_issues", [])
    if len(blocking) > 5:
        confidence -= 0.1

    critical = [b for b in blocking if b.get("severity") == "critical"]
    if critical:
        confidence -= 0.05

    missing = merged.get("missing_requirements", [])
    if len(missing) > 3:
        confidence -= 0.1

    return max(0.5, min(1.0, round(confidence, 2)))


def _build_next_steps(verdict: str, blocking_issues: list) -> list:
    """Generate next steps based on verdict."""
    if verdict == "pass":
        return [
            "Great job! Your code meets all requirements.",
            "Consider the suggested improvements in future tasks.",
            "Mark this task as complete."
        ]

    steps = []
    critical_count = len([b for b in blocking_issues if b.get("severity") == "critical"])
    if critical_count > 0:
        steps.append(f"Fix {critical_count} critical issue(s) first — these are blocking your pass.")

    steps.extend([
        "Review all blocking issues listed and implement the suggested fixes.",
        "Re-test your changes thoroughly before resubmitting.",
        "Run `internx pr` to resubmit your PR for review."
    ])

    return steps


def _build_error_review(task_id: str, error_msg: str) -> Dict[str, Any]:
    """Build a failed review response."""
    return {
        "version": "1.0",
        "task_id": task_id,
        "verdict": "resubmit",
        "score": 0,
        "confidence": 0.5,
        "breakdown": {
            "task_completion": 0,
            "correctness_reliability": 0,
            "code_quality": 0,
            "security_best_practices": 0,
            "testing_signals": 0,
        },
        "strengths": [],
        "blocking_issues": [
            {
                "severity": "critical",
                "issue": "Could not review PR",
                "why_it_matters": error_msg,
                "fix": "Please verify your GitHub PR URL is correct and the repository is public."
            }
        ],
        "missing_requirements": ["PR could not be processed"],
        "improvements": [],
        "review_summary": error_msg,
        "next_steps": [
            "Check your GitHub PR URL is correct",
            "Ensure the repository is public",
            "Try submitting again"
        ]
    }