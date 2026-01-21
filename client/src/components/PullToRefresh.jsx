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
 * - Modal-aware: disabled when modal is open
 */
const PullToRefresh = ({ children, onRefresh, disabled = false }) => {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const isAtTopOnStartRef = useRef(false); // Track if was at top when touch started
  const [isPWA, setIsPWA] = useState(false);
  const rafRef = useRef(null); // For requestAnimationFrame

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

  // Check if modal is open
  const isModalOpen = useCallback(() => {
    return document.body.hasAttribute('data-modal-open');
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

  // Check if at absolute top of scroll (with 1px tolerance)
  const isAtTop = useCallback(() => {
    // Check window scroll first
    if (window.scrollY > 1) return false;
    
    // Check if there's a scrollable parent from the container
    if (containerRef.current) {
      const scrollableParent = getScrollableParent(containerRef.current);
      if (scrollableParent && scrollableParent.scrollTop > 1) {
        return false;
      }
    }
    
    // Also check main-content element
    const mainContent = document.getElementById('main-content');
    if (mainContent && mainContent.scrollTop > 1) {
      return false;
    }
    
    return true;
  }, [getScrollableParent]);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing || !isPWA) return;

    // Check if modal is open
    if (isModalOpen()) return;

    // Check if touch originated from within a modal
    const target = e.target;
    const isInsideModal = target.closest('[data-modal-content]');
    if (isInsideModal) return;

    // Must be at top when touch starts
    if (!isAtTop()) {
      isAtTopOnStartRef.current = false;
      return;
    }
    
    isAtTopOnStartRef.current = true;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [disabled, isRefreshing, isPWA, isAtTop, isModalOpen]);

  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current || disabled || isRefreshing || !isPWA) return;
    
    // Cancel pull if modal opens mid-gesture
    if (isModalOpen()) {
      isPullingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPullDistance(0);
      return;
    }
    
    // If wasn't at top when touch started, ignore
    if (!isAtTopOnStartRef.current) {
      isPullingRef.current = false;
      return;
    }

    // If no longer at top (user scrolled), cancel pull
    if (!isAtTop()) {
      isPullingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    
    if (deltaY > 0) {
      // Use requestAnimationFrame for smoother updates
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const pull = Math.min(MAX_PULL, deltaY * RESISTANCE);
        setPullDistance(pull);
      });
      
      if (deltaY > 10) {
        e.preventDefault();
      }
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, isPWA, isAtTop, isModalOpen]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || !isPWA) return;
    
    isPullingRef.current = false;
    isAtTopOnStartRef.current = false;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

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

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
        className="fixed left-1/2 z-[9999] pointer-events-none will-change-transform will-change-opacity"
        style={{ 
          top: 16,
          transform: 'translateX(-50%)',
          opacity: pullDistance > 5 || isRefreshing ? 1 : 0,
          transition: 'opacity 0.15s ease-out'
        }}
      >
        <div 
          className={`flex items-center justify-center w-10 h-10 bg-gray-900/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-700/50 will-change-transform ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 180}deg) scale(${0.8 + progress * 0.2})`,
            transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
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
        className="will-change-transform"
        style={{ 
          transform: `translateY(${isRefreshing ? 48 : pullDistance * 0.5}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
