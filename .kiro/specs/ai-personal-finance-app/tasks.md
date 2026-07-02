# Implementation Plan: AI Personal Finance App

## Overview

This plan builds the AI Personal Finance App incrementally from the monorepo foundation through core financial features to advanced AI and deployment capabilities. Each task builds on previous tasks, ensuring no orphaned code. The Finance Engine handles all deterministic math; the AI Engine handles categorization, chat, and pattern detection. Property-based tests use fast-check to validate 33 correctness properties.

## Tasks

- [ ] 1. Set up monorepo structure, shared types, and database schema
  - [x] 1.1 Initialize Turborepo monorepo with workspace configuration
    - Create root `package.json` with workspaces for `apps/*` and `packages/*`
    - Create `turbo.json` with build/test/lint pipeline configuration
    - Initialize `apps/web`, `apps/api`, `apps/worker` as empty TypeScript projects
    - Initialize `packages/shared`, `packages/finance-engine`, `packages/ai-engine`, `packages/importers`
    - Configure shared `tsconfig.base.json` with strict mode and path aliases
    - Add ESLint and Prettier configuration at root level
    - _Requirements: 14.1_

  - [x] 1.2 Define shared types and validation schemas in packages/shared
    - Create TypeScript interfaces for all domain entities: User, Account, Transaction, Category, Budget, Rule, RecurringTransaction, ChatMessage, Backup, UserSettings
    - Create enums: AccountType, TransactionType, RuleLogic, RuleOperator, RuleConditionField, RuleActionType, RecurrenceFrequency, AIPrivacyMode, BackupSchedule
    - Create Zod validation schemas for all API request/response DTOs
    - Create shared constants: pagination defaults, field limits, rate limits, confidence thresholds (0.50, 0.85)
    - Export Decimal.js utility types for currency precision
    - _Requirements: 2.1, 2.2, 3.1, 3.5, 6.1, 7.2, 7.3, 10.10, 16.1_

  - [x] 1.3 Set up Prisma schema and database migrations
    - Create `prisma/schema.prisma` with all models from design document
    - Configure PostgreSQL connection with NUMERIC(19,4) for currency fields
    - Create initial migration with all tables, indexes, and unique constraints
    - Create seed script for default categories (Income, Housing, Utilities, Groceries, Transportation, Healthcare, Entertainment, Dining, Shopping, Insurance, Education, Personal Care, Gifts, Subscriptions, Debt Payment, Savings, Uncategorized)
    - Generate Prisma client with typed output
    - _Requirements: 5.1, 14.2, 17.5_

  - [x]* 1.4 Write property test for password validation (Property 33)
    - **Property 33: Password validation enforces length constraints**
    - Generate arbitrary strings (0–200 chars); assert accepted iff length in [12, 128]
    - **Validates: Requirements 1.6**

- [ ] 2. Implement authentication and session management (apps/api)
  - [x] 2.1 Scaffold NestJS API application with core module structure
    - Set up NestJS app with common module (guards, interceptors, exception filters)
    - Configure Prisma module as global provider
    - Set up health check endpoint at `/api/health`
    - Configure CORS and Helmet for security headers
    - _Requirements: 14.7_

  - [x] 2.2 Implement AuthModule with registration, login, and session management
    - Create auth controller with POST /api/auth/register, /api/auth/login, /api/auth/logout
    - Implement bcrypt password hashing with cost factor 10+
    - Create session-based authentication with UUID tokens
    - Implement 30-minute session inactivity timeout with `lastActive` tracking
    - Create AuthGuard for protected routes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 2.3 Implement account lockout and password reset flow
    - Implement failed login counter: lock account after 5 failures in 10 minutes for 15 minutes
    - Create POST /api/auth/forgot-password and /api/auth/reset-password endpoints
    - Implement single-use, 15-minute time-limited reset tokens
    - Invalidate all existing sessions on password reset/change
    - _Requirements: 1.5, 1.7, 1.8, 1.9_

  - [x] 2.4 Implement rate limiting and per-user data isolation
    - Add global rate limiter: 100 req/min per user for API, 10 req/min for auth endpoints
    - Create UserScopeInterceptor that injects userId into all queries
    - Implement audit logging for authentication events
    - _Requirements: 17.5, 17.6, 17.7, 17.8, 17.9_

  - [x]* 2.5 Write property test for rate limiting (Property 31)
    - **Property 31: Rate limiting rejects requests beyond threshold**
    - Generate request sequences exceeding thresholds; verify rejection with wait time
    - **Validates: Requirements 17.8, 17.9**

  - [x]* 2.6 Write property test for data isolation (Property 30)
    - **Property 30: Per-user data isolation prevents cross-user access**
    - Generate multi-user data sets; verify queries never return cross-user records
    - **Validates: Requirements 17.5, 17.6**

- [x] 3. Checkpoint - Verify monorepo build and auth
  - Ensure all packages build cleanly with `turbo build`
  - Ensure Prisma migrations run successfully
  - Ensure auth endpoints pass unit tests
  - Ask the user if questions arise.

- [x] 4. Implement Finance Engine core (packages/finance-engine)
  - [x] 4.1 Implement account balance and net worth calculations
    - Create `calculateBalance(initialBalance, transactions)` using Decimal.js
    - Create `calculateNetWorth(accounts)` separating assets from liabilities, excluding archived
    - All functions are pure with no side effects
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 4.2 Write property tests for balance and net worth (Properties 1, 2, 3)
    - **Property 1: Account balance is initial balance plus sum of credits minus sum of debits**
    - **Property 2: Net worth equals assets minus liabilities excluding archived accounts**
    - **Property 3: Transaction deletion adjusts balance correctly**
    - Generate random account sets with varying types and archive states
    - **Validates: Requirements 2.4, 2.5, 2.6, 3.8**

  - [x] 4.3 Implement budget calculation functions
    - Create `calculateBudgetProgress(allocations, transactions)` summing expenses per category in period
    - Create `calculateBudgetSummary(budget, transactions)` for total allocated/spent/remaining
    - Implement threshold detection: 90% warning, 100% overspent alert
    - All calculations use Decimal.js for exact arithmetic
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.8, 6.9_

  - [ ]* 4.4 Write property tests for budget calculations (Properties 9, 10)
    - **Property 9: Budget actual spending equals sum of category expenses in period**
    - **Property 10: Budget threshold notifications fire at correct percentages**
    - Generate random allocations and transaction sets; verify exact decimal sums
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.8, 6.9**

  - [x] 4.5 Implement debt payoff calculator
    - Create `calculatePayoffSchedule(debts, strategy, extraPayment)` with monthly amortization
    - Implement snowball (lowest balance first), avalanche (highest rate first), custom priority
    - Create `compareStrategies(debts, strategies)` computing interest savings and time difference
    - Implement what-if mode that doesn't modify actual data
    - Use 10+ decimal places for intermediate interest calculations, 2 for display
    - Cap projection at 360 months; return warning if minimum payments exceed total payment
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_

  - [ ]* 4.6 Write property tests for debt calculator (Properties 17, 18, 19, 20)
    - **Property 17: Debt payoff schedule computes correct monthly amortization**
    - **Property 18: Extra payments distribute according to strategy rules**
    - **Property 19: Strategy comparison computes correct interest savings**
    - **Property 20: Insufficient total payment warning**
    - Generate random debt sets with varying balances, APRs, minimum payments
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.6, 10.8, 10.11**

  - [x] 4.7 Implement cash-flow projection engine
    - Create `projectCashFlow(account, recurring, oneTime, days)` computing daily balances
    - Each day: previous_day_balance + credits_on_day − debits_on_day
    - Expand recurring transactions by frequency into daily events
    - Detect below-zero projections and generate notification data
    - Flat projection when no recurring transactions exist
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7, 11.8, 11.9_

  - [ ]* 4.8 Write property tests for cash-flow projections (Properties 21, 22, 23)
    - **Property 21: Cash-flow projection deterministically computes daily balances**
    - **Property 22: Below-zero projection generates notification with correct details**
    - **Property 23: No recurring transactions implies flat projection**
    - Generate random recurring sets and one-time events; verify deterministic daily totals
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.8, 11.9**

  - [x] 4.9 Implement AI claim verification in Finance Engine
    - Create `verifyAIClaim(claim, context)` that independently computes numerical values
    - Return VerificationResult with isCorrect flag, verified value, and correction warning if discrepancy
    - _Requirements: 9.7_

  - [ ]* 4.10 Write property test for AI claim verification (Property 16)
    - **Property 16: Finance Engine verifies and corrects AI numerical claims**
    - Generate claims with known-correct and known-incorrect values; verify detection
    - **Validates: Requirements 9.7**

- [x] 5. Checkpoint - Finance Engine complete
  - Ensure all finance-engine functions have passing unit tests
  - Ensure property tests pass with 100+ iterations each
  - Ask the user if questions arise.

- [ ] 6. Implement Account and Transaction modules (apps/api)
  - [x] 6.1 Implement AccountModule with CRUD operations
    - Create account controller: GET/POST/PATCH/DELETE /api/accounts
    - Implement GET /api/accounts/net-worth using Finance Engine
    - Validate account name (1-100 chars), type, currency, initial balance
    - Implement archive (soft delete) instead of hard delete
    - Enforce unique account name per user, max 50 accounts per user
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 6.2 Implement TransactionModule with CRUD and search
    - Create transaction controller: GET/POST/PATCH/DELETE /api/transactions
    - Implement paginated list (10-200 per page, default 50, sorted by date desc)
    - Implement search/filter: date range, account, category, tag, merchant, amount range, free-text
    - Validate amount (0.01–999,999,999.99), required fields (date, amount, type, account)
    - Recalculate account balance within 1 second on create/edit/delete
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 6.3 Implement duplicate detection for transactions
    - Create GET /api/transactions/duplicates endpoint
    - Flag transactions with matching date + amount + merchant (case-insensitive, trimmed) in same account
    - Present duplicate groups to user for resolution (keep, merge, delete)
    - Apply during import and manual transaction creation
    - _Requirements: 3.9, 3.10_

  - [ ]* 6.4 Write property test for duplicate detection (Property 4)
    - **Property 4: Duplicate detection flags matching date+amount+merchant in same account**
    - Generate transaction pairs with matching/non-matching fields; verify correct flagging
    - **Validates: Requirements 3.9, 4.4**

- [ ] 7. Implement Category and Budget modules (apps/api)
  - [x] 7.1 Implement CategoryModule with CRUD and hierarchy
    - Create category controller: GET/POST/PATCH/DELETE /api/categories
    - Support tree structure with one-level sub-categories (max depth 2)
    - Implement POST /api/categories/merge for merging categories
    - On delete: reassign all transactions (including sub-category transactions) to Uncategorized
    - Prevent deletion of Uncategorized category
    - Validate unique name within same parent scope, max 200 categories per user
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 7.2 Write property tests for category hierarchy (Properties 7, 8)
    - **Property 7: Category deletion reassigns all transactions to Uncategorized**
    - **Property 8: Sub-categories enforce single-level depth**
    - Generate category trees and transaction associations; verify reassignment and depth constraints
    - **Validates: Requirements 5.3, 5.4, 5.6**

  - [x] 7.3 Implement BudgetModule with CRUD and progress tracking
    - Create budget controller: GET/POST/PATCH /api/budgets/:month, POST /api/budgets/copy
    - Implement GET /api/budgets/:month/summary using Finance Engine
    - Enforce one budget per user per month
    - Implement copy from previous month (exclude deleted categories)
    - Validate allocation amounts (0.01–999,999,999.99)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8_

  - [x] 7.4 Implement budget threshold notifications
    - Create notification service for in-app notifications via WebSocket
    - Fire warning at 90% of allocation, overspent alert at 100%
    - Update budget progress within 5 seconds of new transaction
    - _Requirements: 6.5, 6.6_

- [ ] 8. Implement Rules Engine (apps/api)
  - [x] 8.1 Implement RulesModule with CRUD and evaluation logic
    - Create rules controller: GET/POST/PATCH/DELETE /api/rules
    - Implement condition evaluation: merchant (contains, equals, starts_with, regex), amount (equals, gt, lt, between), description (contains, equals, regex)
    - Implement AND/OR logic modes per rule
    - Evaluate rules in priority order on transaction create/import
    - Handle conflicts: last-matching wins for same-field, accumulate for additive actions
    - Auto-assign next priority when not specified
    - Validate: at least one condition and one action, valid regex, valid category references
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10_

  - [x] 8.2 Implement dry-run and retroactive rule application
    - Create POST /api/rules/:id/dry-run returning matching transactions without modification
    - Create POST /api/rules/:id/apply for retroactive application with affected count
    - Process batch of 1000 transactions against 100 rules within 10 seconds
    - _Requirements: 7.6, 7.7_

  - [ ]* 8.3 Write property tests for rules engine (Properties 11, 12, 13)
    - **Property 11: Rules engine evaluates in priority order with correct conflict resolution**
    - **Property 12: Rule condition evaluation matches AND/OR logic correctly**
    - **Property 13: Dry-run mode produces match list without data modification**
    - Generate random rule sets with conditions, priorities, and transactions; verify evaluation order and conflict resolution
    - **Validates: Requirements 7.2, 7.4, 7.5, 7.6**

- [x] 9. Checkpoint - Core features complete
  - Ensure accounts, transactions, categories, budgets, and rules modules pass all tests
  - Run integration tests with real PostgreSQL via Testcontainers
  - Ask the user if questions arise.

- [ ] 10. Implement Importers package (packages/importers)
  - [x] 10.1 Implement CSV, OFX, and QFX parsers
    - Create `parse(buffer, format, mapping?)` supporting CSV, OFX, QFX formats
    - Implement column mapping for CSV (date, amount, description, category)
    - Return ParseResult with transactions array, errors array (line number + reason), totalRows
    - Implement streaming parser for memory efficiency on large files
    - Reject files exceeding 10MB or 50,000 rows
    - _Requirements: 4.1, 4.3, 4.5, 4.7_

  - [x] 10.2 Implement CSV export and round-trip support
    - Create `export(transactions, 'csv')` producing valid CSV output
    - Ensure parse → export → re-parse produces matching data
    - _Requirements: 4.9_

  - [ ]* 10.3 Write property tests for import/export (Properties 5, 6)
    - **Property 5: Import round-trip preserves transaction data**
    - **Property 6: Malformed import rows are skipped without blocking valid rows**
    - Generate random valid/invalid transaction rows; verify round-trip and error isolation
    - **Validates: Requirements 4.5, 4.9**

  - [x] 10.4 Implement ImportModule in apps/api
    - Create import controller: POST /api/import/upload (preview), POST /api/import/commit
    - Present first 10 detected transactions as preview before committing
    - Apply duplicate detection during import (date, amount, description, case-insensitive)
    - Apply Rules Engine to imported transactions for auto-categorization
    - Display import summary: total rows, imported, duplicates skipped, errors
    - Enqueue large file processing to BullMQ for background handling
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.8_

- [ ] 11. Implement AI Engine (packages/ai-engine)
  - [x] 11.1 Create AI provider abstraction and Ollama provider
    - Define AIProvider interface with `complete(prompt, options)` and `isAvailable()`
    - Implement OllamaProvider connecting to local Ollama instance (http://ollama:11434)
    - Implement circuit breaker: open after 5 consecutive failures, 60s cooldown
    - _Requirements: 16.1, 16.2_

  - [x] 11.2 Implement cloud providers (OpenAI, Anthropic) and privacy mode routing
    - Implement OpenAIProvider and AnthropicProvider with API key validation
    - Implement privacy mode router: Local → Ollama only, Cloud → cloud only, Hybrid → route based on sensitivity
    - Define sensitive data: account balances, account numbers, transaction amounts, merchant names, PII
    - Never fall back to cloud when in Local mode; queue if Ollama unavailable
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.6, 16.7, 16.8_

  - [x] 11.3 Implement AI categorization engine
    - Create `categorize(transaction)` returning CategorySuggestion with confidence score (0.00–1.00)
    - Create `batchCategorize(transactions)` for bulk processing
    - Implement confidence routing: >0.85 auto-assign, 0.50–0.85 suggest, <0.50 Uncategorized
    - Implement user correction learning: store merchant→category mapping in AICorrection table
    - Subsequent requests for same merchant use correction over AI suggestion
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 11.4 Write property tests for AI categorization (Properties 14, 15)
    - **Property 14: AI categorization confidence thresholds route correctly**
    - **Property 15: User category correction trains merchant mapping**
    - Generate random confidence scores and merchant corrections; verify routing and learning
    - **Validates: Requirements 8.3, 8.4, 8.5, 8.6**

  - [ ]* 11.5 Write property test for AI privacy mode routing (Property 29)
    - **Property 29: AI Privacy Mode enforces routing constraints**
    - Generate AI requests under each privacy mode; verify no external calls in Local mode
    - **Validates: Requirements 16.2, 16.8**

  - [x] 11.6 Implement AI chat interface with Finance Engine verification
    - Create `chat(query, financialContext, history)` returning AIResponse
    - Maintain conversation context for up to 10 previous exchanges per session
    - Pass all numerical claims through Finance Engine `verifyAIClaim` before returning
    - If discrepancy exists, include correction warning in response
    - Reject empty queries or unrecognizable intent with rephrasing prompt
    - Never recommend financial products, investment securities, or tax advice
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [ ] 12. Implement Worker and background job processing (apps/worker)
  - [x] 12.1 Set up BullMQ worker with queue consumers
    - Create NestJS standalone worker application consuming BullMQ jobs
    - Define queues: ai-categorization (concurrency 1), import-processing (2), recurring-detection (1), backup (1), rules-apply (2), notifications (5)
    - Connect worker to Redis and PostgreSQL
    - Implement graceful shutdown with job completion on SIGTERM
    - _Requirements: 14.1_

  - [x] 12.2 Implement AI categorization batch job
    - Consume `ai-categorization` queue jobs
    - Process batches of 100 uncategorized transactions within 30 seconds (local mode)
    - Apply confidence-based routing after AI response
    - On AI service unavailable: leave as Uncategorized, retry on next cycle
    - _Requirements: 8.7, 8.8, 8.9_

  - [x] 12.3 Implement recurring transaction detection job
    - Consume `recurring-detection` queue jobs
    - Analyze transaction history: amounts within 10%, matching merchants, consistent intervals ±3 days
    - Require 3+ occurrences to flag as recurring
    - Create detected pattern records for user confirmation
    - Suppress dismissed patterns from future detection
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7_

  - [ ]* 12.4 Write property tests for recurring detection (Properties 24, 25)
    - **Property 24: Recurring transaction detection requires 3+ occurrences within consistent intervals**
    - **Property 25: Dismissed patterns suppressed from future detection**
    - Generate transaction histories with embedded recurring patterns; verify detection criteria
    - **Validates: Requirements 12.1, 12.2, 12.7**

- [ ] 13. Implement Recurring Transaction and Cash-Flow API modules
  - [x] 13.1 Implement RecurringModule in apps/api
    - Create recurring controller: GET /api/recurring, GET /api/recurring/detected
    - Implement POST /api/recurring/confirm and POST /api/recurring/dismiss
    - Track missed occurrences (not received within 5 days of expected)
    - Support deactivation (stops monitoring, excludes from cash-flow)
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 13.2 Implement CashFlowModule in apps/api
    - Create cashflow controller: GET /api/cashflow/forecast, POST /api/cashflow/one-time
    - Use Finance Engine `projectCashFlow` for 90-day projections
    - Incorporate confirmed recurring transactions and one-time future events
    - Recalculate within 5 seconds on recurring transaction changes
    - Return both chart-ready (daily array) and tabular data
    - Trigger notification when projected balance falls below zero
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8_

  - [x] 13.3 Implement DebtModule in apps/api
    - Create debt controller: POST /api/debt/calculate, POST /api/debt/compare, POST /api/debt/what-if
    - Use Finance Engine for all calculations
    - Validate debt inputs: balance > 0, APR 0–100%, minimum payment ≥ 0.01
    - Implement what-if mode (simulate without affecting actual data)
    - Recalculate within 2 seconds on parameter changes
    - _Requirements: 10.1, 10.4, 10.5, 10.7, 10.9, 10.10, 10.11_

  - [x] 13.4 Implement AIChatModule in apps/api
    - Create chat controller: POST /api/chat, GET /api/chat/history
    - Pass queries to AI Engine with financial context
    - Display underlying numerical data alongside AI explanations
    - Apply Finance Engine verification to all numerical claims
    - Limit queries to 500 characters, maintain 10-message session context
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [x] 14. Checkpoint - API features complete
  - Ensure all API modules pass integration tests
  - Verify rules engine performance (1000 transactions × 100 rules < 10s)
  - Verify AI categorization batch performance (100 transactions < 30s)
  - Ask the user if questions arise.

- [ ] 15. Implement Backup Service
  - [x] 15.1 Implement BackupModule with create, restore, and scheduling
    - Create backup controller: POST /api/backup/create, POST /api/backup/restore, GET /api/backup/list, PATCH /api/backup/schedule
    - Export all user data (accounts, transactions, categories, budgets, rules, settings) to encrypted archive
    - Encrypt with AES-256-GCM using user-provided passphrase (min 12 chars)
    - Complete backup within 60 seconds for up to 100,000 transactions
    - On restore: validate authentication tag before any data modification
    - Abort restore on incorrect passphrase or corruption without modifying existing data
    - Implement retention (1–30 backups, default 5), auto-delete oldest when exceeded
    - Support scheduled backups (daily, weekly, monthly) via BullMQ
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 15.2 Write property tests for backup service (Properties 26, 27, 28)
    - **Property 26: Backup round-trip preserves all user data**
    - **Property 27: Invalid passphrase leaves existing data unchanged**
    - **Property 28: Backup retention deletes oldest when limit exceeded**
    - Generate user data sets; verify encrypt→decrypt round-trip, failed restore safety, retention policy
    - **Validates: Requirements 15.4, 15.6, 15.8**

- [ ] 16. Implement Settings and AI Privacy Configuration
  - [x] 16.1 Implement SettingsModule in apps/api
    - Create settings controller: GET/PATCH /api/settings, POST /api/settings/validate-api-key
    - Support AI privacy mode configuration (Local, Hybrid, Cloud)
    - Encrypt API keys at application layer with AES-256
    - Validate API key format before saving
    - Apply mode change within 2 seconds without restart
    - Show warning and require consent for Cloud mode activation
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_

  - [x] 16.2 Implement data encryption utilities
    - Create encryption service for sensitive fields (API keys, chat history)
    - Store encryption keys via environment variables, never in same storage as data
    - Implement encrypted export option for data exports
    - _Requirements: 17.1, 17.2, 17.4_

- [ ] 17. Implement Next.js frontend (apps/web)
  - [x] 17.1 Set up Next.js application with core layout and routing
    - Configure Next.js 14+ with App Router and TypeScript
    - Set up Tailwind CSS with responsive design tokens
    - Create layout shell with navigation (dashboard, accounts, transactions, budget, debt, chat)
    - Set up React Query for server state and Zustand for client state
    - Implement typed API client using shared types
    - Create responsive layouts for 320px–2560px screen widths
    - _Requirements: 13.1, 13.8_

  - [x] 17.2 Implement authentication pages and session handling
    - Create login, register, forgot-password, and reset-password pages
    - Implement session token storage and automatic refresh
    - Handle session expiry (redirect to login)
    - Create AuthProvider context wrapping the app
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 17.3 Implement dashboard, accounts, and transaction pages
    - Create dashboard page with net worth summary and recent transactions
    - Create accounts list and detail pages with balance display
    - Create transactions page with paginated table, search/filter controls
    - Create transaction create/edit forms with validation
    - Implement duplicate resolution UI (keep, merge, delete)
    - _Requirements: 2.4, 2.5, 3.5, 3.6, 3.7, 3.9, 3.10_

  - [x] 17.4 Implement budget, category, and import pages
    - Create monthly budget page with category allocations and progress bars
    - Create category management page with tree view and merge dialog
    - Create import page with file upload, column mapping, preview, and commit flow
    - Display import summary after completion
    - _Requirements: 4.2, 4.3, 4.6, 5.2, 6.1, 6.4, 6.8_

  - [x] 17.5 Implement rules, debt calculator, and cash-flow pages
    - Create rules list page with create/edit forms, dry-run preview, and retroactive apply
    - Create debt calculator page with strategy selection, schedule display, and what-if mode
    - Create cash-flow page with line chart and day-by-day table
    - _Requirements: 7.1, 7.6, 10.1, 10.6, 10.9, 11.6_

  - [x] 17.6 Implement AI chat page and recurring transactions page
    - Create chat interface with message history and real-time responses
    - Display verified numerical data alongside AI explanations
    - Show correction warnings when AI claims differ from Finance Engine
    - Create recurring transactions page with detected patterns, confirm/dismiss actions
    - _Requirements: 9.1, 9.3, 9.7, 12.3, 12.4_

  - [x] 17.7 Implement settings and backup management pages
    - Create settings page with AI privacy mode toggle, API key entry, backup schedule
    - Show Cloud mode warning and consent dialog
    - Create backup page with create, restore, and backup list
    - _Requirements: 15.1, 15.5, 16.1, 16.3, 16.4_

- [ ] 18. Implement PWA features (apps/web)
  - [x] 18.1 Implement service worker with offline caching and action queue
    - Create service worker for app shell caching (7-day TTL)
    - Cache previously loaded data for offline read-only access
    - Implement offline action queue (max 100 actions)
    - Show offline indicator when connectivity lost
    - On reconnect: sync queued actions within 30s, last-write-wins for conflicts
    - Notify user of auto-resolved conflicts
    - Reject queuing when at capacity (100) with clear user message
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.9_

  - [x] 18.2 Create PWA manifest and install support
    - Create web app manifest for installability on iOS, Android, Windows, Mac, Linux
    - Configure icons, theme color, display mode
    - Target Lighthouse PWA score of 90+
    - Target LCP ≤ 3 seconds under simulated 4G (1.6 Mbps, 150ms RTT)
    - _Requirements: 13.1, 13.6, 13.7_

  - [ ]* 18.3 Write property test for offline action queue (Property 32)
    - **Property 32: Offline action queue enforces capacity and sync order**
    - Generate action sequences exceeding capacity; verify 101st rejection and sync behavior
    - **Validates: Requirements 13.3, 13.4, 13.9**

- [~] 19. Checkpoint - Frontend and PWA complete
  - Ensure all pages render correctly at 320px, 768px, 1440px, 2560px
  - Ensure service worker caches correctly and offline queue functions
  - Ensure all API integrations work end-to-end
  - Ask the user if questions arise.

- [ ] 20. Implement Docker Compose deployment
  - [x] 20.1 Create Dockerfiles for each service
    - Create multi-stage Dockerfile for apps/web (build + production serve)
    - Create multi-stage Dockerfile for apps/api (build + production)
    - Create Dockerfile for apps/worker
    - Optimize image sizes with Alpine/distroless base images
    - _Requirements: 14.1_

  - [x] 20.2 Create Docker Compose configuration
    - Define services: web (port 3000), api (port 4000), worker, postgres (5432), redis (6379), ollama (11434)
    - Configure named volumes: pg_data, redis_data, ollama_models, backups
    - Add health checks for all services (respond within 5s, check every 30s)
    - Configure environment variables: database credentials, AI privacy mode, backup schedule, session timeout, API keys
    - Ensure API starts only after migrations complete and default data is seeded
    - Document minimum hardware: 2GB RAM, 2 CPU cores, 10GB storage
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7, 14.8, 14.9_

  - [x] 20.3 Implement startup migration and upgrade support
    - Create entrypoint script that runs Prisma migrations before API accepts requests
    - Seed default categories and settings on first run
    - On upgrade: apply migrations automatically without data loss
    - Abort startup on migration failure, preserve existing database state
    - Function fully without network when in Local AI mode (after image pull)
    - _Requirements: 14.2, 14.4, 14.5, 14.6_

- [ ] 21. Implement WebSocket notifications and real-time updates
  - [x] 21.1 Implement NotificationModule with WebSocket gateway
    - Create WebSocket gateway in apps/api using NestJS WebSocket adapter
    - Implement notification service: budget threshold alerts, missed recurring transactions, below-zero projections, offline sync conflict notifications
    - Dispatch notifications from worker via Redis pub/sub
    - _Requirements: 6.5, 6.6, 11.4, 12.5, 13.4_

- [ ] 22. Final integration and wiring
  - [x] 22.1 Wire all modules together and verify end-to-end flows
    - Ensure transaction creation triggers: rules engine → AI categorization queue → budget recalculation → duplicate detection
    - Ensure import flow triggers: parse → preview → commit → rules → AI categorization → notifications
    - Ensure recurring detection integrates with cash-flow projections
    - Ensure settings changes propagate to AI Engine routing immediately
    - Verify all health check endpoints return correct service status
    - _Requirements: 4.8, 7.4, 8.9, 14.7_

  - [ ]* 22.2 Write integration tests for critical user journeys
    - Test: signup → add account → import CSV → verify rules applied → check budget progress
    - Test: add debts → calculate payoff → compare strategies → what-if simulation
    - Test: chat query → AI response → Finance Engine verification → correction display
    - Test: create backup → verify encryption → restore with correct passphrase → verify data
    - _Requirements: 4.8, 9.7, 10.6, 15.3, 15.8_

- [x] 23. Final checkpoint - Full system integration
  - Ensure Docker Compose stack starts all services within 120 seconds
  - Ensure all property-based tests pass with 100+ iterations
  - Ensure all integration tests pass
  - Run full Turborepo build pipeline cleanly
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate 33 universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases using Vitest
- All currency arithmetic uses Decimal.js — no floating-point math for money
- Finance Engine is the source of truth for all calculations; AI Engine never overrides it
- The worker processes all async jobs (AI categorization, recurring detection, backups) to keep API responsive
- Docker Compose deployment is self-contained; Local AI mode requires no external network after initial pull

## Bugs and Fixes

- [x] 24.1 Login page should be the default route
  - Navigating to `localhost:3000` shows the dashboard instead of the login page
  - Unauthenticated users must be redirected to `/login`, not `/dashboard`
  - Fixed: Added Next.js middleware that checks for auth cookie, root route now redirects to `/login`

## v1.0 — UI Redesign (Copilot Money–Inspired)

- [ ] 25. UI/UX overhaul — premium dark-mode-first design
  - [x] 25.1 Set up design system foundations
    - Install Inter font via next/font/google
    - Replace emoji nav icons with Lucide React SVG icons
    - Define CSS custom properties for full color palette (dark + light mode)
    - Configure Tailwind darkMode: 'class' with dark as default
    - Add color palette to tailwind.config.ts (bg-primary, bg-secondary, bg-elevated, etc.)
    - Set up theme toggle (dark/light/system) in settings and nav
  - [x] 25.2 Redesign app shell and navigation
    - Dark sidebar (#0D0F12) with icon + label nav items
    - Active state: blue tint background + left accent border
    - Collapsible sidebar (full → icon-only at 64px)
    - Mobile: bottom tab bar with 5 primary nav items
    - Content area: max-width 1200px, centered, 32px padding
    - Skeleton loading placeholders for all page loads
  - [x] 25.3 Redesign dashboard page
    - Net worth hero number (32-40px bold) with monthly trend indicator
    - 2-3 column summary card grid (spending, upcoming bills, recent transactions)
    - Cash flow sparkline widget
    - Accounts list with balance + sparkline per account
    - Cards: dark bg (#151921), 1px border (#232A36), 12px radius
  - [x] 25.4 Redesign transactions page
    - Search bar + filter chips (account, category, date, type, review status, tag)
    - Summary bar: total spent / total income / net for current filter
    - Transaction rows: emoji + merchant | category pill | aligned amount (green/red)
    - Unreviewed indicator: light-blue dot on left edge
    - Hover quick-actions: categorize, review, flag
    - Keyboard navigation: arrows, X select, R review, C categorize
    - Bulk selection bar with batch actions
    - Sort by date or amount
  - [x] 25.5 Redesign budget page
    - Month selector with arrows (← June 2026 →)
    - Spending pace line chart (daily cumulative vs ideal pace line)
    - Category progress bars: 8px rounded, gradient fill (blue→green under, yellow at 90%, red at 100%+)
    - Per-category: name (left), "$X of $Y" (right), remaining/overspent below
    - Rollover indicators where applicable
  - [x] 25.6 Redesign accounts page
    - Account list: name | institution | type badge | balance | sparkline trend
    - Detail view: full balance history chart (time period selectors: 1W|1M|3M|6M|1Y|ALL)
    - Net worth summary card at top with breakdown
  - [x] 25.7 Redesign categories/spending page
    - Donut or horizontal bar chart for spending distribution
    - Category list: emoji + name + monthly total + YTD average
    - Color-coded category pills (10% opacity background, full saturation text)
    - Click category → filtered transaction list
  - [x] 25.8 Redesign remaining pages (chat, debt, cash flow, settings, import, rules, recurring, bank connections)
    - Apply consistent card styling, typography, and color system
    - Chat: message bubbles with distinct user/AI styling
    - Debt: schedule table with clean number alignment (tabular-nums)
    - Cash flow: area chart with gradient fill, below-zero zone highlighted in red
    - Settings: grouped sections with clear labels and toggles
  - [ ] 25.9 Add micro-interactions and polish
    - 150ms ease-out transitions on hover states
    - 200ms panel open/close animations
    - Framer Motion page transitions
    - Optimistic UI updates (immediate feedback, revert on failure)
    - Toast notifications: slide-in from top-right, auto-dismiss 5s
    - Skeleton loading for all data-dependent views
  - [ ] 25.10 Accessibility and responsiveness pass
    - Verify 4.5:1 contrast ratios for all text
    - Focus rings visible in both themes
    - ARIA labels on all interactive elements
    - Reduced-motion preference disables animations
    - Responsive breakpoints: 320px, 768px, 1024px, 1440px, 2560px
    - Test with screen reader (VoiceOver/NVDA)

- [ ] 26. Live demo instance with sample data
  - [ ] 26.1 Create demo seed dataset
    - Generate 6 months of realistic sample transactions (~500 transactions)
    - Sample accounts: Checking, Savings, Credit Card, Mortgage, Brokerage
    - Varied merchants, categories, amounts to showcase categorization and trends
    - Pre-configured budgets with some over/under budget categories
    - Recurring transactions: rent, utilities, subscriptions, salary
    - Sample debt payoff scenario (credit card + student loan)
    - Sample AI chat history showing typical interactions
    - Demo user credentials: demo@budgetapp.io / DemoPassword123
  - [ ] 26.2 Implement demo mode with data reset
    - Add DEMO_MODE=true environment variable
    - Demo mode: read-only bank connections (no real SimpleFIN calls)
    - Auto-reset demo data every 24 hours (cron job or on-login reset)
    - Banner at top: "This is a demo — data resets daily. Sign up for your own instance."
    - Disable: password change, backup restore, API key entry, real bank connections
    - AI chat works with mocked responses (no Ollama required for demo)
  - [ ] 26.3 Lightweight deploy configuration
    - Minimal Docker Compose for demo (no Ollama, no worker — just web + api + postgres + redis)
    - Reduce resource requirements: 1GB RAM, 1 CPU core, 5GB storage
    - Optional: Fly.io or Railway one-click deploy template
    - Optional: docker-compose.demo.yml with pre-built images from GitHub Container Registry
    - Health check endpoint returns demo status for monitoring
    - Add demo link to README and project landing page

## Future Features

- [x] 25. Bank account auto-connection (Plaid/SimpleFIN)
  - [x] 25.1 Evaluate and integrate a bank connection provider
    - Preferred: SimpleFIN (privacy-respecting, designed for self-hosted finance apps)
    - Alternative: Plaid, Teller, GoCardless (Nordigen)
    - Implement OAuth/token-based account linking flow
    - Auto-import transactions daily from linked accounts
    - Sync real account balances automatically
    - Add webhook handling for real-time transaction notifications
    - Add recurring sync job to worker (BullMQ queue)
    - Respect AI Privacy Mode — bank connection tokens stored encrypted (AES-256)
    - Provide UI for linking/unlinking accounts and managing connections

- [ ] 26. Income configuration and pay schedule
  - [ ] 26.1 Add income settings model and UI
    - Pay frequency options: Semi-monthly (1st & 15th), Semi-monthly (15th & last), Biweekly, Monthly, Custom
    - Expected net per paycheck amount
    - Employment type: Salary (fixed) vs Hourly (variable — average hours × rate)
    - Option to adjust for weekends (paid early if payday falls on Sat/Sun)
    - Store in UserSettings or new IncomeConfig model
  - [ ] 26.2 Update savings projection to use income configuration
    - Projection uses: income received + expected remaining paychecks this month
    - Salary: deterministic — knows exactly when and how much
    - Hourly: uses average hours × rate as estimate, adjusts as actuals post
    - Dashboard shows "Next paycheck: ~[date]" indicator
    - Projection formula: (received + expected remaining income) - (spent + projected remaining spend)

- [ ] 27. Budget rollovers
  - [ ] 27.1 Add rollover tracking to budget model
    - Track unspent amount per category at month end
    - Roll unspent balance forward to next month's allocation automatically
    - Show rollover amount separately from base allocation in UI ("$42.33 from Feb")
    - Allow user to opt-in/out of rollovers per category
    - Update Finance Engine budget calculations to include rollover amounts

- [ ] 28. Transaction review/inbox workflow
  - [ ] 28.1 Add review status to transactions
    - Add `reviewed` boolean field to Transaction model (default: false)
    - New transactions from bank sync and imports start as unreviewed
    - Manual transactions start as reviewed
    - Add "Mark as Reviewed" action (single and bulk)
    - Add filter for unreviewed transactions
    - Show unreviewed count badge in navigation
    - Dashboard shows "X transactions to review" indicator

- [ ] 29. Tags support
  - [ ] 29.1 Implement tag model and API
    - Create Tag model (id, name, color, userId) with many-to-many relation to transactions
    - Add CRUD endpoints: GET/POST/DELETE /api/tags
    - Add tag assignment to transactions (multiple tags per transaction)
    - Add tag filter to transaction search
    - Rules engine can auto-apply tags as an action type
    - UI: tag chips on transactions, tag management page, tag filter in search

- [ ] 30. Subscription management view
  - [ ] 30.1 Dedicated subscriptions UI and tracking
    - Create /subscriptions page showing all detected recurring charges
    - Group by: active, upcoming this month, annual renewals approaching
    - Show: merchant name, amount, frequency, next expected date, total annual cost
    - Allow marking subscriptions as "cancelled" (stops monitoring)
    - Show total monthly subscription burn rate on dashboard
    - Alert when a cancelled subscription still charges

- [ ] 31. Spending trends and monthly comparisons
  - [ ] 31.1 Add spending analytics endpoints and UI
    - GET /api/analytics/trends — month-over-month category spending comparison
    - GET /api/analytics/summary — income vs expenses, savings rate
    - Show per-category change indicators ("+$240 Groceries", "-$180 Recreation")
    - Dashboard widget: "This month vs last month" summary
    - Visualize 6-month or 12-month spending trends per category as line/bar charts

- [ ] 32. Proactive AI daily briefings
  - [ ] 32.1 Implement proactive AI assistant
    - Worker job (daily, configurable time) generates personalized financial briefing
    - Detects: unusual charges, budgets running hot, spending pattern shifts
    - Suggests: recategorizations, refund matches, new category proposals
    - Suggests where idle cash could be moved (savings goals)
    - Delivers via WebSocket notification + dedicated "Briefing" view in UI
    - Each suggestion is actionable with one-tap approve/dismiss
    - AI learns from dismissed suggestions to reduce noise over time

- [ ] 33. Spending pace line visualization
  - [ ] 33.1 Add daily spending pace chart to budget
    - Show cumulative daily spending as a line chart within each budget month
    - Overlay "ideal pace" line (total budget / days in month)
    - Indicate if user is currently under/over pace with dollar amount
    - Show on dashboard and budget detail page

- [ ] 34. Investment and portfolio tracking
  - [ ] 34.1 Add investment account support
    - New account types: BROKERAGE, RETIREMENT, CRYPTO
    - Holdings model: ticker/symbol, quantity, cost basis
    - Integrate market data API for live price updates (e.g., Yahoo Finance, Alpha Vantage)
    - Show: portfolio value, daily change %, asset allocation (equity/crypto/ETF/cash/bonds)
    - Track individual holding performance over time
    - Include investment accounts in net worth calculation

- [ ] 35. Real estate tracking
  - [ ] 35.1 Add property valuation support
    - New account type: REAL_ESTATE
    - Accept property address or Zillow/Redfin URL
    - Fetch and periodically refresh estimated market value
    - Calculate home equity (value minus mortgage balance if linked)
    - Include in net worth as an asset

- [ ] 36. Refund matching
  - [ ] 36.1 Detect and match refunds to original charges
    - When a credit arrives from same merchant as a prior debit, flag as potential refund
    - Match criteria: same merchant, amount ≤ original charge, within 90 days
    - Show matched pair in UI for confirmation
    - Confirmed refunds excluded from spending totals and budget tracking

- [ ] 37. Custom themes and color personalization
  - [ ] 37.1 Implement theme engine with user-defined colors
    - Add ThemeConfig model to UserSettings (accent color, background style, chart palette)
    - Provide preset themes: Midnight (default dark), Slate, Ocean, Forest, Sunset, Lavender, Mono
    - Each preset defines: accent color, secondary accent, chart color palette, surface tones
    - Allow custom accent color picker (hue wheel) that auto-generates full palette
    - Live preview: changes apply instantly as user adjusts
    - Store theme preference per user, sync across devices
  - [ ] 37.2 Build theme customization UI in settings
    - Settings → Appearance section with theme grid (visual swatches)
    - "Custom" option opens color picker for accent + optional background tint
    - Chart color palette selector (5-6 presets: Default, Pastel, Vibrant, Monochrome, Accessible)
    - Dark/Light/System toggle integrated with theme selection
    - Preview card showing how dashboard would look with selected theme
  - [ ] 37.3 Implement CSS variable–based theming
    - All colors reference CSS custom properties (already in ui-design.md system)
    - Theme switch updates :root variables — no page reload needed
    - Respect accessibility: auto-check contrast ratios, warn if custom accent is too low contrast
    - Export/import theme as JSON (for sharing between users or devices)
    - Category colors remain independently customizable per category

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "4.1"] },
    { "id": 4, "tasks": ["2.3", "2.4", "4.2", "4.3"] },
    { "id": 5, "tasks": ["2.5", "2.6", "4.4", "4.5"] },
    { "id": 6, "tasks": ["4.6", "4.7"] },
    { "id": 7, "tasks": ["4.8", "4.9"] },
    { "id": 8, "tasks": ["4.10", "6.1", "10.1"] },
    { "id": 9, "tasks": ["6.2", "6.3", "10.2"] },
    { "id": 10, "tasks": ["6.4", "10.3", "7.1"] },
    { "id": 11, "tasks": ["7.2", "7.3", "10.4"] },
    { "id": 12, "tasks": ["7.4", "8.1"] },
    { "id": 13, "tasks": ["8.2", "8.3"] },
    { "id": 14, "tasks": ["11.1"] },
    { "id": 15, "tasks": ["11.2", "11.3"] },
    { "id": 16, "tasks": ["11.4", "11.5", "11.6"] },
    { "id": 17, "tasks": ["12.1"] },
    { "id": 18, "tasks": ["12.2", "12.3"] },
    { "id": 19, "tasks": ["12.4", "13.1", "13.2"] },
    { "id": 20, "tasks": ["13.3", "13.4"] },
    { "id": 21, "tasks": ["15.1"] },
    { "id": 22, "tasks": ["15.2", "16.1"] },
    { "id": 23, "tasks": ["16.2", "17.1"] },
    { "id": 24, "tasks": ["17.2", "17.3"] },
    { "id": 25, "tasks": ["17.4", "17.5"] },
    { "id": 26, "tasks": ["17.6", "17.7"] },
    { "id": 27, "tasks": ["18.1", "18.2"] },
    { "id": 28, "tasks": ["18.3", "20.1"] },
    { "id": 29, "tasks": ["20.2", "20.3"] },
    { "id": 30, "tasks": ["21.1"] },
    { "id": 31, "tasks": ["22.1"] },
    { "id": 32, "tasks": ["22.2"] }
  ]
}
```
