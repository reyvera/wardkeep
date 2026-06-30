# Requirements Document

## Introduction

This document defines the MVP requirements for an AI-powered personal finance application. The application is a private, self-hostable budgeting and finance assistant that helps users track spending, income, debt, savings, and cash flow. Unlike traditional finance tools that only display numbers, this application explains what is happening, predicts what is coming, and recommends actions — all while keeping user data private and under their control.

The MVP scope covers: manual accounts, CSV import, categories, monthly budgeting, transactions, a rules engine, AI categorization, AI chat assistant, debt payoff calculator, cash-flow forecast, Docker Compose deployment, PWA support, and encrypted backups.

**Key Design Principle:** AI is never the source of truth. Deterministic math handles balances, forecasts, debt calculations, and budgets. AI explains, categorizes, summarizes, detects patterns, and suggests actions.

## Glossary

- **App**: The AI Personal Finance application system
- **User**: An authenticated individual using the application
- **Account**: A financial account (checking, savings, credit card, loan, mortgage, cash, or manual) tracked within the application
- **Transaction**: A single financial event (debit or credit) associated with an Account
- **Category**: A classification label assigned to a Transaction (e.g., Groceries, Utilities, Entertainment)
- **Budget**: A monthly spending plan that allocates target amounts to Categories
- **Budget_Period**: A specific month within a Budget containing allocated amounts and actual spending
- **Rules_Engine**: A component that applies user-defined rules to automatically categorize, tag, or modify Transactions
- **Rule**: A user-defined condition-action pair used by the Rules_Engine to process Transactions
- **AI_Categorizer**: The AI component responsible for automatically assigning Categories to Transactions based on merchant name, amount, and context
- **AI_Chat_Assistant**: The AI component that answers natural-language questions about the User's financial data
- **Debt_Calculator**: The deterministic component that computes debt payoff schedules using snowball, avalanche, or custom strategies
- **Cash_Flow_Forecaster**: The deterministic component that projects future account balances based on recurring transactions and budget data
- **CSV_Importer**: The component that parses and imports transaction data from CSV, OFX, and QFX file formats
- **PWA**: Progressive Web App — a web application installable on devices that works offline
- **Docker_Compose**: The deployment orchestration tool used for self-hosted installation
- **Backup_Service**: The component responsible for creating and restoring encrypted application backups
- **AI_Privacy_Mode**: The configured mode determining whether AI processing occurs locally, in hybrid mode, or via cloud APIs
- **Finance_Engine**: The deterministic math engine that calculates balances, forecasts, debt schedules, and budget summaries

## Requirements

### Requirement 1: User Authentication and Session Management

**User Story:** As a user, I want to securely authenticate and manage my sessions, so that my financial data remains private and protected.

#### Acceptance Criteria

1. WHEN a User submits valid credentials (email and password), THE App SHALL authenticate the User and create a session within 2 seconds
2. WHEN a User submits invalid credentials, THE App SHALL reject the authentication attempt and display a generic error message without revealing whether the email or password was incorrect
3. WHEN a User session has been inactive (no API requests from the session) for 30 minutes, THE App SHALL expire the session and require re-authentication
4. THE App SHALL store passwords using bcrypt or argon2 hashing with a minimum cost factor of 10
5. WHEN a User requests password reset, THE App SHALL send a single-use, time-limited reset token to the User's registered email address, valid for 15 minutes
6. THE App SHALL enforce a minimum password length of 12 characters and a maximum password length of 128 characters
7. IF a User attempts more than 5 failed logins within 10 minutes, THEN THE App SHALL lock the account for 15 minutes and notify the User via their registered email address
8. WHEN a User successfully resets or changes their password, THE App SHALL invalidate all existing sessions for that User
9. IF a User attempts to use an expired or already-used password reset token, THEN THE App SHALL reject the request and display an error message indicating the token is no longer valid

### Requirement 2: Account Management

**User Story:** As a user, I want to create and manage financial accounts of various types, so that I can track all my money in one place.

#### Acceptance Criteria

1. THE App SHALL support the following account types: Checking, Savings, Credit Card, Loan, Mortgage, HELOC, Cash, and Manual
2. WHEN a User creates an Account, THE App SHALL require a name (1 to 100 characters), account type, currency, and initial balance
3. WHEN a User updates an Account balance manually, THE App SHALL record the adjustment as a reconciliation Transaction with a timestamp
4. THE App SHALL calculate and display the current balance for each Account by summing all associated Transactions from the initial balance
5. THE App SHALL display a net worth summary computed as the sum of asset Account balances (Checking, Savings, Cash, Manual) minus the sum of liability Account balances (Credit Card, Loan, Mortgage, HELOC)
6. WHEN a User archives an Account, THE App SHALL exclude the Account from active views and from the net worth summary while preserving all historical Transaction data
7. THE App SHALL support at least 50 Accounts per User
8. IF a User submits an Account creation request with missing required fields or a duplicate Account name within the same User, THEN THE App SHALL reject the request and display an error message indicating the validation failure

### Requirement 3: Transaction Management

**User Story:** As a user, I want to record, view, and manage my financial transactions, so that I have an accurate record of all money movement.

#### Acceptance Criteria

1. WHEN a User creates a Transaction, THE App SHALL require a date, an amount between 0.01 and 999,999,999.99, a transaction type (debit or credit), and an associated Account
2. IF a User submits a Transaction with missing or invalid required fields (no date, amount outside the valid range, or no associated Account), THEN THE App SHALL reject the Transaction and display an error message indicating which fields failed validation
3. THE App SHALL support both debit (expense/outflow) and credit (income/inflow) Transaction types
4. WHEN a User edits a Transaction, THE App SHALL recalculate the associated Account balance within 1 second
5. THE App SHALL allow Users to assign one Category, up to 20 tags (each up to 50 characters), a merchant name (up to 100 characters), and notes (up to 1000 characters) to each Transaction
6. WHEN a User searches Transactions, THE App SHALL support filtering by date range, Account, Category, tag, merchant, amount range, and free-text search (up to 200 characters)
7. THE App SHALL display Transactions in paginated lists of configurable size between 10 and 200 per page (default 50), sorted by date descending (most recent first)
8. WHEN a User deletes a Transaction, THE App SHALL prompt for confirmation and recalculate the Account balance within 1 second after deletion
9. WHEN a Transaction is created or imported, THE App SHALL detect and flag potential duplicate Transactions based on matching date, amount, and merchant within the same Account
10. WHEN duplicate Transactions are detected, THE App SHALL present them to the User for manual resolution (keep, merge, or delete)

### Requirement 4: CSV and File Import

**User Story:** As a user, I want to import transactions from bank export files, so that I can quickly populate my account history without manual entry.

#### Acceptance Criteria

1. THE CSV_Importer SHALL support CSV, OFX, and QFX file formats for Transaction import
2. WHEN a User uploads an import file, THE CSV_Importer SHALL require the User to select a target Account, parse the file, and present a preview of the first 10 detected Transactions before committing
3. WHEN a CSV file is uploaded, THE CSV_Importer SHALL allow the User to map file columns to Transaction fields (date, amount, description, category)
4. THE CSV_Importer SHALL detect and exclude duplicate Transactions during import by performing a case-insensitive comparison of date, amount, and trimmed description against existing Transactions in the target Account
5. IF an import file contains malformed or unparseable rows, THEN THE CSV_Importer SHALL skip the invalid rows, import valid rows, and report the count and line numbers of skipped rows to the User
6. WHEN an import is completed, THE CSV_Importer SHALL display a summary showing: total rows processed, Transactions imported, duplicates skipped, and errors encountered
7. IF an import file exceeds 10MB in size or contains more than 50,000 rows, THEN THE CSV_Importer SHALL reject the file and display an error message indicating the size or row limit that was exceeded
8. WHEN a User imports Transactions, THE CSV_Importer SHALL apply the Rules_Engine to imported Transactions for automatic categorization
9. THE CSV_Importer SHALL maintain a round-trip property such that parsing a valid import file, exporting the resulting Transactions, and re-parsing the export SHALL produce Transactions with matching date, amount, description, and category values

### Requirement 5: Category Management

**User Story:** As a user, I want to organize transactions into categories, so that I can understand my spending patterns and build budgets around them.

#### Acceptance Criteria

1. THE App SHALL provide a default set of Categories including: Income, Housing, Utilities, Groceries, Transportation, Healthcare, Entertainment, Dining, Shopping, Insurance, Education, Personal Care, Gifts, Subscriptions, Debt Payment, Savings, and Uncategorized
2. WHEN a User creates a custom Category, THE App SHALL require a unique name between 1 and 50 characters and allow an optional icon and color
3. THE App SHALL support one level of sub-categories (parent-child relationship) where a sub-category belongs to exactly one parent Category and cannot itself be a parent
4. WHEN a User requests deletion of a Category, THE App SHALL prompt the User for confirmation and, upon confirmation, reassign all associated Transactions to Uncategorized; IF the deleted Category is a parent, THEN THE App SHALL also reassign all Transactions in its sub-categories to Uncategorized and delete the sub-categories
5. THE App SHALL prevent deletion of the Uncategorized Category
6. WHEN a User merges two Categories, THE App SHALL reassign all Transactions from the source Category (and its sub-categories) to the target Category, delete the source Category's sub-categories, and delete the source Category
7. THE App SHALL support at least 200 Categories per User including sub-categories
8. IF a User attempts to create a Category with a name that already exists within the same parent scope, THEN THE App SHALL reject the creation and display an error message indicating the name is already in use

### Requirement 6: Monthly Budget Management

**User Story:** As a user, I want to create monthly budgets with category-based spending limits, so that I can plan and control my spending.

#### Acceptance Criteria

1. WHEN a User creates a Budget, THE App SHALL allow allocation of target amounts to each Category for a given month, where each target amount is a positive value between 0.01 and 999,999,999.99 in the Account currency, and only one Budget may exist per User per month
2. IF a User attempts to create a Budget with an invalid target amount (zero, negative, or exceeding 999,999,999.99), THEN THE App SHALL reject the allocation and display an error message indicating the valid range
3. THE App SHALL calculate actual spending per Category by summing all expense Transactions assigned to that Category within the Budget_Period
4. THE App SHALL display budget progress as the percentage of target amount spent per Category, updated within 5 seconds of a new Transaction
5. WHEN spending in a Category exceeds 90% of the allocated amount, THE App SHALL notify the User with an in-app warning indicating the Category name and current percentage spent
6. WHEN spending in a Category exceeds the allocated amount, THE App SHALL mark the Category as overspent and notify the User with an in-app alert indicating the Category name and overspent amount
7. WHEN a User copies a Budget from a previous month as a template, THE App SHALL copy all allocations for Categories that still exist and exclude allocations for any deleted Categories from the new Budget
8. THE App SHALL display a monthly budget summary showing total allocated, total spent, total remaining, and number of overspent Categories
9. THE Finance_Engine SHALL compute all budget calculations deterministically using precise decimal arithmetic (no floating-point currency errors)

### Requirement 7: Rules Engine

**User Story:** As a user, I want to define rules that automatically categorize and tag my transactions, so that I spend less time on manual data entry.

#### Acceptance Criteria

1. WHEN a User creates a Rule, THE Rules_Engine SHALL require at least one condition and at least one action
2. THE Rules_Engine SHALL support conditions based on: merchant name (contains, equals, starts with, regex), amount (equals, greater than, less than, between), and description (contains, equals, regex), combined using ALL-match (AND) or ANY-match (OR) logic as specified by the User per Rule
3. THE Rules_Engine SHALL support actions including: assign Category, add tag, set merchant name, and add note
4. WHEN a new Transaction is created or imported, THE Rules_Engine SHALL evaluate all active Rules in priority order and apply matching Rule actions
5. WHEN multiple Rules match a single Transaction, THE Rules_Engine SHALL apply them in priority order where lower numbers execute first; for conflicting actions on the same field (Category, merchant name), the later Rule's value SHALL override the earlier; for additive actions (tags, notes), the later Rule's value SHALL be appended without removing earlier additions
6. THE App SHALL allow Users to test a Rule against existing Transactions without applying changes (dry-run mode) and display a list of Transactions that would match, along with the specific actions that would be applied to each
7. WHEN a User applies a Rule retroactively, THE Rules_Engine SHALL process all matching historical Transactions and report the count of affected Transactions
8. THE Rules_Engine SHALL process a batch of 1000 Transactions against up to 100 active Rules within 10 seconds
9. IF a User creates a Rule with an invalid condition (malformed regex or reference to a nonexistent Category), THEN THE Rules_Engine SHALL reject the Rule, not save it, and indicate which condition or action is invalid
10. WHEN a User creates a Rule without specifying a priority, THE Rules_Engine SHALL assign the next available priority number (one greater than the current highest)

### Requirement 8: AI Transaction Categorization

**User Story:** As a user, I want the AI to automatically suggest categories for my transactions, so that categorization happens with minimal manual effort.

#### Acceptance Criteria

1. WHEN a Transaction has no Category assigned, THE AI_Categorizer SHALL suggest exactly one Category from the User's existing Category list, based on merchant name, amount, and transaction description
2. THE AI_Categorizer SHALL provide a confidence score between 0.00 and 1.00 (inclusive, two decimal places) for each suggestion
3. WHEN the AI_Categorizer confidence score is greater than 0.85, THE App SHALL auto-assign the suggested Category and mark the Transaction as AI-categorized
4. WHEN the AI_Categorizer confidence score is greater than or equal to 0.50 and less than or equal to 0.85, THE App SHALL present the suggestion to the User for confirmation before assigning
5. WHEN the AI_Categorizer confidence score is less than 0.50, THE App SHALL assign the Transaction to Uncategorized and display a manual-review indicator on the Transaction in list views
6. WHEN a User overrides an AI-assigned Category, THE AI_Categorizer SHALL record the merchant name and the User-selected Category, and subsequent suggestions for Transactions with the same merchant name SHALL reflect the User's correction
7. THE AI_Categorizer SHALL process Transactions exclusively using the infrastructure designated by the configured AI_Privacy_Mode (local via Ollama, hybrid, or cloud API)
8. WHILE AI_Privacy_Mode is set to local, THE AI_Categorizer SHALL process a batch of 100 uncategorized Transactions within 30 seconds
9. IF the AI_Categorizer service is unavailable or returns an error during categorization, THEN THE App SHALL leave affected Transactions as Uncategorized, notify the User that AI categorization is temporarily unavailable, and retry categorization on the next batch processing cycle

### Requirement 9: AI Chat Assistant

**User Story:** As a user, I want to ask natural-language questions about my finances, so that I can quickly understand my financial situation without navigating complex reports.

#### Acceptance Criteria

1. WHEN a User submits a natural-language question of up to 500 characters, THE AI_Chat_Assistant SHALL generate a response based on the User's financial data within 10 seconds
2. THE AI_Chat_Assistant SHALL answer questions about: spending by category, spending by merchant, account balances, budget status, transactions within the last 90 days, and spending trends over the last 6 months
3. WHEN the AI_Chat_Assistant references a named amount, balance, sum, or computed value, THE App SHALL display the underlying numerical data alongside the AI-generated explanation
4. IF the AI_Chat_Assistant cannot determine an answer from available data, THEN THE AI_Chat_Assistant SHALL state that the information is unavailable rather than generating speculative content
5. THE AI_Chat_Assistant SHALL maintain conversation context within a session for up to 10 previous question-response pairs
6. THE AI_Chat_Assistant SHALL respect the configured AI_Privacy_Mode when processing queries
7. WHEN the AI_Chat_Assistant provides numerical claims, THE Finance_Engine SHALL independently verify the calculations, and IF any non-zero discrepancy exists between the AI output and the deterministic computation, THEN THE App SHALL display the verified value to the User with a warning indicating the AI-generated value was corrected
8. THE AI_Chat_Assistant SHALL never recommend specific financial products, investment securities, or provide tax advice
9. IF a User submits an empty question or a question that contains no recognizable query intent, THEN THE AI_Chat_Assistant SHALL respond with a message indicating the question could not be interpreted and prompt the User to rephrase

### Requirement 10: Debt Payoff Calculator

**User Story:** As a user, I want to calculate debt payoff schedules using different strategies, so that I can choose the most effective approach to become debt-free.

#### Acceptance Criteria

1. THE Debt_Calculator SHALL support snowball (lowest balance first), avalanche (highest interest rate first), and custom priority ordering strategies for up to 50 debts simultaneously
2. WHEN a User selects a payoff strategy, THE Debt_Calculator SHALL generate a month-by-month payment schedule showing: payment amount, principal paid, interest paid, and remaining balance for each debt, with interest calculated monthly using the debt's annual percentage rate (APR) divided by 12
3. THE Debt_Calculator SHALL compute total interest paid over the life of the payoff plan for each strategy
4. WHEN a User specifies an extra monthly payment amount between 0.01 and 999,999.99, THE Debt_Calculator SHALL recalculate the schedule incorporating the extra payment distributed according to the selected strategy (snowball: applied to lowest-balance debt first; avalanche: applied to highest-rate debt first; custom: applied in user-defined priority order)
5. THE Debt_Calculator SHALL display the projected debt-free date for each strategy, capped at a maximum projection horizon of 30 years (360 months)
6. THE Debt_Calculator SHALL compute the interest savings compared between strategies (e.g., avalanche savings vs. snowball) expressed as a currency amount and as a time difference in months
7. WHEN a User modifies debt parameters (balance, rate, minimum payment), THE Debt_Calculator SHALL recalculate all projections within 2 seconds
8. THE Finance_Engine SHALL perform all debt calculations using deterministic amortization formulas with decimal arithmetic to 2 decimal places for currency values and at least 10 decimal places for intermediate interest calculations
9. THE Debt_Calculator SHALL support a "what-if" mode allowing Users to simulate adding new debt or changing interest rates without affecting actual Account data
10. IF a User submits a debt with a balance less than 0, an interest rate outside the range 0% to 100% APR, or a minimum payment less than 0.01, THEN THE Debt_Calculator SHALL reject the input and display an error message indicating which parameter is out of range
11. IF the sum of all minimum payments across debts exceeds the User's specified total monthly payment amount, THEN THE Debt_Calculator SHALL display a warning indicating insufficient funds to cover minimum payments and shall not generate a payoff schedule until the total payment amount meets or exceeds the sum of minimum payments

### Requirement 11: Cash-Flow Forecast

**User Story:** As a user, I want to see projected future account balances, so that I can plan ahead and avoid overdrafts or cash shortfalls.

#### Acceptance Criteria

1. THE Cash_Flow_Forecaster SHALL project daily account balances for each Account for up to 90 days starting from the current date, using the Account's current calculated balance as the starting point
2. THE Cash_Flow_Forecaster SHALL incorporate recurring Transactions (detected or manually defined) into projections
3. THE Cash_Flow_Forecaster SHALL incorporate scheduled bill due dates into projections
4. WHEN projected balance for any Account falls below zero within the forecast period, THE App SHALL display an in-app notification to the User indicating the Account name, the projected date of the shortfall, and the projected negative amount
5. WHEN a User adds or modifies a recurring Transaction, THE Cash_Flow_Forecaster SHALL recalculate projections within 5 seconds
6. THE Cash_Flow_Forecaster SHALL display projections as both a line chart showing daily balance over time and a tabular day-by-day breakdown listing date, projected credits, projected debits, and ending balance
7. THE Finance_Engine SHALL compute all cash-flow projections using deterministic arithmetic based on known recurring transactions and budget allocations
8. WHEN a User adds a one-time expected future Transaction, THE Cash_Flow_Forecaster SHALL require a date, amount, associated Account, and description, and incorporate it into projections
9. IF no recurring Transactions or scheduled bills exist for an Account, THEN THE Cash_Flow_Forecaster SHALL project a flat balance equal to the Account's current balance for the full 90-day forecast period

### Requirement 12: Recurring Transaction Detection

**User Story:** As a user, I want the app to automatically detect recurring transactions, so that I can track bills and subscriptions without manual setup.

#### Acceptance Criteria

1. THE App SHALL analyze Transaction history to detect recurring patterns based on amounts within 10% of each other, matching merchant names, and regular intervals
2. WHEN a recurring pattern is detected (at least 3 occurrences within a consistent interval ±3 days), THE App SHALL flag the Transaction series as a potential recurring Transaction
3. WHEN the App detects a recurring Transaction, THE App SHALL present the detected merchant name, average amount, detected frequency, and number of matched occurrences to the User for confirmation or dismissal
4. WHEN a User confirms a recurring Transaction, THE App SHALL record the merchant, expected amount, frequency, and next expected date
5. WHEN a confirmed recurring Transaction is expected but not received within 5 days of the expected date, THE App SHALL notify the User of the missed occurrence
6. THE App SHALL support weekly, bi-weekly, monthly, quarterly, semi-annual, and annual recurrence frequencies
7. IF a User dismisses a detected recurring pattern, THEN THE App SHALL suppress that pattern from future detection suggestions unless the User manually re-enables detection for that merchant
8. WHEN a User deactivates a confirmed recurring Transaction, THE App SHALL stop monitoring for missed occurrences and exclude it from the Cash_Flow_Forecaster projections

### Requirement 13: Progressive Web App

**User Story:** As a user, I want to access the app from any device as an installable web application, so that I have a native-like experience without app store dependencies.

#### Acceptance Criteria

1. THE App SHALL serve a valid Web App Manifest enabling installation on iOS, Android, Windows, Mac, and Linux devices
2. THE App SHALL implement a service worker that caches the application shell and previously loaded data for offline access, retaining cached data for up to 7 days since last successful sync
3. WHEN network connectivity is lost, THE App SHALL display a visible offline indicator, present cached data in read-only mode, and queue user actions (up to 100 actions) for synchronization when connectivity resumes
4. WHEN network connectivity is restored, THE App SHALL synchronize queued actions within 30 seconds, resolve conflicts using a last-write-wins strategy based on timestamp, and notify the User of any conflicts that were auto-resolved
5. IF synchronization of a queued action fails after 3 retry attempts, THEN THE App SHALL mark the action as failed, notify the User, and preserve the failed action for manual review or retry
6. THE App SHALL achieve a Lighthouse PWA score of 90 or higher
7. THE App SHALL achieve a Largest Contentful Paint (LCP) of 3 seconds or less when measured under simulated 4G conditions (1.6 Mbps throughput, 150ms RTT)
8. THE App SHALL implement responsive layouts that render all interactive elements visible, accessible, and operable without horizontal scrolling on screen widths from 320px to 2560px
9. IF the offline action queue reaches its maximum capacity of 100 actions, THEN THE App SHALL prevent further queuing, inform the User that the queue is full, and indicate that connectivity must be restored before additional actions can be performed

### Requirement 14: Docker Compose Deployment

**User Story:** As a self-hosting user, I want to deploy the entire application with a single Docker Compose command, so that I can run the app privately on my own hardware.

#### Acceptance Criteria

1. THE App SHALL provide a Docker Compose configuration that starts all required services (web app, API server, PostgreSQL database, Redis cache, and background worker) with a single command, and all services SHALL reach a healthy state within 120 seconds on hardware meeting minimum requirements
2. WHEN a User runs the Docker Compose stack for the first time, THE App SHALL automatically run database migrations and create default data (categories, settings) before the API server begins accepting client requests
3. THE App SHALL expose configuration through environment variables for: database credentials, AI_Privacy_Mode, backup schedule, session timeout, and external AI API keys
4. WHILE AI_Privacy_Mode is set to Local, THE App SHALL function fully without requiring any external network connections after initial image pull; WHILE AI_Privacy_Mode is set to Cloud or Hybrid, THE App SHALL function for all non-AI features without external network connections
5. WHEN a User upgrades to a new version, THE App SHALL apply database migrations automatically on startup without data loss
6. IF a database migration fails during startup, THEN THE App SHALL abort the startup, log the migration error, and preserve the existing database state without partial schema changes
7. THE App SHALL provide health check endpoints for all services that respond within 5 seconds, returning a clear pass or fail status that Docker Compose can monitor at configurable intervals (default: 30 seconds)
8. THE App SHALL persist all User data (database contents, uploaded files, and configuration) in named volumes that survive container restarts, upgrades, and recreation of containers
9. THE App SHALL document minimum hardware requirements: 2GB RAM, 2 CPU cores, 10GB storage

### Requirement 15: Encrypted Backups

**User Story:** As a user, I want to create encrypted backups of all my financial data, so that I can recover from data loss without exposing sensitive information.

#### Acceptance Criteria

1. WHEN a User initiates a backup, THE Backup_Service SHALL export all User data (Accounts, Transactions, Categories, Budgets, Rules, and settings) into a single encrypted archive and complete the operation within 60 seconds for datasets up to 100,000 Transactions
2. THE Backup_Service SHALL encrypt backups using AES-256-GCM with a User-provided passphrase of at least 12 characters
3. WHEN a User restores a backup with the correct passphrase, THE Backup_Service SHALL validate the archive's authentication tag and data integrity before replacing existing data
4. IF a backup restore encounters integrity validation failure or an incorrect passphrase, THEN THE Backup_Service SHALL abort the restore without modifying existing data and report an error message indicating the failure reason to the User
5. THE Backup_Service SHALL support scheduled automatic backups at User-configured intervals (daily, weekly, or monthly) using a stored passphrase that the User provides during backup schedule configuration
6. THE Backup_Service SHALL retain a configurable number of backup versions between 1 and 30 (default: 5) and automatically delete the oldest backup when the retention limit is exceeded
7. THE Backup_Service SHALL support exporting backup files to local filesystem and user-specified remote paths
8. FOR ALL User data, creating a backup then restoring from that backup SHALL produce a data state functionally equivalent to the original, preserving all record values and relationships (round-trip property)

### Requirement 16: AI Privacy Mode Configuration

**User Story:** As a user, I want to control how and where my financial data is processed by AI, so that I can balance functionality with privacy based on my comfort level.

#### Acceptance Criteria

1. THE App SHALL support three AI_Privacy_Modes: Local (all AI processing via local Ollama instance), Hybrid (non-sensitive queries to cloud, sensitive data processed locally), and Cloud (all AI processing via external API with user consent), where sensitive data is defined as any data containing account balances, account numbers, transaction amounts, merchant names, or personally identifying financial information
2. WHEN a User selects Local mode, THE App SHALL process all AI requests using the local Ollama instance without transmitting any financial data externally
3. WHEN a User selects Cloud mode, THE App SHALL display a warning that identifies the external service, the types of financial data that will be transmitted, and the data retention policy, and SHALL require explicit confirmation before activating the mode
4. THE App SHALL allow Users to provide their own API keys for external AI services (OpenAI, Anthropic) and SHALL validate the key format before saving
5. IF no AI service is configured or available, THEN THE App SHALL function fully for all non-AI features (accounts, transactions, budgets, debt calculator, manual categorization) and SHALL display a notification indicating AI features are unavailable
6. THE App SHALL never transmit financial data to external services without explicit User consent tied to the configured AI_Privacy_Mode
7. WHEN a User changes AI_Privacy_Mode, THE App SHALL apply the change to all subsequent AI requests within 2 seconds without requiring restart
8. IF the local Ollama instance is unreachable while AI_Privacy_Mode is set to Local or Hybrid, THEN THE App SHALL queue the AI request, notify the User that local AI is unavailable, and SHALL NOT fall back to cloud processing
9. IF a User-provided API key is rejected by the external AI service, THEN THE App SHALL notify the User that the key is invalid, disable cloud AI features until a valid key is provided, and preserve any pending AI requests for retry

### Requirement 17: Data Security and Encryption

**User Story:** As a user, I want my sensitive financial data encrypted at rest, so that even if the storage is compromised, my data remains protected.

#### Acceptance Criteria

1. THE App SHALL encrypt sensitive database fields (account numbers, API keys, AI conversation history) using AES-256 encryption at the application layer
2. THE App SHALL store encryption keys separately from the encrypted data using environment variables or a secrets manager, ensuring no encryption key is persisted in the same storage system as the encrypted data it protects
3. WHILE in a production deployment, THE App SHALL enforce HTTPS with TLS 1.2 or higher for all client-server communication and reject non-HTTPS requests
4. WHEN a User exports data, THE App SHALL offer an encrypted export option using the same passphrase-based encryption as backups, and a plaintext export option
5. THE App SHALL implement per-User data isolation at the database query layer ensuring no User can access another User's financial data
6. IF a database query attempts to access data belonging to a different User, THEN THE App SHALL deny the request, return an authorization error, and log the violation to the audit log
7. THE App SHALL log all authentication events (login, logout, failed attempts, password changes), data exports, backup operations, and account management actions (user creation, deletion, role changes) to an append-only audit log retained for a minimum of 90 days
8. THE App SHALL implement rate limiting of 100 requests per minute per User for API endpoints and 10 requests per minute for authentication endpoints
9. IF a User exceeds the rate limit, THEN THE App SHALL reject subsequent requests with a rate-limit error response indicating the wait time in seconds until the limit resets
