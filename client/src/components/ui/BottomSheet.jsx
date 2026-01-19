import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Bottom Sheet Modal Component
 * A draggable modal that slides up from the bottom on mobile devices
 * 
 * Props:
 * - isOpen: boolean - Controls visibility
 * - onClose: function - Called when sheet is closed
 * - title: string - Sheet header title
 * - children: ReactNode - Sheet content
 * - snapPoints: array - Heights to snap to (default: ['50%', '90%'])
 */
const BottomSheet = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  snapPoints = ['50%', '90%']
}) => {
  const sheetRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(snapPoints[0]);

  // Handle touch start
  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(0);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    setCurrentY(deltaY);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    
    if (currentY > threshold) {
      // Dragged down significantly - close or snap to smaller
      if (sheetHeight === snapPoints[0]) {
        onClose();
      } else {
        setSheetHeight(snapPoints[0]);
      }
    } else if (currentY < -threshold) {
      // Dragged up - snap to larger
      const currentIndex = snapPoints.indexOf(sheetHeight);
      if (currentIndex < snapPoints.length - 1) {
        setSheetHeight(snapPoints[currentIndex + 1]);
      }
    }
    
    setCurrentY(0);
  };

  // Reset height when sheet opens (track previous isOpen to detect open transition)
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    // Only reset when transitioning from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      // Use requestAnimationFrame to defer state update outside effect sync phase
      requestAnimationFrame(() => {
        setSheetHeight(snapPoints[0]);
        setCurrentY(0);
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, snapPoints]);

  // Prevent body scroll when open and disable PullToRefresh
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      // Check if any other modals are still open
      const otherModals = document.querySelectorAll('[data-modal-content]');
      if (otherModals.length <= 1) {
        document.body.removeAttribute('data-modal-open');
      }
      document.body.style.overflow = '';
    }
    return () => {
      const otherModals = document.querySelectorAll('[data-modal-content]');
      if (otherModals.length <= 1) {
        document.body.removeAttribute('data-modal-open');
      }
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const translateY = isDragging ? Math.max(0, currentY) : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        data-modal-content
        className={`absolute left-0 right-0 bottom-0 bg-gray-900 rounded-t-3xl shadow-2xl transition-all ${
          isDragging ? '' : 'duration-300 ease-out'
        }`}
        style={{
          height: sheetHeight,
          transform: `translateY(${translateY}px)`,
          maxHeight: '90dvh', // Changed to 90dvh
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain" style={{ height: 'calc(100% - 80px)' }}>
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BottomSheet;
