import { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../api/axios';
import showToast from '../components/ui/Toast';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState({ isOpen: false, tab: 'login' });

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async (retryCount = 0) => {
      // Secure Auth Load: Try to silent refresh immediately
      // This relies on the httpOnly cookie being present
      try {
        // Attempt to get a new access token using the refresh token cookie
        const { data: refreshData } = await api.get('/auth/refresh');
        
        // If successful, set the token in memory
        setAccessToken(refreshData.accessToken);

        // Then fetch user profile
        const { data: userData } = await api.get('/auth/me');
        setUser(userData);
        setLoading(false);
      } catch (error) {
        // Only treat 401/403 as definitive "not logged in"
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.log('Not authenticated (No valid session)');
          setUser(null);
          setAccessToken(null);
          setLoading(false);
        } else {
          // For network errors (server restarting), retry up to 5 times
          if (retryCount < 5) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            // Only log on first retry to reduce console noise
            if (retryCount === 0) {
              console.log('Server starting, waiting...');
            }
            setTimeout(() => checkAuth(retryCount + 1), delay);
          } else {
            console.error('Auth check failed after retries');
            setUser(null);
            setLoading(false);
          }
        }
      }
    };

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('Auth check timeout - proceeding without auth');
          return false;
        }
        return current;
      });
    }, 15000);

    // Small delay before first auth check to give server time to start
    const startupDelay = setTimeout(() => checkAuth(), 500);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(startupDelay);
    };
  }, []);

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
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      };
      setUser(userData);
      showToast.success(
        data.firstName ? `Welcome back, ${data.firstName}!` : 'Welcome back!',
        'Logged In'
      );
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
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      };
      setUser(userData);
      showToast.success('Your account is ready!', 'Welcome');
      return { success: true, user: userData };
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Registration failed');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setAccessToken(null);
      setUser(null);
      showToast.info('See you next time!', 'Logged Out');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        logout,
        authModal,
        openAuthModal,
        closeAuthModal,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
