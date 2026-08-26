import { useEffect } from 'react';

// Global reference counter & saved scroll positions for modal scroll locks
let activeLocksCount = 0;
let savedScrollY = 0;
let savedScrollX = 0;

/**
 * Custom hook to lock scrolling when a modal is open.
 * Preserves scroll position and prevents background scroll.
 * Also sets data-modal-open attribute to disable PullToRefresh during modal open.
 * Uses reference counting so multiple or nested modals never corrupt scroll state.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 */
export const useScrollLock = (isOpen) => {
  useEffect(() => {
    if (!isOpen) return;

    const mainContent = document.getElementById('main-content');

    // First active modal lock: capture scroll position and lock body & main-content
    if (activeLocksCount === 0) {
      document.body.setAttribute('data-modal-open', 'true');
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      savedScrollX = window.scrollX || window.pageXOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = `-${savedScrollX}px`;
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';

      if (mainContent) {
        mainContent.style.overflow = 'hidden';
      }
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);

      // When all modal locks have been released, unlock body and restore scroll
      if (activeLocksCount === 0) {
        document.body.removeAttribute('data-modal-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';

        if (mainContent) {
          mainContent.style.overflow = '';
        }

        window.scrollTo(savedScrollX, savedScrollY);
      }
    };
  }, [isOpen]);
};

export default useScrollLock;
