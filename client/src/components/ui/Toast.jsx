import toast from 'react-hot-toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

// Custom toast styles with gradients
const toastStyles = {
  success: {
    gradient: 'from-emerald-500/20 via-green-500/10 to-transparent',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    progressBar: 'from-emerald-400 to-green-500',
  },
  error: {
    gradient: 'from-red-500/20 via-rose-500/10 to-transparent',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    glow: 'shadow-red-500/20',
    progressBar: 'from-red-400 to-rose-500',
  },
  warning: {
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    progressBar: 'from-amber-400 to-yellow-500',
  },
  info: {
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    progressBar: 'from-blue-400 to-indigo-500',
  },
  loading: {
    gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    progressBar: 'from-purple-400 to-pink-500',
  },
};

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

// Create toast with custom styling
const createToast = (type, message, title, duration) => {
  const styles = toastStyles[type];
  const Icon = icons[type];

  return toast.custom(
    (t) => (
      <div
        className={`
          ${t.visible ? 'animate-toast-enter' : 'animate-toast-leave'}
          max-w-sm w-full pointer-events-auto
          overflow-hidden rounded-xl
          bg-gray-900/95 backdrop-blur-xl
          border ${styles.border}
          shadow-lg ${styles.glow}
        `}
      >
        {/* Gradient overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} pointer-events-none`}
        />

        {/* Content */}
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 ${styles.icon}`}>
              <Icon className={`w-5 h-5 ${type === 'loading' ? 'animate-spin' : ''}`} />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              {title && <p className="text-sm font-semibold text-white leading-tight">{title}</p>}
              {message && (
                <p className={`text-sm text-gray-300 ${title ? 'mt-1' : ''} leading-relaxed`}>
                  {message}
                </p>
              )}
            </div>

            {/* Close button */}
            {type !== 'loading' && (
              <button
                onClick={() => toast.dismiss(t.id)}
                className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {type !== 'loading' && (
          <div className="h-0.5 w-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${styles.progressBar} animate-shrink`}
              style={{
                animationDuration: `${duration}ms`,
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards',
              }}
            />
          </div>
        )}
      </div>
    ),
    { duration: type === 'loading' ? Infinity : duration }
  );
};

// Toast helper object
const showToast = {
  success: (message, title = 'Success') => createToast('success', message, title, 4000),
  error: (message, title = 'Error') => createToast('error', message, title, 5000),
  warning: (message, title = 'Warning') => createToast('warning', message, title, 4500),
  info: (message, title = 'Info') => createToast('info', message, title, 4000),
  loading: (message, title = 'Loading') => createToast('loading', message, title, Infinity),

  promise: async (promise, { loading, success, error }) => {
    const toastId = showToast.loading(loading.message, loading.title || 'Loading');

    try {
      const result = await promise;
      toast.dismiss(toastId);
      const successMsg = typeof success === 'function' ? success(result) : success;
      showToast.success(successMsg.message, successMsg.title || 'Success');
      return result;
    } catch (err) {
      toast.dismiss(toastId);
      const errorMsg = typeof error === 'function' ? error(err) : error;
      showToast.error(errorMsg.message, errorMsg.title || 'Error');
      throw err;
    }
  },

  dismiss: (toastId) => toast.dismiss(toastId),
  dismissAll: () => toast.dismiss(),
};

// Simple toast functions (backward compatible)
export const toastSuccess = (message) => showToast.success(message);
export const toastError = (message) => showToast.error(message);
export const toastWarning = (message) => showToast.warning(message);
export const toastInfo = (message) => showToast.info(message);
export const toastLoading = (message) => showToast.loading(message);

export default showToast;
