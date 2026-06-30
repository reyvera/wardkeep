/**
 * Application-wide field limits and resource caps.
 */

// ─── Resource Caps ──────────────────────────────────────────────────────────────

/** Maximum number of accounts a single user can create. */
export const MAX_ACCOUNTS_PER_USER = 50;

/** Maximum number of categories a single user can create. */
export const MAX_CATEGORIES_PER_USER = 200;

/** Maximum number of tags per transaction. */
export const MAX_TAGS_PER_TRANSACTION = 20;

/** Maximum number of debt accounts for projection calculations. */
export const MAX_DEBTS = 50;

/** Maximum projection horizon in months. */
export const MAX_PROJECTION_MONTHS = 360;

/** Cash flow analysis window in days. */
export const CASH_FLOW_DAYS = 90;

// ─── Field Length Limits ────────────────────────────────────────────────────────

/** Maximum length of a transaction tag. */
export const TAG_MAX_LENGTH = 50;

/** Maximum length of a merchant name. */
export const MERCHANT_MAX_LENGTH = 100;

/** Maximum length of transaction notes. */
export const NOTES_MAX_LENGTH = 1000;

/** Maximum length of an account name. */
export const ACCOUNT_NAME_MAX_LENGTH = 100;

/** Maximum length of a category name. */
export const CATEGORY_NAME_MAX_LENGTH = 50;

/** Maximum length of a description field. */
export const DESCRIPTION_MAX_LENGTH = 500;

// ─── Amount Limits ──────────────────────────────────────────────────────────────

/** Minimum transaction amount. */
export const MIN_AMOUNT = 0.01;

/** Maximum transaction amount. */
export const MAX_AMOUNT = 999_999_999.99;

// ─── Password Requirements ──────────────────────────────────────────────────────

/** Minimum password length. */
export const PASSWORD_MIN_LENGTH = 12;

/** Maximum password length. */
export const PASSWORD_MAX_LENGTH = 128;

// ─── Rate Limiting ──────────────────────────────────────────────────────────────

/** API requests per minute per user. */
export const RATE_LIMIT_API = 100;

/** Auth endpoint requests per minute. */
export const RATE_LIMIT_AUTH = 10;

/** Maximum consecutive failed login attempts before lockout. */
export const MAX_FAILED_LOGINS = 5;

/** Window in minutes during which failed login attempts are counted. */
export const FAILED_LOGIN_WINDOW_MINUTES = 10;

/** Account lockout duration in minutes after exceeding failed logins. */
export const LOCKOUT_DURATION_MINUTES = 15;

/** Password reset token expiry in minutes. */
export const RESET_TOKEN_EXPIRY_MINUTES = 15;

// ─── Session ────────────────────────────────────────────────────────────────────

/** Default session timeout in minutes. */
export const SESSION_TIMEOUT_MINUTES = 30;
