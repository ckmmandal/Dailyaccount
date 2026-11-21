import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xl border border-amber-400/50 print:hidden"
    >
      <WifiOff size={14} className="shrink-0 animate-pulse" />
      <span>Offline Mode — Internet जडान छैन (Live Sync रोकिएको छ)</span>
    </div>
  );
};
