/**
 * AI confidence thresholds and related constants.
 */

/**
 * Minimum confidence score for automatic category assignment.
 * If AI confidence >= this threshold, the category is applied without user confirmation.
 */
export const AI_CONFIDENCE_AUTO_ASSIGN = 0.85;

/**
 * Minimum confidence score for category suggestion.
 * If AI confidence >= this threshold but < AUTO_ASSIGN, suggest to the user.
 */
export const AI_CONFIDENCE_SUGGEST = 0.50;
