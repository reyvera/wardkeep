'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/accounts', label: 'Accounts', icon: '🏦' },
  { href: '/transactions', label: 'Transactions', icon: '💳' },
  { href: '/budget', label: 'Budget', icon: '📋' },
  { href: '/rules', label: 'Rules', icon: '⚙️' },
  { href: '/debt', label: 'Debt', icon: '💰' },
  { href: '/recurring', label: 'Cash Flow', icon: '🔄' },
  { href: '/chat', label: 'Chat', icon: '🤖' },
  { href: '/import', label: 'Import', icon: '📥' },
  { href: '/bank-connections', label: 'Bank Connections', icon: '🔗' },
  { href: '/settings', label: 'Settings', icon: '🔧' },
];

export function NavSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 md:hidden rounded-md bg-white p-2 shadow-md"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      >
        <span className="text-xl">{isOpen ? '✕' : '☰'}</span>
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-40 h-full w-64 bg-white shadow-lg transition-transform duration-200
          md:relative md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-16 items-center px-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
              BudgetApp
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                        transition-colors
                        ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="text-lg" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
