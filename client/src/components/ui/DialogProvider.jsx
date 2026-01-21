import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import { X, MessageSquare, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

// Context for the prompt/alert dialog
const DialogContext = createContext(null);

// Different dialog variants with their styles
const variants = {
  default: {
    icon: MessageSquare,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    buttonBg: 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    borderGlow: 'shadow-purple-500/20',
    inputBorder: 'focus:border-purple-500 focus:ring-purple-500/30',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
    buttonBg: 'from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
    borderGlow: 'shadow-yellow-500/20',
    inputBorder: 'focus:border-yellow-500 focus:ring-yellow-500/30',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    buttonBg: 'from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600',
    borderGlow: 'shadow-red-500/20',
    inputBorder: 'focus:border-red-500 focus:ring-red-500/30',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
    buttonBg: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    borderGlow: 'shadow-green-500/20',
    inputBorder: 'focus:border-green-500 focus:ring-green-500/30',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    buttonBg: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    borderGlow: 'shadow-blue-500/20',
    inputBorder: 'focus:border-blue-500 focus:ring-blue-500/30',
  },
};

// The actual dialog component
const DialogComponent = ({ isOpen, onClose, onSubmit, config }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  // Reset input value and focus when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Defer to next tick to avoid state update during render
      const timeoutId = setTimeout(() => {
        setInputValue(config.defaultValue || '');
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, config.defaultValue]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variant = variants[config.variant] || variants.default;
  const IconComponent = config.icon || variant.icon;
  const isPrompt = config.type === 'prompt';
  const isAlert = config.type === 'alert';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isPrompt) {
      onSubmit(inputValue);
    } else {
      onSubmit(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        data-modal-content
        className={`relative w-[95%] max-w-md bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl ${variant.borderGlow} animate-modal-in overflow-hidden flex flex-col max-h-[95dvh] overscroll-contain`}
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
        <form onSubmit={handleSubmit} className="p-6 pt-8 overflow-y-auto custom-scrollbar">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className={`p-4 ${variant.iconBg} rounded-2xl ring-4 ring-gray-800`}>
              <IconComponent className={`w-8 h-8 ${variant.iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white text-center mb-2">
            {config.title || (isPrompt ? 'Enter Value' : 'Notice')}
          </h3>

          {/* Message */}
          {config.message && (
            <p className="text-gray-400 text-center text-sm leading-relaxed mb-4">
              {config.message}
            </p>
          )}

          {/* Input for prompt */}
          {isPrompt && (
            <div className="mb-6">
              {config.multiline ? (
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={config.placeholder || 'Enter your response...'}
                  className={`w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${variant.inputBorder} transition-all resize-none`}
                  rows={4}
                  required={config.required}
                />
              ) : (
                <input
                  ref={inputRef}
                  type={config.inputType || 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={config.placeholder || 'Enter your response...'}
                  className={`w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${variant.inputBorder} transition-all`}
                  required={config.required}
                />
              )}
            </div>
          )}

          {/* Buttons */}
          <div className={`flex gap-3 ${isAlert ? 'justify-center' : ''}`}>
            {!isAlert && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 border border-gray-700"
              >
                {config.cancelText || 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              className={`${isAlert ? 'px-8' : 'flex-1'} px-4 py-3 bg-gradient-to-r ${variant.buttonBg} text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl`}
            >
              {config.confirmText || (isAlert ? 'OK' : 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Provider component
const DialogProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({});
  const [resolvePromise, setResolvePromise] = useState(null);

  const prompt = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfig({ ...options, type: 'prompt' });
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const alert = useCallback((options = {}) => {
    // Allow passing just a string as the message
    const normalizedOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setConfig({ ...normalizedOptions, type: 'alert' });
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfig({ ...options, type: 'confirm' });
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(config.type === 'prompt' ? null : false);
    }
  }, [resolvePromise, config.type]);

  const handleSubmit = useCallback(
    (value) => {
      setIsOpen(false);
      if (resolvePromise) {
        resolvePromise(value);
      }
    },
    [resolvePromise]
  );

  return (
    <DialogContext.Provider value={{ prompt, alert, confirm }}>
      {children}
      <DialogComponent
        isOpen={isOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        config={config}
      />
    </DialogContext.Provider>
  );
};

// Hook to use the dialog - exported separately
// eslint-disable-next-line react-refresh/only-export-components
export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export default DialogProvider;
