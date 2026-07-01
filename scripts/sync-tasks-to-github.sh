#!/bin/bash
# ============================================================================
# Sync Tasks to GitHub
# Checks recent commits for issue references and closes matching issues.
# Also updates tasks.md completion status to GitHub milestones.
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
LAST_COMMIT=$(git log --oneline -1 2>/dev/null)

if [ -z "$LAST_COMMIT" ]; then
  exit 0
fi

# Check for issue references in commit messages (e.g., "fixes #3", "closes #5")
# GitHub auto-closes issues when pushed, but this handles cases where
# we reference issues by title or task number

# Look for "fix" or "feat" commits and try to match open issues
COMMIT_MSG=$(git log --format="%s" -1)

# If commit mentions a specific feature/fix, search for matching open issues
# and add a comment linking to the commit
COMMIT_SHA=$(git log --format="%H" -1)

# Auto-close issues that match commit scope
case "$COMMIT_MSG" in
  *"income configuration"*|*"income config"*|*"pay schedule"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Income configuration" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"recurring.*detection"*|*"recurring transaction"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Recurring transaction detection" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"auto-categorization"*|*"batch categoriz"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "auto-categorization batch" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"net worth history"*|*"net worth trend"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Net worth history" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"spending heatmap"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Spending heatmap" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"multi-currency"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Multi-currency" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"mobile.*UI"*|*"responsive"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "Mobile-optimized" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"AI chat.*action"*|*"function calling"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/feature" --search "AI chat with action" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"property.*test"*|*"property-based"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/test" --search "Property-based tests" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
  *"integration test"*|*"e2e test"*)
    gh issue close --comment "Completed in $COMMIT_SHA" \
      $(gh issue list --label "type/test" --search "Integration tests" --json number -q '.[0].number' 2>/dev/null) 2>/dev/null
    ;;
esac

exit 0
