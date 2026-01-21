/**
 * Toast Utilities - Non-component exports for showToast API
 * Split from Toast.jsx to satisfy React Fast Refresh requirements
 */

// Global toast handlers (set by ToastRegistrar component)
let globalAddToast = null;
let globalRemoveToast = null;

export const registerToastHandler = (addFn, removeFn) => {
  globalAddToast = addFn;
  globalRemoveToast = removeFn;
};

// Deduplication map to track recent toasts
const recentToasts = new Map();
const DEDUPE_TIME = 1000; // 1 second deduplication window

const isDuplicate = (message, type) => {
  const key = `${type}:${message}`;
  const now = Date.now();
  const lastTime = recentToasts.get(key) || 0;
  
  if (now - lastTime < DEDUPE_TIME) {
    return true;
  }
  
  // Clean up old entries periodically or just set current
  recentToasts.set(key, now);
  // Cleanup old keys (optional, but good for long sessions)
  if (recentToasts.size > 20) {
    const cutoff = now - DEDUPE_TIME;
    for (const [k, t] of recentToasts) {
      if (t < cutoff) recentToasts.delete(k);
    }
  }
  return false;
};

// Main showToast API
const showToast = {
  success: (message, title = 'Success') => {
    if (isDuplicate(message, 'success')) return;
    return globalAddToast?.({ type: 'success', message, title, duration: 4000 });
  },
  
  error: (message, title = 'Error') => {
    if (isDuplicate(message, 'error')) return;
    return globalAddToast?.({ type: 'error', message, title, duration: 5000 });
  },
  
  warning: (message, title = 'Warning') => {
    if (isDuplicate(message, 'warning')) return;
    return globalAddToast?.({ type: 'warning', message, title, duration: 4500 });
  },
  
  info: (message, title = 'Info') => {
    if (isDuplicate(message, 'info')) return;
    return globalAddToast?.({ type: 'info', message, title, duration: 4000 });
  },
  
  loading: (message, title = 'Loading') => 
    globalAddToast?.({ type: 'loading', message, title, duration: Infinity }),
  
  // Upgrade prompt with action button
  upgrade: (message, title = 'Upgrade Available', actions = []) => 
    globalAddToast?.({ 
      type: 'upgrade', 
      message, 
      title, 
      duration: 8000,
      actions: actions.length ? actions : [
        { label: 'Upgrade Now', icon: 'arrow', onClick: () => window.location.href = '/pricing' }
      ]
    }),
  
  // Limit reached notification
  limit: (message, title = 'Limit Reached', actions = []) => 
    globalAddToast?.({ 
      type: 'limit', 
      message, 
      title, 
      duration: 8000,
      actions
    }),
  
  // Promise handler for async operations
  promise: async (promise, { loading, success, error }) => {
    const toastId = showToast.loading(loading.message, loading.title);
    
    try {
      const result = await promise;
      globalRemoveToast?.(toastId);
      const successMsg = typeof success === 'function' ? success(result) : success;
      showToast.success(successMsg.message, successMsg.title);
      return result;
    } catch (err) {
      globalRemoveToast?.(toastId);
      const errorMsg = typeof error === 'function' ? error(err) : error;
      showToast.error(errorMsg.message, errorMsg.title);
      throw err;
    }
  },

  // Custom toast with full options
  custom: (options) => globalAddToast?.(options),
  
  dismiss: (id) => globalRemoveToast?.(id),
  dismissAll: () => globalRemoveToast?.('all'),
};

// Backward compatible exports
export const toastSuccess = (message) => showToast.success(message);
export const toastError = (message) => showToast.error(message);
export const toastWarning = (message) => showToast.warning(message);
export const toastInfo = (message) => showToast.info(message);
export const toastLoading = (message) => showToast.loading(message);

export default showToast;
