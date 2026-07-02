#!/bin/bash
# ============================================================================
# Sync Tasks to GitHub
# Checks recent commits for issue references and closes matching issues.
#
# Triggered automatically after agent stops (via Kiro hook).
# Requires: gh CLI installed and authenticated.
# ============================================================================

export PATH="/home/prosoft/.nvm/versions/node/v22.23.1/bin:$PATH"
cd /home/prosoft/random/budgetapp || exit 0

# Check if gh is available and authenticated
if ! command -v gh &>/dev/null; then
  exit 0
fi

if ! gh auth status &>/dev/null 2>&1; then
  exit 0
fi

# Get the last commit message
COMMIT_MSG=$(git log --format="%s" -1 2>/dev/null)
COMMIT_SHA=$(git log --format="%H" -1 2>/dev/null)

if [ -z "$COMMIT_MSG" ]; then
  exit 0
fi

# ─── Helper: close issue by search query ─────────────────────────────────────
# Usage: close_issue "search query"
close_issue() {
  local search_query="$1"
  local issue_num
  issue_num=$(gh issue list --state open --search "$search_query" --json number -q '.[0].number' 2>/dev/null)
  if [ -n "$issue_num" ] && [ "$issue_num" != "null" ]; then
    gh issue close "$issue_num" --comment "Completed in $COMMIT_SHA" 2>/dev/null
  fi
}

# ─── Direct issue references (GitHub standard) ───────────────────────────────
# If commit has "closes #N" or "fixes #N", GitHub handles it on push.
# This script handles keyword-based matching for everything else.

# ─── Keyword matching ─────────────────────────────────────────────────────────
# Convert to lowercase for case-insensitive matching
MSG_LOWER=$(echo "$COMMIT_MSG" | tr '[:upper:]' '[:lower:]')

# Income configuration
if echo "$MSG_LOWER" | grep -qE "income (config|setting|schedule)|pay schedule"; then
  close_issue "Income configuration"
fi

# Recurring transaction detection
if echo "$MSG_LOWER" | grep -qE "recurring.*(detect|transaction)|detect.*recurring"; then
  close_issue "Recurring transaction detection"
fi

# AI auto-categorization
if echo "$MSG_LOWER" | grep -qE "auto.?categoriz|batch categoriz|ai categoriz"; then
  close_issue "AI auto-categorization batch"
fi

# Net worth history
if echo "$MSG_LOWER" | grep -qE "net worth (history|trend)"; then
  close_issue "Net worth history"
fi

# Spending heatmap
if echo "$MSG_LOWER" | grep -qE "spending heatmap|heatmap"; then
  close_issue "Spending heatmap"
fi

# Multi-currency
if echo "$MSG_LOWER" | grep -qE "multi.?currency|exchange rate"; then
  close_issue "Multi-currency"
fi

# Mobile UI
if echo "$MSG_LOWER" | grep -qE "mobile.*(ui|optimiz|responsive)|responsive.*(ui|design)"; then
  close_issue "Mobile-optimized UI"
fi

# AI chat actions
if echo "$MSG_LOWER" | grep -qE "ai chat.*(action|function|tool)|chat.*(action|function)"; then
  close_issue "AI chat with action"
fi

# Property-based tests
if echo "$MSG_LOWER" | grep -qE "property.*(test|based)|fast.?check"; then
  close_issue "Property-based tests"
fi

# Integration tests
if echo "$MSG_LOWER" | grep -qE "integration test|e2e test|end.to.end"; then
  close_issue "Integration tests"
fi

# Budget rollovers
if echo "$MSG_LOWER" | grep -qE "budget rollover|rollover"; then
  close_issue "Budget rollovers"
fi

# Transaction review/inbox
if echo "$MSG_LOWER" | grep -qE "transaction review|inbox workflow|mark.*(as )?reviewed|review status"; then
  close_issue "Transaction review"
fi

# Tags
if echo "$MSG_LOWER" | grep -qE "tag.*(support|transaction)|transaction.*tag"; then
  close_issue "Tags support"
fi

# Subscription management
if echo "$MSG_LOWER" | grep -qE "subscription.*(management|view|track)|recurring.*view"; then
  close_issue "Subscription management"
fi

# Spending trends
if echo "$MSG_LOWER" | grep -qE "spending trend|monthly comparison|month.over.month"; then
  close_issue "Spending trends"
fi

# Proactive AI briefings
if echo "$MSG_LOWER" | grep -qE "daily briefing|proactive.*ai|ai.*briefing|financial briefing"; then
  close_issue "Proactive AI daily"
fi

# Spending pace
if echo "$MSG_LOWER" | grep -qE "spending pace|pace line|budget pace"; then
  close_issue "Spending pace"
fi

# Investment tracking
if echo "$MSG_LOWER" | grep -qE "investment.*(track|portfolio)|portfolio.*(track|view)"; then
  close_issue "Investment and portfolio"
fi

# Real estate
if echo "$MSG_LOWER" | grep -qE "real estate|property valuation|home equity"; then
  close_issue "Real estate tracking"
fi

# Refund matching
if echo "$MSG_LOWER" | grep -qE "refund match|match.*refund"; then
  close_issue "Refund matching"
fi

# UI/UX overhaul
if echo "$MSG_LOWER" | grep -qE "ui.*(overhaul|redesign)|design system|dark.?mode.*(first|redesign)|ui.*polish"; then
  close_issue "UI/UX overhaul"
fi

exit 0
