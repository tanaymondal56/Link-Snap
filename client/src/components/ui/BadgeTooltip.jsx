import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Custom styled tooltip component for badges
 * Uses portal to render tooltip outside container (prevents clipping)
 * Smart positioning to stay within viewport
 * Shows on hover (desktop), tap (mobile), and keyboard focus (accessibility)
 */
const BadgeTooltip = ({ children, content, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const triggerRef = useRef(null);

  // Calculate tooltip position with edge detection
  const updatePosition = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 200; // Max width
    const padding = 12; // Min distance from screen edge
    const gap = 10; // Gap between tooltip and badge
    
    let left = rect.left + rect.width / 2;
    let arrowOff = 0;
    
    // Check left edge
    if (left - tooltipWidth / 2 < padding) {
      const shift = (tooltipWidth / 2) - left + padding;
      left = left + shift;
      arrowOff = -shift;
    }
    
    // Check right edge
    const rightEdge = left + tooltipWidth / 2;
    if (rightEdge > window.innerWidth - padding) {
      const shift = rightEdge - (window.innerWidth - padding);
      left = left - shift;
      arrowOff = shift;
    }
    
    // Position tooltip ABOVE the badge top edge with gap
    setPosition({
      top: rect.top - gap,
      left: left,
    });
    setArrowOffset(arrowOff);
  };

  // Show tooltip
  const showTooltip = () => {
    updatePosition();
    setIsVisible(true);
  };

  // Hide tooltip
  const hideTooltip = () => {
    setIsVisible(false);
  };

  // Desktop: hover events
  const handleMouseEnter = () => showTooltip();
  const handleMouseLeave = () => hideTooltip();

  // Keyboard accessibility: focus/blur and Enter/Escape
  const handleFocus = () => showTooltip();
  const handleBlur = () => hideTooltip();
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    } else if (e.key === 'Escape') {
      hideTooltip();
    }
  };

  // Mobile: single tap to toggle
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (!isVisible) {
      showTooltip();
    } else {
      hideTooltip();
    }
  };

  // Hide tooltip when clicking outside
  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        hideTooltip();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible]);

  // Auto-hide after 3 seconds
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => hideTooltip(), 3000);
    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-describedby={isVisible ? 'badge-tooltip' : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        className={`inline-flex cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded ${className}`}
      >
        {children}
      </div>
      
      {isVisible && content && createPortal(
        <div
          id="badge-tooltip"
          role="tooltip"
          className="fixed z-[9999] px-3 py-2 text-xs text-white bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-[200px] text-center pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {content}
          {/* Arrow pointing down */}
          <div 
            className="absolute top-full w-0 h-0"
            style={{
              left: `calc(50% + ${arrowOffset}px)`,
              transform: 'translateX(-50%)',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgb(55, 65, 81)',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default BadgeTooltip;
