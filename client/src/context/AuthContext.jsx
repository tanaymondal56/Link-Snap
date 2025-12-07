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
            console.log(
              `Server unreachable, retrying in ${delay / 1000}s... (${retryCount + 1}/5)`
            );
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

    checkAuth();

    return () => clearTimeout(timeoutId);
  }, []);

  const openAuthModal = (tab = 'login') => {
    setAuthModal({ isOpen: true, tab });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, tab: 'login' });
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      
      // Update memory token
      setAccessToken(data.accessToken);
      
      const userData = {
        _id: data._id,
        email: data.email,
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
        sessionStorage.setItem('banUserEmail', errorData.userEmail || email);

        if (errorData.appealToken) {
          sessionStorage.setItem('banAppealToken', errorData.appealToken);
        }

        window.location.href = '/account-suspended';
        return { success: false, banned: true };
      }

      showToast.error(errorData?.message || 'Login failed');
      return { success: false, error: errorData?.message };
    }
  };

  const register = async (email, password, additionalData = {}) => {
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        ...additionalData,
      });

      if (data.requireVerification) {
        showToast.info('Please check your email to verify your account', 'Verification Required');
        return { success: true, requireVerification: true };
      }

      // Update memory token
      setAccessToken(data.accessToken);
      
      const userData = {
        _id: data._id,
        email: data.email,
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
