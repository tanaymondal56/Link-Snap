import { useEffect } from 'react';

/**
 * Custom hook to lock scrolling when a modal is open.
 * Preserves scroll position and prevents background scroll.
 * Also sets data-modal-open attribute to disable PullToRefresh during modal open.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 */
export const useScrollLock = (isOpen) => {
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    
    if (isOpen) {
      // Set modal-open attribute (disables PullToRefresh)
      document.body.setAttribute('data-modal-open', 'true');
      
      // Only set fixed position and save top offset if body is not already fixed by another open modal
      if (document.body.style.position !== 'fixed') {
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = `-${scrollX}px`;
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
      }
      
      // Lock main content container (mobile/dashboard layout)
      if (mainContent) {
        mainContent.style.overflow = 'hidden';
      }
    } else {
      // Check if any other modals are still using scroll lock
      // by looking for other data-modal-content elements
      const otherModals = document.querySelectorAll('[data-modal-content]');
      if (otherModals.length === 0) {
        // Remove modal-open attribute
        document.body.removeAttribute('data-modal-open');
        
        // Get the scroll position from the body's top value
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        const scrollX = parseInt(document.body.style.left || '0') * -1;
        
        // Unlock body
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(scrollX, scrollY);
      }
      
      // Unlock main content
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    }

    // Cleanup function
    return () => {
      // Check if any other modals are still open
      const otherModals = document.querySelectorAll('[data-modal-content]');
      if (otherModals.length <= 1) {
        document.body.removeAttribute('data-modal-open');
        
        // Get the scroll position from the body's top value
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        const scrollX = parseInt(document.body.style.left || '0') * -1;
        
        // Unlock body
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(scrollX, scrollY);
      }
      
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    };
  }, [isOpen]);
};

export default useScrollLock;
