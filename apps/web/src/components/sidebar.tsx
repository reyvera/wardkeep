'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Sun,
  Wallet,
  ArrowLeftRight,
  Tag,
  PieChart,
  Sparkles,
  TrendingDown,
  RefreshCw,
  MessageSquare,
  Upload,
  Link2,
  ShieldCheck,
  ListChecks,
  CalendarDays,
  Target,
  Car,
  House,
  ShieldAlert,
  HeartHandshake,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brief', label: 'Morning Brief', icon: Sun },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/investments', label: 'Investments', icon: PieChart },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/planned-expenses', label: 'Planned expenses', icon: Wallet },
  { href: '/financial-goals', label: 'Financial goals', icon: Target },
  { href: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/home-maintenance', label: 'Home maintenance', icon: House },
  { href: '/emergency-preparedness', label: 'Emergency preparedness', icon: ShieldAlert },
  { href: '/household-transitions', label: 'Transition plans', icon: HeartHandshake },
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
];

const bottomNavItems = [{ href: '/settings', label: 'Settings', icon: Settings }];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const unreviewedQuery = useQuery<{ meta: { totalItems: number } }>({
    queryKey: ['transactions', 'unreviewed-count'],
    queryFn: () => apiClient.get('/transactions?reviewed=false&pageSize=10'),
    staleTime: 30_000,
  });
  const unreviewedCount = unreviewedQuery.data?.meta.totalItems ?? 0;

  return (
    <aside className="hidden md:flex h-screen w-sidebar flex-col border-r border-edge bg-surface-primary sticky top-0">
      {/* Brand */}
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent-blue flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
          <span className="text-lg font-semibold text-content-primary">Wardkeep</span>
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    nav-item
                    ${isActive ? 'nav-item-active' : ''}
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{item.label}</span>
                  {item.href === '/transactions' && unreviewedCount > 0 && (
                    <span
                      className="ml-auto min-w-5 rounded-full bg-accent-blue px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white"
                      aria-label={`${unreviewedCount} transactions need review`}
                    >
                      {unreviewedCount > 99 ? '99+' : unreviewedCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-edge px-3 py-3">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={logout}
              className="nav-item w-full text-left text-content-tertiary hover:text-accent-red"
              aria-label="Sign out"
            >
              <LogOut size={18} strokeWidth={1.5} />
              <span>Sign Out</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
