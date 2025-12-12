import { useEffect, useState } from 'react';

export const usePullToRefresh = (onRefresh) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    let pulling = false;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!pulling) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // Visual feedback could be added here (e.g., transforming a loading indicator)
      if (diff > 0 && window.scrollY === 0) {
        // Prevent default only if we want to stop native scroll, but usually we want to allow it until a threshold
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling) return;
      pulling = false;
      
      const diff = currentY - startY;
      if (diff > 80 && window.scrollY === 0) { // Threshold for refresh
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          // Optional: Vibrate on success
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }
      startY = 0;
      currentY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh]);

  return isRefreshing;
};
