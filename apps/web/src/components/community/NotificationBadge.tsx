'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchUnreadCount } from '@/lib/api/community';

export function NotificationBadge() {
  const [unread, setUnread] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const response = await fetchUnreadCount();
      if (response.success) {
        setUnread(response.data.unread_count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadCount();

    // Poll every 30 seconds
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [loadCount]);

  if (unread <= 0) return null;

  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
      {unread > 9 ? '9+' : unread}
    </span>
  );
}
