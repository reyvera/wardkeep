'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
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
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/rules', label: 'Rules', icon: Sparkles },
  { href: '/debt', label: 'Debt', icon: TrendingDown },
  { href: '/recurring', label: 'Cash Flow', icon: RefreshCw },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/bank-connections', label: 'Bank Connections', icon: Link2 },
];

const bottomNavItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
        </ul>
      </div>
    </aside>
  );
}
