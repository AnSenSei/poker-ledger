'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function handleRefresh() {
      setRefreshing(true);
      setPullDistance(0);
      pullDistanceRef.current = 0;
      onRefreshRef.current().finally(() => setRefreshing(false));
    }

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
        const dist = Math.min(dy * 0.5, THRESHOLD * 1.5);
        pullDistanceRef.current = dist;
        setPullDistance(dist);
      } else {
        pulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistanceRef.current >= THRESHOLD) {
        handleRefresh();
      } else {
        pullDistanceRef.current = 0;
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
  }, []);

  return { refreshing, pullDistance };
}
