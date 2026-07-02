'use client';

/**
 * Category icon component that renders either an emoji or a colored circle
 * with initials. Supports custom colors for each category.
 *
 * Usage:
 *   <CategoryIcon emoji="🍔" color="#fb923c" />
 *   <CategoryIcon name="Groceries" color="#34d399" />
 *   <CategoryIcon emoji="🏠" color="#4a9eff" size="lg" />
 */

export interface CategoryIconProps {
  /** Emoji character to display */
  emoji?: string;
  /** Category name (used for initials fallback) */
  name?: string;
  /** Background color (hex or CSS variable) */
  color?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

/**
 * Default category icon set — maps common category names to emojis and colors.
 * Users can override these per category in settings.
 */
export const DEFAULT_CATEGORY_ICONS: Record<string, { emoji: string; color: string }> = {
  // Income
  'Income': { emoji: '💰', color: '#34d399' },
  'Salary': { emoji: '💼', color: '#34d399' },

  // Housing
  'Housing': { emoji: '🏠', color: '#4a9eff' },
  'Rent': { emoji: '🔑', color: '#4a9eff' },
  'Mortgage': { emoji: '🏡', color: '#4a9eff' },

  // Transportation
  'Transportation': { emoji: '🚙', color: '#fb923c' },
  'Car': { emoji: '🚗', color: '#fb923c' },
  'Gas': { emoji: '⛽', color: '#fb923c' },
  'Parking': { emoji: '🅿️', color: '#fb923c' },

  // Food
  'Groceries': { emoji: '🥑', color: '#34d399' },
  'Restaurants': { emoji: '🍽️', color: '#f87171' },
  'Dining': { emoji: '🍔', color: '#f87171' },
  'Coffee': { emoji: '☕', color: '#92400e' },
  'Food & Drink': { emoji: '🍕', color: '#f87171' },

  // Entertainment
  'Entertainment': { emoji: '🎬', color: '#a78bfa' },
  'Recreation': { emoji: '🎟️', color: '#a78bfa' },
  'Streaming': { emoji: '📺', color: '#a78bfa' },

  // Shopping
  'Shopping': { emoji: '🛍️', color: '#f472b6' },
  'Clothing': { emoji: '👕', color: '#f472b6' },

  // Utilities
  'Utilities': { emoji: '⚡', color: '#fbbf24' },
  'Internet': { emoji: '📡', color: '#fbbf24' },
  'Phone': { emoji: '📱', color: '#fbbf24' },

  // Health
  'Healthcare': { emoji: '🏥', color: '#f87171' },
  'Fitness': { emoji: '💪', color: '#34d399' },
  'Gym': { emoji: '🏋️', color: '#34d399' },

  // Insurance
  'Insurance': { emoji: '☂️', color: '#60a5fa' },

  // Subscriptions
  'Subscriptions': { emoji: '🔄', color: '#a78bfa' },

  // Education
  'Education': { emoji: '📚', color: '#2dd4bf' },

  // Personal Care
  'Personal Care': { emoji: '💅', color: '#f472b6' },

  // Gifts
  'Gifts': { emoji: '🎁', color: '#fb923c' },
  'Donations': { emoji: '❤️', color: '#f87171' },

  // Savings
  'Savings': { emoji: '🐷', color: '#34d399' },
  'Investment': { emoji: '📈', color: '#4a9eff' },

  // Debt
  'Debt Payment': { emoji: '💳', color: '#f87171' },

  // Transfers
  'Transfer': { emoji: '↔️', color: '#8b95a5' },

  // Uncategorized
  'Uncategorized': { emoji: '❓', color: '#5a6577' },
  'Other': { emoji: '📦', color: '#8b95a5' },
};

/**
 * Gets the icon config for a category name, falling back to defaults.
 */
export function getCategoryIcon(name?: string): { emoji: string; color: string } {
  if (!name) return { emoji: '📦', color: '#5a6577' };

  // Exact match
  if (DEFAULT_CATEGORY_ICONS[name]) return DEFAULT_CATEGORY_ICONS[name];

  // Case-insensitive match
  const lower = name.toLowerCase();
  const match = Object.entries(DEFAULT_CATEGORY_ICONS).find(
    ([key]) => key.toLowerCase() === lower
  );
  if (match) return match[1];

  // Partial match
  const partial = Object.entries(DEFAULT_CATEGORY_ICONS).find(
    ([key]) => lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)
  );
  if (partial) return partial[1];

  // Fallback: generate from name
  return { emoji: name.charAt(0).toUpperCase(), color: '#5a6577' };
}

export function CategoryIcon({ emoji, name, color, size = 'md', className = '' }: CategoryIconProps) {
  const defaults = getCategoryIcon(name);
  const displayEmoji = emoji || defaults.emoji;
  const displayColor = color || defaults.color;
  const sizeClass = SIZE_MAP[size];

  // Check if it's an actual emoji or just a letter
  const isEmoji = /\p{Emoji}/u.test(displayEmoji) && displayEmoji.length <= 4;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${sizeClass} ${className}`}
      style={{ backgroundColor: `${displayColor}20` }}
      aria-hidden="true"
    >
      {isEmoji ? (
        <span className="leading-none">{displayEmoji}</span>
      ) : (
        <span className="font-semibold leading-none" style={{ color: displayColor }}>
          {displayEmoji}
        </span>
      )}
    </span>
  );
}
