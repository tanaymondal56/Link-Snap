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
const ConfirmDialogComponent = ({ isOpen, onClose, onConfirm, config }) => {
  if (!isOpen) return null;

  const variant = variants[config.variant] || variants.danger;
  const IconComponent = config.icon || variant.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`relative w-[95%] max-w-md bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl ${variant.borderGlow} animate-modal-in overflow-hidden flex flex-col max-h-[95vh] overscroll-contain`}
      >
        {/* Gradient top border */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${variant.buttonBg}`} />

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
            <div className={`p-4 ${variant.iconBg} rounded-2xl ring-4 ring-gray-800`}>
              <IconComponent className={`w-8 h-8 ${variant.iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white text-center mb-2">
            {config.title || 'Are you sure?'}
          </h3>

          {/* Message */}
          <p className="text-gray-400 text-center text-sm leading-relaxed mb-6">
            {config.message || 'This action cannot be undone.'}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 border border-gray-700"
            >
              {config.cancelText || 'Cancel'}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-3 bg-gradient-to-r ${variant.buttonBg} text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl`}
            >
              {config.confirmText || 'Confirm'}
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
    if (resolvePromise) {
      resolvePromise(true);
    }
  }, [resolvePromise]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialogComponent
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        config={config}
      />
    </ConfirmContext.Provider>
  );
};

export default ConfirmDialogProvider;
