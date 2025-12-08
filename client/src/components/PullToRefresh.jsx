import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PullToRefresh Component
 * Adds pull-to-refresh gesture to its children
 * 
 * Props:
 * - children: ReactNode - Content to wrap
 * - onRefresh: async function - Called when pull-to-refresh is triggered
 * - disabled: boolean - Disable the gesture
 */
const PullToRefresh = ({ children, onRefresh, disabled = false }) => {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const THRESHOLD = 80; // Distance needed to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;
    
    // Only enable if at top of scroll
    if (containerRef.current?.scrollTop > 0) return;
    
    setStartY(e.touches[0].clientY);
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const deltaY = e.touches[0].clientY - startY;
    
    // Only pull down
    if (deltaY > 0) {
      // Apply resistance
      const pull = Math.min(MAX_PULL, deltaY * 0.5);
      setPullDistance(pull);
      
      // Prevent default scroll
      if (pull > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, startY, disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    
    setIsPulling(false);

    if (pullDistance >= THRESHOLD && onRefresh) {
      // Trigger refresh
      setIsRefreshing(true);
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Reset
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, onRefresh, disabled]);

  const progress = Math.min(1, pullDistance / THRESHOLD);
  const rotation = progress * 180;

  return (
    <div 
      ref={containerRef}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-200 z-10 ${
          pullDistance > 0 || isRefreshing ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ 
          top: Math.max(0, pullDistance - 40),
          transform: `translateX(-50%) rotate(${isRefreshing ? 360 : rotation}deg)`,
        }}
      >
        <div className={`p-2.5 bg-gray-800 rounded-full shadow-lg border border-gray-700 ${
          isRefreshing ? 'animate-spin' : ''
        }`}>
          <RefreshCw 
            className={`w-5 h-5 transition-colors ${
              progress >= 1 || isRefreshing ? 'text-blue-400' : 'text-gray-400'
            }`} 
          />
        </div>
      </div>

      {/* Content with pull transform */}
      <div 
        className={`transition-transform ${isPulling ? '' : 'duration-200'}`}
        style={{ 
          transform: `translateY(${isRefreshing ? 50 : pullDistance}px)` 
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
