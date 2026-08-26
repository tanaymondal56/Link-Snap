import { useEffect, useRef, useState, useCallback } from 'react';
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

/**
 * Native <dialog>-based confirm — top-layer (no z-index war), built-in focus
 * trap + Esc handling + background inertness. Enter/exit animations are pure
 * CSS (@starting-style + allow-discrete); no mount/unmount timing logic.
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel, // distinct secondary action
  title,
  message,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  config = {},
}) => {
  const dialogRef = useRef(null);

  // Merge direct props with config (config takes precedence for provider usage)
  const finalVariant = config.variant || variant;
  const finalTitle = config.title || title || 'Are you sure?';
  const finalMessage = config.message || message || 'This action cannot be undone.';
  const finalConfirmText = config.confirmText || confirmText;
  const finalCancelText = config.cancelText || cancelText;
  const handleSecondaryAction = config.onCancel || onCancel || onClose;

  const activeVariant = variants[finalVariant] || variants.danger;
  const IconComponent = config.icon || activeVariant.icon;

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    if (isOpen && !dlg.open) {
      dlg.classList.remove('closing');
      dlg.showModal();
    } else if (!isOpen && dlg.open) {
      // Play exit animation: add .closing (opacity/scale → 0), then close on
      // transitionend. Reduced-motion users get an instant 350 ms safety net.
      dlg.classList.add('closing');
      const finish = () => {
        dlg.removeEventListener('transitionend', finish);
        dlg.classList.remove('closing');
        if (dlg.open) dlg.close();
      };
      dlg.addEventListener('transitionend', finish);
      setTimeout(finish, 350);
    }
  }, [isOpen]);

  // Esc / native close → treat as "cancel"
  const handleCancel = useCallback(
    (e) => {
      e.preventDefault(); // stop auto-close; route through state for exit anim
      onClose?.();
    },
    [onClose]
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={(e) => {
        // Backdrop click (target === dialog itself) closes
        if (e.target === dialogRef.current) onClose?.();
      }}
      className="app-dialog m-auto w-[95%] max-w-md"
      aria-labelledby="confirm-title"
    >
      <div
        data-modal-content
        className="relative bg-gray-900/70 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90dvh] overscroll-contain"
      >
        {/* Gradient top border */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${activeVariant.buttonBg}`} />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
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
          <h3 id="confirm-title" className="text-xl font-bold text-white text-center mb-2">
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
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-300 border border-white/10 backdrop-blur-md hover:shadow-lg active:scale-95"
            >
              {finalCancelText}
            </button>
            <button
              onClick={() => onConfirm?.()}
              className={`flex-1 px-4 py-3 bg-gradient-to-r ${activeVariant.buttonBg} text-white font-semibold rounded-xl transition-all duration-300 transform active:scale-95 shadow-[0_0_20px_-5px_currentColor] hover:shadow-[0_0_30px_-5px_currentColor] overflow-hidden relative group`}
            >
              {finalConfirmText}
            </button>
          </div>
        </div>
      </div>
    </dialog>
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
