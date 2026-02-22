import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '../api/axios';
import showToast from '../utils/toastUtils';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Max age for cached auth state (7 days in milliseconds)
  const AUTH_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  // Persisted Auth: Try to load cached user from localStorage for instant UI
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('ls_auth_user');
      const cachedAt = localStorage.getItem('ls_auth_cached_at');

      if (cached && cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10);
        // Only use cache if within max age
        if (age < AUTH_CACHE_MAX_AGE) {
          return JSON.parse(cached);
        } else {
          // Cache expired - clear it
          localStorage.removeItem('ls_auth_user');
          localStorage.removeItem('ls_auth_cached_at');
        }
      }
    } catch {
      /* ignore parse errors */
    }
    return null;
  });

  // Loading only true if we have no valid cached state to show
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('ls_auth_user');
      const cachedAt = localStorage.getItem('ls_auth_cached_at');
      if (cached && cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10);
        return age >= AUTH_CACHE_MAX_AGE;
      }
      return true;
    } catch {
      return true;
    }
  });
  const [authModal, setAuthModal] = useState({ isOpen: false, tab: 'login' });

  // Persist user to localStorage whenever it changes (with timestamp)
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('ls_auth_user', JSON.stringify(user));
        localStorage.setItem('ls_auth_cached_at', Date.now().toString());
      } else {
        localStorage.removeItem('ls_auth_user');
        localStorage.removeItem('ls_auth_cached_at');
      }
    } catch {
      /* ignore storage errors */
    }
  }, [user]);

  // Track if background auth check is in progress
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Check if user is logged in (background verification)
  const checkAuth = useCallback(async (initialRetryCount = 0) => {
    const executeCheck = async (retryCount) => {
      // Secure Auth Load: Try to silent refresh immediately
      // This relies on the httpOnly cookie being present
      try {
        // Attempt to get a new access token using the refresh token cookie
        const { data: refreshData } = await api.get('/auth/refresh');

        // If successful, set the token in memory
        setAccessToken(refreshData.accessToken);

        // OPTIMIZED: Use user data from refresh response if available
        // This avoids the redundant /auth/me call
        if (refreshData.user) {
          setUser(refreshData.user);
        } else {
          // Fallback for older backend versions (should not be needed with recent update)
          const { data: userData } = await api.get('/auth/me');
          setUser(userData);
        }

        setLoading(false);
        setIsAuthChecking(false);
      } catch (error) {
        // Only treat 401/403 as definitive "not logged in"
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          setUser(null);
          setAccessToken(null);
          setLoading(false);
          setIsAuthChecking(false);
        } else {
          // For network errors (server restarting), retry up to 5 times
          if (retryCount < 5) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            setTimeout(() => executeCheck(retryCount + 1), delay);
          } else {
            // After all retries fail, keep cached user state if available
            // Only clear loading - don't clear cached user on network failure
            setLoading(false);
            setIsAuthChecking(false);
          }
        }
      }
    };

    await executeCheck(initialRetryCount);
  }, []);

  // Initial auth check on mount - runs in background
  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          return false;
        }
        return current;
      });
    }, 15000);

    // Start auth check immediately - verifies cached state in background
    checkAuth();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [checkAuth]);

  const openAuthModal = (tab = 'login') => {
    setAuthModal({ isOpen: true, tab });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, tab: 'login' });
  };

  const login = async (identifier, password) => {
    try {
      const { data } = await api.post('/auth/login', { identifier, password });

      // Update memory token
      setAccessToken(data.accessToken);

      const userData = {
        _id: data._id,
        internalId: data.internalId,
        eliteId: data.eliteId,
        snapId: data.snapId,
        idTier: data.idTier,
        idNumber: data.idNumber,
        email: data.email,
        username: data.username,
        usernameChangedAt: data.usernameChangedAt,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        company: data.company,
        website: data.website,
        bio: data.bio,
        avatar: data.avatar,
        role: data.role,
        createdAt: data.createdAt,
        lastLoginAt: data.lastLoginAt,
        subscription: data.subscription,
        linkUsage: data.linkUsage,
        clickUsage: data.clickUsage,
      };
      setUser(userData);
      showToast.success(
        data.firstName ? `Welcome back, ${data.firstName}!` : 'Welcome back!',
        'Logged In'
      );

      // Background refresh: immediately fetch comprehensive user data from /auth/refresh
      // The login response has a subset of fields; the refresh endpoint returns the full
      // user object including subscription details. This prevents stale tier display when
      // the login response or localStorage cache has outdated subscription data.
      checkAuth();

      return { success: true, user: userData };
    } catch (error) {
      const errorData = error.response?.data;

      // Handle banned user with detailed info
      if (errorData?.banned) {
        // Store ban info for the suspended page
        sessionStorage.setItem(
          'banMessage',
          errorData.message || 'Your account has been suspended.'
        );
        sessionStorage.setItem('banReason', errorData.bannedReason || '');
        sessionStorage.setItem('banSupport', JSON.stringify(errorData.support || {}));
        sessionStorage.setItem('banUserEmail', errorData.userEmail || identifier);

        if (errorData.appealToken) {
          sessionStorage.setItem('banAppealToken', errorData.appealToken);
        }

        window.location.href = '/account-suspended';
        return { success: false, banned: true };
      }

      // Handle unverified user - redirect to OTP page
      if (errorData?.unverified) {
        showToast.warning('Please verify your account to continue.', 'Verification Required');
        return { success: false, unverified: true, email: errorData.email };
      }

      showToast.error(errorData?.message || 'Login failed');
      return { success: false, error: errorData?.message };
    }
  };

  const register = async (username, email, password, additionalData = {}) => {
    try {
      const { data } = await api.post('/auth/register', {
        username,
        email,
        password,
        ...additionalData,
      });

      // Account already exists and is verified - redirect to login
      if (data.accountExists) {
        showToast.info('Check your email for further instructions', 'Email Sent');
        return { success: true, accountExists: true };
      }

      // Unverified account - redirect to OTP page
      if (data.requireVerification) {
        showToast.success('Please verify your email to continue', 'Account Created');
        return { success: true, requireVerification: true, email: data.email };
      }

      // Update memory token
      setAccessToken(data.accessToken);

      const userData = {
        _id: data._id,
        internalId: data.internalId,
        eliteId: data.eliteId,
        snapId: data.snapId,
        idTier: data.idTier,
        idNumber: data.idNumber,
        email: data.email,
        username: data.username,
        usernameChangedAt: data.usernameChangedAt,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        company: data.company,
        website: data.website,
        bio: data.bio,
        avatar: data.avatar,
        role: data.role,
        createdAt: data.createdAt,
        lastLoginAt: data.lastLoginAt,
        subscription: data.subscription,
        linkUsage: data.linkUsage,
        clickUsage: data.clickUsage,
      };
      setUser(userData);
      showToast.success('Your account is ready!', 'Welcome');

      // Background refresh: fetch comprehensive user data
      checkAuth();

      return { success: true, user: userData };
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Registration failed');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      // Clear bio auth timestamp (24h re-auth policy)
      try {
        localStorage.removeItem('ls_bio_auth_at');
      } catch {
        /* ignore */
      }

      // Redirect FIRST before clearing state to prevent ErrorBoundary flashes
      window.location.replace('/');

      setTimeout(() => {
        setAccessToken(null);
        setUser(null);
      }, 0);
    } catch {
      // Logout error - still clear local state and redirect
      try {
        localStorage.removeItem('ls_bio_auth_at');
      } catch {
        /* ignore */
      }

      // Redirect FIRST before clearing state to prevent ErrorBoundary flashes
      window.location.replace('/');

      setTimeout(() => {
        setAccessToken(null);
        setUser(null);
      }, 0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        isAuthChecking,
        login,
        register,
        logout,
        authModal,
        openAuthModal,
        closeAuthModal,
        // Expose manual refresh
        refreshUser: () => checkAuth(),
        isAdmin: user?.role === 'admin' || user?.role === 'master_admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
