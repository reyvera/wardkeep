---
inclusion: auto
---

# UI Design System — Copilot Money–Inspired

This design system captures the visual language and interaction patterns of Copilot Money,
adapted for our Next.js + Tailwind stack. The goal is a premium, data-rich finance app
that feels native, fast, and elegant.

## Design Philosophy

- **Data density without clutter** — Show rich financial information with clear hierarchy
- **Premium feel** — Smooth transitions, polished micro-interactions, generous whitespace
- **Dark mode first** — Primary experience is dark; light mode is secondary
- **Charts are first-class citizens** — Financial data is visual by default
- **Contextual actions** — Quick edits inline, bulk operations, keyboard shortcuts
- **Trust through clarity** — Exact numbers, transparent calculations, no ambiguity

## Color Palette

### Dark Mode (Primary)

```
Background:
  --bg-primary: #0D0F12          /* App background — near-black with blue undertone */
  --bg-secondary: #151921        /* Card/panel backgrounds */
  --bg-elevated: #1C2230         /* Hover states, elevated cards */
  --bg-input: #1A1F2B            /* Input fields */

Text:
  --text-primary: #F0F2F5        /* Primary text — off-white */
  --text-secondary: #8B95A5      /* Secondary/muted text — blue-gray */
  --text-tertiary: #5A6577       /* Disabled/placeholder text */

Borders:
  --border-default: #232A36      /* Subtle separators */
  --border-hover: #2F3845        /* Hover state borders */

Accent Colors:
  --accent-blue: #4A9EFF         /* Primary actions, active nav, links */
  --accent-green: #34D399        /* Income, positive values, credits */
  --accent-red: #F87171          /* Expenses, negative values, alerts */
  --accent-yellow: #FBBF24       /* Warnings, budget thresholds */
  --accent-purple: #A78BFA       /* Investments, net worth */
  --accent-orange: #FB923C       /* Over-budget indicators */

Chart Colors (ordered):
  --chart-1: #4A9EFF            /* Blue */
  --chart-2: #34D399            /* Green */
  --chart-3: #A78BFA            /* Purple */
  --chart-4: #FB923C            /* Orange */
  --chart-5: #F87171            /* Red */
  --chart-6: #FBBF24            /* Yellow */
  --chart-7: #2DD4BF            /* Teal */
  --chart-8: #F472B6            /* Pink */
```

### Light Mode (Secondary)

```
Background:
  --bg-primary: #FFFFFF
  --bg-secondary: #F8FAFB
  --bg-elevated: #FFFFFF
  --bg-input: #F3F5F7

Text:
  --text-primary: #0D0F12
  --text-secondary: #5A6577
  --text-tertiary: #8B95A5

Borders:
  --border-default: #E5E8EC
  --border-hover: #D1D5DB
```

## Typography

- **Font family**: `Inter` (primary), system-ui as fallback
- **Font weights**: 400 (body), 500 (medium/labels), 600 (semibold/headings), 700 (bold/numbers)
- **Scale**:
  - Page title: 24px / 600 weight / -0.02em tracking
  - Section heading: 18px / 600 weight
  - Card title: 14px / 500 weight / uppercase / letter-spacing 0.05em / text-secondary color
  - Body: 14px / 400 weight
  - Caption/metadata: 12px / 400 weight / text-secondary
  - Large numbers (balance, net worth): 32-40px / 700 weight / tabular-nums
  - Money amounts in lists: 14-16px / 600 weight / tabular-nums / monospace for alignment

## Spacing & Layout

- **Sidebar width**: 240px (collapsible to icon-only 64px)
- **Content max-width**: 1200px centered
- **Page padding**: 32px (desktop), 16px (mobile)
- **Card padding**: 24px
- **Card gap**: 16px (grid gap between cards)
- **Card border-radius**: 12px
- **Section spacing**: 32px between major sections
- **List item height**: 56px (transaction rows), 48px (account rows)

## Component Patterns

### Navigation Sidebar

- Fixed left sidebar, dark background (#0D0F12)
- Logo/brand at top
- Icon + label for each nav item
- Active state: light blue background tint + blue text + left border accent
- Hover: subtle bg change (#1C2230)
- Bottom section: user avatar + settings gear
- On mobile: bottom tab bar instead of sidebar (5 most important tabs)

### Cards

- Dark background (#151921) with subtle 1px border (#232A36)
- 12px border-radius
- Section title in uppercase small text above content
- No outer shadow in dark mode; 1px border provides depth
- Light mode: white background + subtle shadow (0 1px 3px rgba(0,0,0,0.08))

### Transaction List

- Each row: date | emoji/icon + merchant name | category pill | amount
- Amount: green for credits, default for debits
- Light-blue dot indicator for unreviewed transactions (left edge)
- Hover: show quick-action icons (categorize, review, flag)
- Selected state: blue highlight + checkbox
- Keyboard navigation: arrow keys to move, X to select, R to review, C to categorize

### Progress Bars (Budget)

- Height: 8px, rounded-full
- Background track: bg-elevated (#1C2230)
- Fill: gradient from accent-blue to accent-green (under budget)
- Fill at 90%+: accent-yellow
- Fill at 100%+: accent-red (overspent portion extends past track as subtle overshoot)
- Label above: category name (left) + "$X of $Y" (right)
- Below: remaining amount or overspent amount

### Charts

- Clean, minimal axes — only horizontal grid lines, light (#232A36)
- Smooth curved lines (not jagged)
- Area fills: gradient from color at top to transparent at bottom
- Interactive: hover reveals tooltip with exact value + date
- Time period selectors: 1W | 1M | 3M | 6M | 1Y | ALL (pill buttons)
- Green for positive trends, red for negative

### Amounts & Numbers

- Always use `tabular-nums` font feature for alignment
- Positive: #34D399 (green) with optional + prefix
- Negative: #F87171 (red) with − prefix
- Neutral: default text color
- Large hero numbers: 32-40px bold, no currency symbol clutter (show "$" smaller/lighter)
- Percentage changes: pill/badge with up/down arrow icon

### Category Pills

- Small rounded pill (border-radius: 6px)
- Each category has assigned emoji + color
- Background: color at 10% opacity
- Text: color at full saturation
- Compact: just emoji + name, no border

### Empty States

- Center-aligned illustration or icon (subtle, not cartoonish)
- Short headline explaining what goes here
- Single CTA button to add first item
- Tone: helpful, not patronizing

### Buttons

- Primary: bg-accent-blue, white text, rounded-lg, 500 weight
- Secondary: bg-transparent, border, text-secondary, hover: bg-elevated
- Destructive: bg-accent-red (only in modals/confirmations)
- Size: 36px height (compact), 40px (default), 48px (large/hero)
- Icon buttons: 32x32px, rounded-md, subtle hover bg

### Inputs

- bg-input background, 1px border
- Focus: ring-2 ring-accent-blue/50
- 40px height, 12px horizontal padding
- Placeholder: text-tertiary
- Labels: 12px, 500 weight, text-secondary, above input with 4px gap

### Notifications & Alerts

- Slide in from top-right
- Compact card with icon + message + timestamp
- Types: info (blue), success (green), warning (yellow), error (red)
- Auto-dismiss after 5s, manually dismissable

## Page-Specific Patterns

### Dashboard

- Top: Net worth hero number with trend indicator (↑ $X,XXX this month)
- Below: 2-3 column grid of summary cards:
  - Spending this month (vs budget or vs last month)
  - Upcoming bills (next 7 days)
  - Recent transactions (last 5, quick-reviewable)
  - Cash flow mini-chart (sparkline)
- Accounts sidebar or section showing all accounts with balances

### Transactions

- Top: search bar + filter chips (account, category, date, type, review status, tag)
- Summary bar: "Total spent: $X | Total income: $X | Net: $X" for filtered results
- Table: sortable by date or amount
- Bulk selection bar appears when items selected
- Infinite scroll or pagination at bottom

### Budget

- Month selector (← June 2026 →)
- Spending pace line chart at top (daily cumulative vs ideal pace)
- Category breakdown below: progress bars with spent/allocated/remaining
- Rollover indicator per category when applicable

### Accounts

- List with: account name | institution | type badge | balance | sparkline trend
- Click → detail view with full balance history chart + account transactions
- Net worth summary card at top

### Categories (Spending)

- Donut or horizontal bar chart showing spending distribution
- Below: list of categories with monthly total + YTD average
- Tap category → see transactions in that category

## Interaction Patterns

- **Transitions**: 150ms ease-out for hover states, 200ms for panel open/close
- **Skeleton loading**: pulse animation on card-shaped placeholders while data loads
- **Optimistic updates**: UI updates immediately, reverts on API failure
- **Pull-to-refresh** on mobile
- **Keyboard-first** on desktop: common shortcuts documented in a ? modal

## Accessibility

- Color is never the only indicator (always pair with icon, text, or shape)
- Focus rings visible in all themes
- ARIA labels on all interactive elements
- Minimum 4.5:1 contrast for text, 3:1 for large text and UI components
- Reduced-motion preference respected (disable animations)
- Screen reader announcements for live data updates (spending alerts, sync status)

## Implementation Notes

- Use CSS custom properties (variables) for all colors — enables theme switching
- Tailwind `darkMode: 'class'` strategy, default to dark
- Inter font via `next/font/google` with `display: 'swap'`
- Charts: Recharts or Tremor (React-friendly, composable, dark-mode-aware)
- Animations: Framer Motion for page transitions, CSS transitions for micro-interactions
- Icons: Lucide React (consistent stroke-width, tree-shakeable)
- Replace emoji in nav with proper SVG icons from Lucide
