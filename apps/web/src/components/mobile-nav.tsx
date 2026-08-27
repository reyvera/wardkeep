'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  MessageSquare,
  Menu,
  X,
  Wallet,
  Tag,
  Sparkles,
  TrendingDown,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  ListChecks,
  CalendarDays,
  Upload,
  Link2,
  Settings,
  Sun,
  Target,
} from 'lucide-react';

const mobileNavItems = [
  { href: '/brief', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
];

const moreNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brief', label: 'Morning Brief', icon: Sun },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/planned-expenses', label: 'Planned expenses', icon: Wallet },
  { href: '/financial-goals', label: 'Financial goals', icon: Target },
  { href: '/rules', label: 'Rules', icon: Sparkles },
  { href: '/debt', label: 'Debt', icon: TrendingDown },
  { href: '/recurring', label: 'Cash Flow', icon: RefreshCw },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/insurance', label: 'Policies', icon: ShieldCheck },
  { href: '/estate-documents', label: 'Estate planning', icon: ShieldCheck },
  { href: '/income-sources', label: 'Income sources', icon: Wallet },
  { href: '/dependents', label: 'Dependents', icon: ShieldCheck },
  { href: '/external-commitments', label: 'External commitments', icon: Wallet },
  { href: '/recommendations', label: 'Recommendations', icon: ListChecks },
  { href: '/timeline', label: 'Timeline', icon: CalendarDays },
  { href: '/chat', label: 'Advisor', icon: MessageSquare },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/bank-connections', label: 'Bank Connections', icon: Link2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-edge bg-surface-primary/95 backdrop-blur-md"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`
                  flex flex-col items-center gap-0.5 rounded-lg px-3 py-2
                  text-xs font-medium transition-colors duration-150
                  ${isActive ? 'text-accent-blue' : 'text-content-tertiary'}
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={21} strokeWidth={isActive ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${
              isMoreOpen ? 'text-accent-blue' : 'text-content-tertiary'
            }`}
            onClick={() => setIsMoreOpen(true)}
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-menu"
          >
            <Menu size={21} strokeWidth={isMoreOpen ? 2 : 1.5} />
            <span>More</span>
          </button>
        </li>
      </ul>

      {isMoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setIsMoreOpen(false)}>
          <section
            id="mobile-more-menu"
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-edge bg-surface-primary px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="card-title">MORE</p>
                <p className="text-sm text-content-secondary">All household workspaces</p>
              </div>
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => setIsMoreOpen(false)}
                aria-label="Close more navigation"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 pb-3">
              {moreNavItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={`flex min-h-20 flex-col justify-between rounded-xl border p-3 text-sm transition-colors ${
                        isActive
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-edge bg-surface-secondary text-content-primary'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={19} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="mt-2 leading-tight">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </nav>
  );
}
