import showToast from '../components/ui/Toast';

/**
 * Smart error handler that provides clear messages for different error types
 * - Offline: User has no internet connection
 * - Server unreachable: User is online but server is down
 * - API error: Server responded with an error
 * 
 * @param {Error} error - The error object from axios
 * @param {string} fallbackMessage - Default message if no specific error detected
 */
export const handleApiError = (error, fallbackMessage = 'Something went wrong') => {
  // Check if user is offline
  if (!navigator.onLine) {
    showToast.error(
      "You're offline. Please check your internet connection.",
      'No Connection'
    );
    return;
  }

  // Check if server is unreachable (network error or no response)
  if (error.code === 'ERR_NETWORK' || !error.response) {
    showToast.error(
      "Couldn't reach the server. Please try again in a moment.",
      'Server Unavailable'
    );
    return;
  }

  // Handle specific HTTP status codes
  if (error.response?.status === 429) {
    showToast.error(
      error.response?.data?.message || 'Too many requests. Please slow down.',
      'Rate Limited'
    );
    return;
  }

  // Default: Show API error message or fallback
  showToast.error(
    error.response?.data?.message || fallbackMessage
  );
};

export default handleApiError;
