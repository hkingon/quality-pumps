'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';

export function ActivityTracker() {
  const { user } = useAuth();
  const lastActiveRef = useRef<number>(Date.now());
  const activeSecondsAccumulator = useRef<number>(0);

  useEffect(() => {
    if (!user?.id) return;

    // Helper to calculate the current week start (Monday YYYY-MM-DD)
    const getWeekStartDate = () => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const monday = new Date(now.setDate(diff));
      
      const year = monday.getFullYear();
      const month = String(monday.getMonth() + 1).padStart(2, '0');
      const date = String(monday.getDate()).padStart(2, '0');
      return `${year}-${month}-${date}`;
    };

    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    // Listen to user interactions to track active state
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    // Periodically check if user was active in the last 10 seconds
    const interval = setInterval(async () => {
      const isVisible = document.visibilityState === 'visible';
      const isWindowFocused = document.hasFocus();
      const wasActiveRecently = Date.now() - lastActiveRef.current < 15 * 1000; // active in last 15 seconds

      if (isVisible && isWindowFocused && wasActiveRecently) {
        activeSecondsAccumulator.current += 10;

        // When we accumulate 30 seconds of active time, send a heartbeat to DB
        if (activeSecondsAccumulator.current >= 30) {
          activeSecondsAccumulator.current = 0;
          const weekStart = getWeekStartDate();

          try {
            const { error } = await supabase.rpc('increment_user_usage', {
              p_user_id: user.id,
              p_week_start: weekStart,
              p_seconds: 30
            });

            if (error) {
              console.error('Error logging active usage:', error);
            }
          } catch (err) {
            console.error('Failed to log usage:', err);
          }
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(interval);
    };
  }, [user?.id]);

  return null;
}
