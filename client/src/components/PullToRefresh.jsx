import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PullToRefresh Component - PWA Native-like
 * Works in PWA standalone mode where browser native pull-to-refresh is disabled
 * 
 * Features:
 * - Only activates in PWA standalone mode
 * - Works with nested scrollable containers
 * - Native-like feel with smooth animations
 * - Haptic feedback on trigger
 */
const PullToRefresh = ({ children, onRefresh, disabled = false }) => {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const [isPWA, setIsPWA] = useState(false);

  const THRESHOLD = 70;
  const MAX_PULL = 100;
  const RESISTANCE = 0.4;

  // Detect if running as PWA standalone
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true ||
                         document.referrer.includes('android-app://');
    setIsPWA(isStandalone);
  }, []);

  // Find the scrollable parent container
  const getScrollableParent = useCallback((element) => {
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflow = style.overflow + style.overflowY;
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        if (current.scrollHeight > current.clientHeight) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }, []);

  // Check if at top of scroll (window or any scrollable parent)
  const isAtTop = useCallback(() => {
    // Check window scroll first
    if (window.scrollY > 0) return false;
    
    // Check if there's a scrollable parent from the container
    if (containerRef.current) {
      const scrollableParent = getScrollableParent(containerRef.current);
      if (scrollableParent && scrollableParent.scrollTop > 0) {
        return false;
      }
    }
    
    return true;
  }, [getScrollableParent]);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing || !isPWA) return;
    if (!isAtTop()) return;
    
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [disabled, isRefreshing, isPWA, isAtTop]);

  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current || disabled || isRefreshing || !isPWA) return;
    if (!isAtTop()) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    
    if (deltaY > 0) {
      const pull = Math.min(MAX_PULL, deltaY * RESISTANCE);
      setPullDistance(pull);
      
      if (pull > 5) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, isPWA, isAtTop]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || !isPWA) return;
    
    isPullingRef.current = false;

    if (pullDistance >= THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(15);
      }
      
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 200);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh, disabled, isPWA]);

  // Don't render pull UI if not in PWA mode
  if (!isPWA) {
    return <>{children}</>;
  }

  const progress = Math.min(1, pullDistance / THRESHOLD);

  return (
    <div 
      ref={containerRef}
      className="relative touch-pan-x"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: pullDistance > 0 ? 'none' : 'pan-y' }}
    >
      {/* Pull indicator */}
      <div 
        className="fixed left-1/2 z-[9999] pointer-events-none transition-opacity duration-150"
        style={{ 
          top: 16,
          transform: 'translateX(-50%)',
          opacity: pullDistance > 5 || isRefreshing ? 1 : 0
        }}
      >
        <div 
          className={`flex items-center justify-center w-10 h-10 bg-gray-900/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-700/50 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 180}deg) scale(${0.8 + progress * 0.2})`,
            transition: isPullingRef.current ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <RefreshCw 
            className={`w-5 h-5 transition-colors duration-150 ${
              progress >= 1 || isRefreshing ? 'text-blue-400' : 'text-gray-400'
            }`} 
          />
        </div>
      </div>

      {/* Content */}
      <div 
        style={{ 
          transform: `translateY(${isRefreshing ? 48 : pullDistance * 0.5}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
