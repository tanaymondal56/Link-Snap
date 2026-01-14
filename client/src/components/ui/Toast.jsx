import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle, XCircle, AlertTriangle, Info, X, Loader2, 
  Sparkles, Zap, Bell, ArrowRight, ExternalLink 
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TOAST CONTEXT - Global state management
// ═══════════════════════════════════════════════════════════════════════════

const ToastContext = createContext(null);

// Toast type configurations with enhanced styling
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-green-600',
    bgGradient: 'from-emerald-500/15 via-green-500/10 to-emerald-500/5',
    border: 'border-emerald-500/40',
    iconColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/30',
    ringColor: 'ring-emerald-500/20',
  },
  error: {
    icon: XCircle,
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-500/15 via-rose-500/10 to-red-500/5',
    border: 'border-red-500/40',
    iconColor: 'text-red-400',
    glowColor: 'shadow-red-500/30',
    ringColor: 'ring-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/15 via-yellow-500/10 to-amber-500/5',
    border: 'border-amber-500/40',
    iconColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/30',
    ringColor: 'ring-amber-500/20',
  },
  info: {
    icon: Info,
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-500/15 via-indigo-500/10 to-blue-500/5',
    border: 'border-blue-500/40',
    iconColor: 'text-blue-400',
    glowColor: 'shadow-blue-500/30',
    ringColor: 'ring-blue-500/20',
  },
  loading: {
    icon: Loader2,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/15 via-pink-500/10 to-purple-500/5',
    border: 'border-purple-500/40',
    iconColor: 'text-purple-400',
    glowColor: 'shadow-purple-500/30',
    ringColor: 'ring-purple-500/20',
  },
  upgrade: {
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-500/15 via-purple-500/10 to-violet-500/5',
    border: 'border-violet-500/40',
    iconColor: 'text-violet-400',
    glowColor: 'shadow-violet-500/30',
    ringColor: 'ring-violet-500/20',
  },
  limit: {
    icon: Zap,
    gradient: 'from-orange-500 to-red-500',
    bgGradient: 'from-orange-500/15 via-red-500/10 to-orange-500/5',
    border: 'border-orange-500/40',
    iconColor: 'text-orange-400',
    glowColor: 'shadow-orange-500/30',
    ringColor: 'ring-orange-500/20',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ToastItem = ({ toast, onDismiss, position }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Progress bar countdown
  useEffect(() => {
    if (toast.type === 'loading' || !toast.duration) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.duration, toast.type, handleDismiss]);

  // Animation classes based on position
  const getAnimationClasses = () => {
    const base = 'transform transition-all duration-300 ease-out';
    if (isLeaving) {
      return `${base} opacity-0 scale-95 ${position.includes('right') ? 'translate-x-full' : position.includes('left') ? '-translate-x-full' : 'translate-y-full'}`;
    }
    if (isVisible) {
      return `${base} opacity-100 scale-100 translate-x-0 translate-y-0`;
    }
    return `${base} opacity-0 scale-95 ${position.includes('right') ? 'translate-x-full' : position.includes('left') ? '-translate-x-full' : '-translate-y-full'}`;
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        ${getAnimationClasses()}
        relative overflow-hidden
        w-full max-w-[360px] sm:max-w-sm
        rounded-xl sm:rounded-2xl
        bg-gray-900/95 backdrop-blur-xl
        border ${config.border}
        shadow-xl sm:shadow-2xl ${config.glowColor}
        ring-1 ${config.ringColor}
      `}
    >
      {/* Animated gradient background */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} opacity-80`}
        style={{ animation: 'shimmer 3s ease-in-out infinite' }}
      />
      
      {/* Floating particles effect for special toasts */}
      {['upgrade', 'limit', 'success'].includes(toast.type) && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 rounded-full bg-gradient-to-r ${config.gradient} opacity-60`}
              style={{
                left: `${15 + i * 15}%`,
                animation: `float ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="relative p-3 sm:p-4">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Animated icon container - smaller on mobile */}
          <div className={`
            flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl
            flex items-center justify-center
            bg-gradient-to-br ${config.gradient}
            shadow-md sm:shadow-lg ${config.glowColor}
            ${toast.type === 'loading' ? '' : 'animate-icon-pop'}
          `}>
            <Icon 
              className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${toast.type === 'loading' ? 'animate-spin' : ''}`} 
            />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
            {toast.title && (
              <p className="text-[13px] sm:text-sm font-semibold text-white leading-tight mb-0.5">
                {toast.title}
              </p>
            )}
            {toast.message && (
              <p className="text-[12px] sm:text-sm text-gray-300 leading-snug sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
                {toast.message}
              </p>
            )}
            
            {/* Action buttons */}
            {toast.actions && toast.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {toast.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      action.onClick?.();
                      if (action.dismissOnClick !== false) handleDismiss();
                    }}
                    className={`
                      inline-flex items-center gap-1.5
                      px-3 py-1.5 rounded-lg
                      text-xs font-medium
                      transition-all duration-200
                      ${idx === 0 
                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg hover:shadow-xl hover:scale-105` 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                      }
                    `}
                  >
                    {action.label}
                    {action.icon === 'arrow' && <ArrowRight className="w-3 h-3" />}
                    {action.icon === 'external' && <ExternalLink className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Close button */}
          {toast.type !== 'loading' && toast.dismissible !== false && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 hover:scale-110"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {toast.type !== 'loading' && toast.showProgress !== false && (
        <div className="h-1 w-full bg-gray-800/50 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST CONTAINER - Manages position and stacking
// ═══════════════════════════════════════════════════════════════════════════

const ToastContainer = ({ toasts, removeToast, position = 'top-right' }) => {
  // Position classes for different screen positions
  const positionClasses = {
    'top-right': 'top-4 right-4 sm:top-6 sm:right-6',
    'top-left': 'top-4 left-4 sm:top-6 sm:left-6',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 sm:top-6',
    'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
    'bottom-left': 'bottom-4 left-4 sm:bottom-6 sm:left-6',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6',
  };

  // Mobile: top-center for best visibility (avoids keyboard, bottom nav, and thumb reach issues)
  const mobileOverride = 'max-sm:left-3 max-sm:right-3 max-sm:top-[calc(env(safe-area-inset-top,0px)+12px)] max-sm:bottom-auto max-sm:translate-x-0';

  return createPortal(
    <div
      className={`
        fixed z-[9999]
        ${positionClasses[position]}
        ${mobileOverride}
        flex flex-col gap-2 sm:gap-3
        pointer-events-none
        max-h-[60vh] sm:max-h-[80vh] overflow-hidden
      `}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem 
            toast={toast} 
            onDismiss={removeToast}
            position={position}
          />
        </div>
      ))}
    </div>,
    document.body
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST PROVIDER - Context provider with hook
// ═══════════════════════════════════════════════════════════════════════════

let toastIdCounter = 0;

export const ToastProvider = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = ++toastIdCounter;
    const newToast = {
      id,
      duration: 4000,
      dismissible: true,
      showProgress: true,
      ...toast,
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      // Limit max toasts
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const updateToast = useCallback((id, updates) => {
    setToasts((prev) => 
      prev.map((t) => t.id === id ? { ...t, ...updates } : t)
    );
  }, []);

  const value = { addToast, removeToast, dismissAll, updateToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} position={position} />
    </ToastContext.Provider>
  );
};

// Hook to use toast - must be exported for consumer components
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
