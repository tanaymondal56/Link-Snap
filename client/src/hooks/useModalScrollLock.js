import { useEffect } from 'react';

/**
 * Hook to lock background scroll when a blocking modal is open.
 * This prevents the user from scrolling the page behind the modal.
 * 
 * Features:
 * - Sets data-modal-open attribute on body (disables PullToRefresh)
 * - Sets overflow: hidden on body
 * - Cleans up on unmount
 * 
 * Usage:
 * useModalScrollLock(isOpen);
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 */
const useModalScrollLock = (isOpen) => {
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position if needed
      const scrollY = window.scrollY;
      
      // Apply scroll lock
      document.body.setAttribute('data-modal-open', 'true');
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    }
    
    return () => {
      // Check if any other modals are still open
      // by looking for other modal portals in the DOM
      const modalPortals = document.querySelectorAll('[data-modal-content]');
      if (modalPortals.length <= 1) {
        // Remove scroll lock - we're the last modal
        const scrollY = document.body.style.top;
        document.body.removeAttribute('data-modal-open');
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    };
  }, [isOpen]);
};

export default useModalScrollLock;
