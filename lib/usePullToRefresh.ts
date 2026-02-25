'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const THRESHOLD = 80;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(0);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.5, THRESHOLD * 1.5));
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= THRESHOLD) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullDistance, handleRefresh]);

  return { refreshing, pullDistance };
}
