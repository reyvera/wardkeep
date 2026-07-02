import { Inter } from 'next/font/google';

import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/app-shell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'BudgetApp - Personal Finance',
  description: 'AI-powered personal finance management',
  manifest: '/manifest.json',
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
