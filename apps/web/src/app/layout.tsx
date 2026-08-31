import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/app-shell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Wardkeep - Household Readiness',
  description: 'Self-hosted, deterministic household-readiness evaluation. Guard your ground.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0d0f12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
