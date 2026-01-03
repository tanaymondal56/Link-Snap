import { useEffect } from 'react';

/**
 * Custom hook to lock scrolling when a modal is open.
 * Targets both document.body and the #main-content container used in DashboardLayout.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 */
export const useScrollLock = (isOpen) => {
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    
    if (isOpen) {
      // Lock body (fallback/desktop)
      document.body.style.overflow = 'hidden';
      // Lock main content container (mobile/dashboard layout)
      if (mainContent) {
        mainContent.style.overflow = 'hidden';
      }
    } else {
      // Unlock body
      document.body.style.overflow = '';
      // Unlock main content
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = '';
      if (mainContent) {
        mainContent.style.overflow = '';
      }
    };
  }, [isOpen]);
};

export default useScrollLock;
