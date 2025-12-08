import { useEffect, useState } from 'react';
import BottomSheet from './ui/BottomSheet';

/**
 * ResponsiveModal Component
 * Uses BottomSheet on mobile devices and renders children directly on desktop
 * 
 * Props:
 * - isOpen: boolean - Controls visibility
 * - onClose: function - Called when modal is closed
 * - title: string - Modal title (used for BottomSheet header)
 * - children: ReactNode - Modal content
 * - mobileBreakpoint: number - Pixel width below which to use BottomSheet (default: 768)
 */
const ResponsiveModal = ({ 
  isOpen, 
  onClose, 
  title,
  children,
  mobileBreakpoint = 768
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  // On mobile, use BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        snapPoints={['85%', '95%']}
      >
        {children}
      </BottomSheet>
    );
  }

  // On desktop, render children directly (they should handle their own modal UI)
  return isOpen ? children : null;
};

export default ResponsiveModal;
