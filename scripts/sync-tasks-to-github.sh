#!/usr/bin/env bash
# Reports explicit Wardkeep issue-closing references from the latest commit.
# Pass --close only after the commit is verified on the remote; the default
# report mode intentionally makes no GitHub changes.

set -euo pipefail

REPOSITORY="${WARDKEEP_GITHUB_REPOSITORY:-reyvera/wardkeep}"
MODE="report"

if [[ "${1:-}" == "--close" ]]; then
  MODE="close"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--close]" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is unavailable or unauthenticated; no issue sync performed."
  exit 0
fi

COMMIT_MESSAGE="$(git log -1 --format=%B 2>/dev/null || true)"
COMMIT_SHA="$(git log -1 --format=%H 2>/dev/null || true)"

if [[ -z "$COMMIT_MESSAGE" || -z "$COMMIT_SHA" ]]; then
  echo "No commit found; no issue sync performed."
  exit 0
fi

# Only explicit closing keywords are eligible. Plain #N references, titles,
# and fuzzy feature keywords are intentionally ignored.
ISSUE_NUMBERS="$({
  printf '%s\n' "$COMMIT_MESSAGE" \
    | grep -Eio '(close[sd]?|fix(e[sd])?|resolve[sd]?)[[:space:]]+(reyvera/wardkeep)?#[0-9]+' \
    | sed -E 's/.*#([0-9]+)/\1/' \
    | sort -u
} || true)"

if [[ -z "$ISSUE_NUMBERS" ]]; then
  echo "No explicit Wardkeep closing references in $COMMIT_SHA; no issue sync performed."
  exit 0
fi

echo "Explicit issue references for $REPOSITORY in $COMMIT_SHA:"
printf '%s\n' "$ISSUE_NUMBERS" | sed 's/^/#/'

if [[ "$MODE" != "close" ]]; then
  echo "Report only. Re-run with --close after the commit is confirmed on the remote."
  exit 0
fi

while IFS= read -r issue_number; do
  [[ -z "$issue_number" ]] && continue
  gh issue view "$issue_number" --repo "$REPOSITORY" >/dev/null
  gh issue close "$issue_number" --repo "$REPOSITORY" \
    --comment "Completed in commit $COMMIT_SHA"
done <<< "$ISSUE_NUMBERS"
