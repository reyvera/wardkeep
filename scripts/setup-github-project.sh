#!/bin/bash
# ============================================================================
# GitHub Project Setup Script
# Creates milestones, labels, and issues from the project roadmap.
# 
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated: sudo apt install gh && gh auth login
#   - Run from the repo root directory
# ============================================================================

set -e

echo "🏗️  Setting up GitHub project..."

# ─── Labels ──────────────────────────────────────────────────────────────────

echo "📌 Creating labels..."

gh label create "area/api" --color "0e8a16" --description "NestJS API (apps/api)" --force
gh label create "area/web" --color "1d76db" --description "Next.js frontend (apps/web)" --force
gh label create "area/worker" --color "5319e7" --description "BullMQ worker (apps/worker)" --force
gh label create "area/finance-engine" --color "d93f0b" --description "Pure math package" --force
gh label create "area/ai-engine" --color "fbca04" --description "AI provider abstraction" --force
gh label create "area/importers" --color "c5def5" --description "CSV/OFX/QFX parsers" --force
gh label create "area/shared" --color "bfdadc" --description "Shared types and constants" --force
gh label create "area/infra" --color "333333" --description "Docker, CI/CD, deployment" --force

gh label create "type/bug" --color "d73a4a" --description "Something isn't working" --force
gh label create "type/feature" --color "a2eeef" --description "New feature or enhancement" --force
gh label create "type/chore" --color "e4e669" --description "Maintenance, deps, docs" --force
gh label create "type/test" --color "bfe5bf" --description "Testing improvements" --force

gh label create "priority/high" --color "b60205" --description "Must fix soon" --force
gh label create "priority/medium" --color "fbca04" --description "Should address" --force
gh label create "priority/low" --color "0e8a16" --description "Nice to have" --force

# ─── Milestones ──────────────────────────────────────────────────────────────

echo "🎯 Creating milestones..."

gh api repos/{owner}/{repo}/milestones -f title="v0.1 - Core Infrastructure" -f description="Monorepo setup, shared types, database schema, auth" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v0.2 - Finance Engine" -f description="Balance, net worth, budgets, debt payoff, cash-flow projections" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v0.3 - Accounts & Transactions" -f description="CRUD, search, filters, duplicate detection, categories, budgets, rules" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v0.4 - AI & Background Jobs" -f description="AI engine, categorization, chat, worker, recurring detection" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v0.5 - Frontend & PWA" -f description="All pages, offline support, service worker, bank connections" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v0.6 - Deployment" -f description="Docker Compose, Dockerfiles, startup migrations, notifications" -f state="closed"
gh api repos/{owner}/{repo}/milestones -f title="v1.0 - Polish & Testing" -f description="Property-based tests, integration tests, bug fixes" -f state="open"
gh api repos/{owner}/{repo}/milestones -f title="v1.1 - Enhanced Features" -f description="Income config, AI actions, spending heatmaps, net worth history" -f state="open"

# ─── Issues: Future Features ─────────────────────────────────────────────────

echo "📝 Creating feature issues..."

gh issue create --title "Income configuration and pay schedule" \
  --body "Allow users to configure expected income with pay frequency (semi-monthly, biweekly, monthly, custom).

**Tasks:**
- Add income settings model and UI
- Pay frequency options: Semi-monthly (1st & 15th), Semi-monthly (15th & last), Biweekly, Monthly, Custom
- Expected net per paycheck amount
- Employment type: Salary (fixed) vs Hourly (variable)
- Weekend adjustment (paid early if payday on Sat/Sun)
- Update savings projection to use income configuration
- Dashboard: show next paycheck date indicator" \
  --label "type/feature,area/api,area/web,priority/medium" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "AI chat with action capabilities" \
  --body "Let the AI chat create budgets, categorize transactions, and modify data on behalf of the user using function calling / tool use.

**Examples:**
- 'Set up a budget with \$500 for groceries and \$200 for dining'
- 'Categorize all transactions from Walmart as Groceries'
- 'Mark all transfers between checking and savings'" \
  --label "type/feature,area/ai-engine,area/api,priority/medium" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "Recurring transaction detection (background job)" \
  --body "Worker job that analyzes transaction history and detects recurring patterns (3+ occurrences, consistent intervals ±3 days, amounts within 10%).

Confirm/dismiss flow already built in frontend. Needs worker job implementation to actually run detection." \
  --label "type/feature,area/worker,priority/medium" \
  --milestone "v1.0 - Polish & Testing"

gh issue create --title "AI auto-categorization batch processing" \
  --body "Worker job that processes uncategorized transactions in batches of 100, using the configured AI provider to suggest categories based on merchant name and amount.

Confidence routing: >0.85 auto-assign, 0.50-0.85 suggest, <0.50 leave uncategorized." \
  --label "type/feature,area/worker,area/ai-engine,priority/medium" \
  --milestone "v1.0 - Polish & Testing"

gh issue create --title "Net worth history trend line" \
  --body "Track and display net worth over time as a line chart on the dashboard. Store monthly snapshots." \
  --label "type/feature,area/api,area/web,priority/low" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "Spending heatmap by day of week" \
  --body "Visualize which days of the week the user spends the most. Could reveal patterns like weekend overspending." \
  --label "type/feature,area/web,priority/low" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "Multi-currency support" \
  --body "Support accounts in different currencies with exchange rate conversion for net worth calculations." \
  --label "type/feature,area/api,area/finance-engine,priority/low" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "Mobile-optimized UI improvements" \
  --body "Improve responsive design for small screens (320px-480px). Budget page, transaction table, and charts need mobile adaptations." \
  --label "type/feature,area/web,priority/medium" \
  --milestone "v1.1 - Enhanced Features"

gh issue create --title "Property-based tests (33 correctness properties)" \
  --body "Implement the remaining property-based tests using fast-check. See tasks.md for the full list of 33 properties covering finance engine, rules, importers, AI, and backup." \
  --label "type/test,priority/low" \
  --milestone "v1.0 - Polish & Testing"

gh issue create --title "Integration tests for critical user journeys" \
  --body "End-to-end tests for:
- Signup → add account → import CSV → verify rules → check budget
- Add debts → calculate payoff → compare strategies
- Chat → AI response → Finance Engine verification
- Create backup → encrypt → restore → verify data" \
  --label "type/test,priority/low" \
  --milestone "v1.0 - Polish & Testing"

echo ""
echo "✅ Done! Check your repo's Issues, Labels, and Milestones on GitHub."
echo ""
echo "Next steps:"
echo "  1. Create a GitHub Project board: gh project create --title 'BudgetApp Roadmap'"
echo "  2. Add issues to the project: gh project item-add <project-number> --url <issue-url>"
echo "  3. Or use the GitHub web UI to drag issues into project columns"
