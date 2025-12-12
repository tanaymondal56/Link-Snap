import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

/**
 * MobileBackButton Component
 * A floating back button for mobile PWA users
 * 
 * Features:
 * - Only shows in PWA standalone mode
 * - Only shows on mobile devices
 * - Doesn't show on home/landing page
 * - Uses browser history to go back
 */
const MobileBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Compute PWA status (doesn't change during session)
  const isPWA = useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }, []);

  // Compute if we can go back based on location
  const canGoBack = useMemo(() => {
    const isHomePage = location.pathname === '/';
    return !isHomePage && window.history.length > 1;
  }, [location.pathname]);

  // Detect mobile with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Only show in PWA + mobile + not on home page
  if (!isPWA || !isMobile || !canGoBack) {
    return null;
  }

  return (
    <button
      onClick={handleBack}
      className="fixed bottom-20 left-4 z-[9998] w-12 h-12 bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-gray-700 active:scale-95 transition-all duration-150"
      aria-label="Go back"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  );
};

export default MobileBackButton;
