import { useState } from 'react';

/**
 * Hook to persist tab state in sessionStorage
 * @param {string} key - Unique key for storage (automatically prefixed with 'ls_tab_')
 * @param {string} defaultValue - Default tab value if nothing stored
 * @param {string[]} validOptions - Optional array of valid values. Stored value is ignored if not in this list.
 * @returns {[string, function]} - State and setter (like useState)
 */
export const usePersistentTab = (key, defaultValue, validOptions = null) => {
  const storageKey = `ls_tab_${key}`;

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      
      if (stored) {
        // If validation options provided, check if stored value is valid
        if (validOptions && !validOptions.includes(stored)) {
          return defaultValue;
        }
        return stored;
      }
    } catch (error) {
      console.warn('Tab persistence failed (reading):', error);
    }
    
    return defaultValue;
  });

  const setActiveTab = (newValue) => {
    setActiveTabState(newValue);
    try {
      sessionStorage.setItem(storageKey, newValue);
    } catch (error) {
      console.warn('Tab persistence failed (writing):', error);
    }
  };

  return [activeTab, setActiveTab];
};

export default usePersistentTab;
