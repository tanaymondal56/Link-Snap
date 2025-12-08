import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

/**
 * Add to Home Screen Prompt Component
 * Shows a banner prompting users to install the PWA on mobile devices
 */
const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  
  // Check if iOS (doesn't support beforeinstallprompt) - computed once
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Check if user dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = new Date(dismissed);
      const now = new Date();
      // Show again after 7 days
      if (now - dismissedTime < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a bit before showing to not interrupt user
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show iOS prompt after delay
    if (isIOS && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isIOS]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS - just close the prompt (user follows instructions)
      handleDismiss();
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden">
        {/* Gradient accent */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl shrink-0">
              <Smartphone className="w-6 h-6 text-blue-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm">
                Install Link Snap
              </h3>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                {isIOS 
                  ? "Tap the share button, then 'Add to Home Screen'"
                  : "Add to your home screen for quick access"
                }
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-3 py-2 text-gray-400 text-sm font-medium hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <Download className="w-4 h-4" />
              {isIOS ? 'Got it' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
