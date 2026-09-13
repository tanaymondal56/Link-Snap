import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Cookie, X, ShieldCheck } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'linksnap_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        // Small delay so it doesn't abruptly pop during initial page render
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage errors in private browsing
    }
  }, []);

  const handleAccept = (type = 'all') => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, type);
    } catch {
      // Ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-gray-900/95 border border-purple-500/20 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
            <Cookie size={20} />
          </div>
          <div className="flex-1 text-xs text-gray-300 leading-relaxed">
            <p className="font-semibold text-sm text-white mb-1 flex items-center gap-1.5">
              <span>We value your privacy</span>
              <ShieldCheck size={14} className="text-emerald-400" />
            </p>
            <p>
              We use cookies to maintain your session, protect against CSRF attacks, and measure anonymous site performance. Review our{' '}
              <Link to="/cookies" className="text-purple-400 hover:text-purple-300 underline font-medium">
                Cookie Policy
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-purple-400 hover:text-purple-300 underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <button
            onClick={() => handleAccept('essential')}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="Dismiss cookie notice"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => handleAccept('essential')}
            className="px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white transition-colors"
          >
            Essential Only
          </button>
          <button
            onClick={() => handleAccept('all')}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-purple-900/30 transition-all"
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
}
