import './globals.css';
import { Providers } from './providers';
import { NavSidebar } from '@/components/nav-sidebar';

export const metadata = {
  title: 'BudgetApp - Personal Finance',
  description: 'AI-powered personal finance management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="flex min-h-screen">
            <NavSidebar />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
