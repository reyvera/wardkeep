'use client';

import { Info } from 'lucide-react';

/**
 * Banner shown when NEXT_PUBLIC_DEMO_MODE=true.
 * Informs visitors this is a demo instance with daily resets.
 */
export function DemoBanner() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (!isDemo) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-accent-blue/10 border-b border-accent-blue/20 px-4 py-2">
      <Info size={14} className="text-accent-blue flex-shrink-0" />
      <p className="text-xs text-accent-blue">
        This is a demo — data resets daily. Sign up for your own instance.
      </p>
    </div>
  );
}
