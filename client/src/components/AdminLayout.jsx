import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/axios';
import { 
  Loader2, 
  Mail, 
  ArrowRight, 
  ShieldX, 
  LogOut, 
  Shield, 
  Eye, 
  EyeOff,
  AlertCircle,
  KeyRound,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import LazyPullToRefresh from './LazyPullToRefresh';
import {
  hasTrustedDeviceMarker,
  authenticateWithBiometric,
  supportsWebAuthn,
  isBioAuthExpired
} from '../utils/deviceAuth';

const AdminLayout = ({ children }) => {
  const { user, login, logout, loading: authLoading, isAdmin, setUser } = useAuth();
  const navigate = useNavigate();
  
  // Access states
  const [isAllowedIP, setIsAllowedIP] = useState(null);
  const [wasIPAllowed, setWasIPAllowed] = useState(null); // Track original IP status for Back button
  const [hasTrustedDevice, setHasTrustedDevice] = useState(false);
  
  // Biometric state
  const [biometricState, setBiometricState] = useState('idle'); // idle, verifying, success, failed
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [isReauthRequired, setIsReauthRequired] = useState(false); // True when 24h re-auth triggers
  const forceBiometricRef = useRef(false); // Persist across effects to avoid race condition

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Long-press state for hidden biometric trigger
  const [longPressTimer, setLongPressTimer] = useState(null);
  const LONG_PRESS_DURATION = 3000; // 3 seconds
  
  // Multi-tap state for 404 page hidden biometric trigger (PWA recovery)
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState(null);
  const TAP_THRESHOLD = 5; // Tap 5 times to trigger
  const TAP_TIMEOUT = 2000; // 2 seconds to complete taps

  // Add noindex meta tag
  useEffect(() => {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);
    return () => document.head.removeChild(metaRobots);
  }, []);


  // Check for trusted device marker on mount + URL param + WebAuthn support
  useEffect(() => {
    const checkDevice = hasTrustedDeviceMarker();
    // console.log('[Admin] Mount check - Marker:', checkDevice, 'URL Param:', window.location.search);
    setHasTrustedDevice(checkDevice);
    
    // Check URL param for forced biometric (e.g., ?auth=bio)
    const urlParams = new URLSearchParams(window.location.search);
    const forceBiometric = urlParams.get('auth') === 'bio';
    
    // Store in ref for checkAccess effect to read (prevents race condition)
    if (forceBiometric) {
      forceBiometricRef.current = true;
      // Only show prompt immediately if force param is set (explicit user intent)
      if (supportsWebAuthn()) {
        setShowBiometricPrompt(true);
      }
      // Clean up URL param
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Note: Do NOT set showBiometricPrompt here for trusted device marker alone
    // Let checkAccess decide based on login status and IP to avoid flash
  }, []);



  // Long-press handlers for hidden biometric trigger
  const handleLongPressStart = useCallback(() => {
    if (!supportsWebAuthn()) return;
    
    const timer = setTimeout(() => {
      setShowBiometricPrompt(true);
      setIsAllowedIP(null);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }, LONG_PRESS_DURATION);
    
    setLongPressTimer(timer);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  // Multi-tap handler for 404 page (PWA recovery)
  const handle404Tap = useCallback(() => {
    if (!supportsWebAuthn()) return;
    
    // Clear existing timer
    if (tapTimer) {
      clearTimeout(tapTimer);
    }
    
    const newCount = tapCount + 1;
    setTapCount(newCount);
    
    // Check if threshold reached
    if (newCount >= TAP_THRESHOLD) {
      setTapCount(0);
      setShowBiometricPrompt(true);
      setIsAllowedIP(null);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      return;
    }
    
    // Set timer to reset count
    const timer = setTimeout(() => {
      setTapCount(0);
    }, TAP_TIMEOUT);
    setTapTimer(timer);
  }, [tapCount, tapTimer]);

  // Check if IP is allowed
  useEffect(() => {
    const checkAccess = async () => {
      // Use the ref to check if biometric was forced (URL may be cleaned by now)
      const forceBiometric = forceBiometricRef.current;
      
      try {
        await api.head('/admin/stats');
        // IP is allowed - store this for Back to Login button
        setWasIPAllowed(true);
        // console.log('[Admin] Access Check: Success (IP allowed, User Logged In)');
        
        // If IP is allowed, only force bio if explicitly requested by URL
        // If we found a marker but allow access, we should NOT show the prompt (user is already logged in)
        if (forceBiometric && supportsWebAuthn()) {
          setIsAllowedIP(null);
          setShowBiometricPrompt(true);
        } else if (hasTrustedDevice && isBioAuthExpired() && supportsWebAuthn()) {
          // 24h re-auth policy: Force biometric verification if last bio auth was >24h ago
          // console.log('[Admin] Bio auth expired (>24h). Requiring re-verification.');
          setIsReauthRequired(true); // Mark as re-auth for UI
          setIsAllowedIP(null);
          setShowBiometricPrompt(true);
        } else {
          // Explicitly turn off prompt if it was enabled by mount effect
          setShowBiometricPrompt(false);
          setIsAllowedIP(true);
          // Redirect to New Admin Console if already logged in
          navigate('/admin-console/overview', { replace: true });
        }
      } catch (error) {
        if (!error.response) {
          console.warn('[Admin] Backend unreachable');
          // If biometric forced, show prompt even if backend unreachable for IP check
          if (forceBiometric && supportsWebAuthn()) {
            setShowBiometricPrompt(true);
            setIsAllowedIP(null);
          } else {
            setIsAllowedIP(false);
          }
          return;
        }
        if (error.response.status === 404) {
          // IP not whitelisted - store this for Back to Login button
          setWasIPAllowed(false);
          
          // Allow biometric if: has trusted device marker OR force param
          if ((hasTrustedDevice || forceBiometric) && supportsWebAuthn()) {
            setIsAllowedIP(null); // Keep as null to not trigger 404
            setShowBiometricPrompt(true);
          } else {
            setIsAllowedIP(false);
          }
        } else {
          // Other errors (like 401) mean IP is allowed, just not authenticated
          setWasIPAllowed(true);
          // Default to bio if: force param OR marker exists
          if ((forceBiometric || hasTrustedDevice) && supportsWebAuthn()) {
            setIsAllowedIP(null);
            setShowBiometricPrompt(true);
          } else {
            setIsAllowedIP(true);
          }
        }
      }
    };
    checkAccess();
  }, [hasTrustedDevice, navigate]);

  // Biometric error message
  const [biometricError, setBiometricError] = useState('');

  // Handle biometric authentication
  const handleBiometricAuth = useCallback(async () => {
    setBiometricState('verifying');
    setBiometricError('');
    
    const result = await authenticateWithBiometric();
    
    if (result.success) {
      setBiometricState('success');
      
      // Set user in auth context (critical fix)
      if (result.user) {
        setUser(result.user);
      }
      
      // Biometric verified - allow access
      setIsAllowedIP(true);
      setShowBiometricPrompt(false);
      setIsReauthRequired(false); // Reset re-auth flag
      
      // No need to reload - user is already set in context
      // Small delay to show success animation before rendering admin panel
      setTimeout(() => {
        setBiometricState('idle');
        navigate('/admin-console/overview', { replace: true });
      }, 800);
    } else {
      setBiometricState('failed');
      
      if (result.error === 'cancelled') {
        // User cancelled - redirect silently
        setTimeout(() => {
          window.location.replace('/');
        }, 100);
      } else {
        // Show error message
        setBiometricError(result.error || 'Verification failed');
        
        // If rate limited, don't redirect immediately
        if (result.error?.includes('Too many attempts')) {
          // Stay on page to show retry
          setTimeout(() => {
            setBiometricState('idle');
          }, 2000);
        } else {
          // Failed - redirect after showing message
          setTimeout(() => {
            window.location.replace('/');
          }, 2500);
        }
      }
    }
  }, [setUser, navigate]);

  // Retry handler for rate-limited state
  const handleRetryBiometric = useCallback(() => {
    setBiometricState('idle');
    setBiometricError('');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');
    
    // Check network status before attempting
    if (!navigator.onLine) {
       setLoginError('You appear to be offline. Check your connection.');
       setIsLoginLoading(false);
       return;
    }

    try {
      const result = await login(email, password);
      if (!result.success) {
        setLoginError(result.error || 'Invalid credentials');
      } else {
        // Redirect to New Admin Console on success
        navigate('/admin-console/overview', { replace: true });
      }
    } catch (error) {
      console.error('[Login] Error:', error);
      if (!navigator.onLine) {
        setLoginError('Network error. Check your connection.');
      } else if (error.response?.status >= 500) {
        setLoginError('Server error. Please try again later.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Simplified loading check - authLoading from context is the main indicator
  // isAllowedIP null means we're still checking IP access
  const isStillLoading = authLoading || (isAllowedIP === null && !showBiometricPrompt);

  // 0. Loading State - only show if truly loading (not when biometric prompt is shown)
  if (isStillLoading && !showBiometricPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-pulse">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="animate-spin h-8 w-8 text-purple-400" />
          <p className="text-gray-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Biometric Verification Prompt (for trusted devices on non-whitelisted IPs)
  if (showBiometricPrompt && !isAllowedIP) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse animation-delay-2000" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            
            <div className="text-center">
              {/* Shield Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Shield className="h-10 w-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                {isReauthRequired ? 'Session Verification' : 'Admin Access'}
              </h2>
              <p className="text-gray-400 text-sm mb-8">
                {isReauthRequired 
                  ? 'Your session requires re-verification for security'
                  : 'Verify your identity to continue'}
              </p>

              {/* Biometric Button */}
              {biometricState === 'idle' && (
                <>
                <button
                  onClick={handleBiometricAuth}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all duration-300 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Fingerprint className="h-6 w-6" />
                  Verify with Biometrics
                </button>
                <button
                  onClick={() => {
                    setShowBiometricPrompt(false);
                    // Only show login form if IP was actually allowed
                    // If IP was blocked, redirect to home (login won't work anyway)
                    if (wasIPAllowed) {
                      setIsAllowedIP(true);
                    } else {
                      window.location.replace('/');
                    }
                  }}
                  className="mt-4 w-full py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-medium transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {wasIPAllowed ? 'Back to Password Login' : 'Exit'}
                </button>
              </>
              )}

              {biometricState === 'verifying' && (
                <div className="py-4 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <p className="text-gray-300">Complete verification on your device...</p>
                </div>
              )}

              {biometricState === 'success' && (
                <div className="py-4 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Shield className="h-8 w-8 text-green-400" />
                  </div>
                  <p className="text-green-400 font-medium">Verified! Entering admin panel...</p>
                </div>
              )}

              {biometricState === 'failed' && (
                <div className="py-4 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <ShieldX className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium">Verification failed</p>
                  {biometricError && (
                    <p className="text-red-400/70 text-sm text-center">{biometricError}</p>
                  )}
                  {biometricError?.includes('Too many attempts') && (
                    <button
                      onClick={handleRetryBiometric}
                      className="mt-2 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 text-sm transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-center text-gray-500 text-xs">
                Secure biometric authentication
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. IP Blocked (and no trusted device AND not in biometric recovery mode) -> Show 404
  // Note: showBiometricPrompt can be true via ?auth=bio even without localStorage marker
  if (!isAllowedIP && !hasTrustedDevice && !showBiometricPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          {/* Tap 404 five times quickly to trigger biometric mode (PWA recovery) */}
          <h1 
            className="text-6xl font-bold text-gray-600 select-none cursor-default transition-colors"
            onClick={handle404Tap}
            style={{ 
              // Visual feedback: slight color change based on tap count
              color: tapCount > 0 ? `rgba(168, 85, 247, ${0.2 + (tapCount * 0.15)})` : undefined 
            }}
          >
            404
          </h1>
          <p className="text-xl text-gray-400 mt-4">Page Not Found</p>
          <a href="/" className="mt-6 inline-block text-purple-400 hover:text-purple-300">
            Go Home
          </a>
          {/* Subtle hint for tap count (only shows when tapping) */}
          {tapCount > 0 && tapCount < TAP_THRESHOLD && (
            <div className="mt-4 text-xs text-gray-600 animate-pulse">
              {TAP_THRESHOLD - tapCount} more...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. IP Allowed, Not Logged In -> Enhanced Login Form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-800/10 rounded-full blur-3xl" />
        </div>

        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />

        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            
            <div className="text-center mb-8">
              {/* Long-press on shield to trigger biometric (for PWA users) */}
              <div 
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 transform hover:scale-105 transition-transform duration-300 cursor-pointer select-none"
                onMouseDown={handleLongPressStart}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={handleLongPressStart}
                onTouchEnd={handleLongPressEnd}
                title="Hold for 3 seconds for biometric access"
              >
                <Shield className="h-10 w-10 text-white pointer-events-none" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
              <p className="text-gray-400 text-sm">Verify your identity to continue</p>
            </div>

            {loginError && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm font-medium">Authentication Failed</p>
                  <p className="text-red-400/70 text-xs mt-0.5">{loginError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email-address" className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full px-4 py-3.5 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-white/10 transition-all duration-200 text-sm"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="block w-full px-4 py-3.5 pr-12 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-white/10 transition-all duration-200 text-sm"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoginLoading}
                className="group relative w-full flex justify-center py-4 px-4 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoginLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <span className="flex items-center">
                    Access Admin Panel
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-center text-gray-500 text-xs">
                Secure authentication required
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Logged In, NOT Admin -> Access Denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md w-full">
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl shadow-2xl border border-red-500/20 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <ShieldX className="h-10 w-10 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              You don't have permission to access the admin panel. 
              This area is restricted to administrators only.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 border border-white/10"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Admin Panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white">
      <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Admin Panel
            </h1>
          </div>
          <div className="flex gap-3 items-center">
            <a 
              href="/dashboard" 
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            >
              Back to App
            </a>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all text-sm font-medium"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="container mx-auto p-6">
        <PullToRefresh onRefresh={() => window.location.reload()}>
          {children}
        </PullToRefresh>
      </main>
    </div>
  );
};

export default AdminLayout;
