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

// Main showToast API
const showToast = {
  success: (message, title = 'Success') => 
    globalAddToast?.({ type: 'success', message, title, duration: 4000 }),
  
  error: (message, title = 'Error') => 
    globalAddToast?.({ type: 'error', message, title, duration: 5000 }),
  
  warning: (message, title = 'Warning') => 
    globalAddToast?.({ type: 'warning', message, title, duration: 4500 }),
  
  info: (message, title = 'Info') => 
    globalAddToast?.({ type: 'info', message, title, duration: 4000 }),
  
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
