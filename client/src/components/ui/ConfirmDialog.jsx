import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Ban, Shield, ShieldAlert, X, CheckCircle } from 'lucide-react';
import { ConfirmContext } from '../../context/ConfirmContext';

// Different dialog variants with their styles
const variants = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    buttonBg: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
    borderGlow: 'shadow-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
    buttonBg: 'from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
    borderGlow: 'shadow-yellow-500/20',
  },
  ban: {
    icon: Ban,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    buttonBg: 'from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600',
    borderGlow: 'shadow-orange-500/20',
  },
  promote: {
    icon: Shield,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    buttonBg: 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    borderGlow: 'shadow-purple-500/20',
  },
  demote: {
    icon: ShieldAlert,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    buttonBg: 'from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600',
    borderGlow: 'shadow-orange-500/20',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
    buttonBg: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    borderGlow: 'shadow-green-500/20',
  },
};

// The actual dialog component
export const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onCancel, // New prop for distinct secondary action
  // Direct props support
  title,
  message,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  // Config object support (for Provider)
  config = {} 
}) => {
  if (!isOpen) return null;

  // Merge direct props with config (config takes precedence if present for provider usage)
  const finalVariant = config.variant || variant;
  const finalTitle = config.title || title || 'Are you sure?';
  const finalMessage = config.message || message || 'This action cannot be undone.';
  const finalConfirmText = config.confirmText || confirmText;
  const finalCancelText = config.cancelText || cancelText;
  
  // Use config.onCancel if provided, otherwise prop onCancel, otherwise fall back to onClose
  const handleSecondaryAction = config.onCancel || onCancel || onClose;

  const activeVariant = variants[finalVariant] || variants.danger;
  const IconComponent = config.icon || activeVariant.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`relative w-[95%] max-w-md bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl ${activeVariant.borderGlow} animate-modal-in overflow-hidden flex flex-col max-h-[95vh] overscroll-contain`}
      >
        {/* Gradient top border */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${activeVariant.buttonBg}`} />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 overflow-y-auto custom-scrollbar">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className={`p-4 ${activeVariant.iconBg} rounded-2xl ring-4 ring-gray-800`}>
              <IconComponent className={`w-8 h-8 ${activeVariant.iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white text-center mb-2">
            {finalTitle}
          </h3>

          {/* Message */}
          <div className="text-gray-400 text-center text-sm leading-relaxed mb-6">
            {finalMessage}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSecondaryAction}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 border border-gray-700"
            >
              {finalCancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 px-4 py-3 bg-gradient-to-r ${activeVariant.buttonBg} text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl`}
            >
              {finalConfirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Provider component
export const ConfirmDialogProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({});
  const [resolvePromise, setResolvePromise] = useState(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfig(options);
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
    }
  }, [resolvePromise]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
    }
  }, [resolvePromise]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        config={config}
      />
    </ConfirmContext.Provider>
  );
};

export default ConfirmDialogProvider;
