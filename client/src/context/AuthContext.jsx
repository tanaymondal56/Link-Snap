import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
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
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
        setLoading(false);
      } catch (error) {
        // Only treat 401/403 as definitive "not logged in"
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.log('Not authenticated');
          setUser(null);
          localStorage.removeItem('accessToken');
          setLoading(false);
        } else {
          // For network errors (server restarting), retry up to 3 times
          if (retryCount < 3) {
            console.log(`Server unreachable, retrying... (${retryCount + 1}/3)`);
            setTimeout(() => checkAuth(retryCount + 1), 1000); // Retry after 1s
          } else {
            console.error('Auth check failed after retries', error);
            setUser(null);
            setLoading(false);
          }
        }
      }
    };

    checkAuth();
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
      localStorage.setItem('accessToken', data.accessToken);
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

        // Store email - prefer from response, fallback to input email
        sessionStorage.setItem('banUserEmail', errorData.userEmail || email);

        // Store appeal token
        if (errorData.appealToken) {
          sessionStorage.setItem('banAppealToken', errorData.appealToken);
        }

        // Redirect to account suspended page
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

      // Check if verification is required
      if (data.requireVerification) {
        showToast.info('Please check your email to verify your account', 'Verification Required');
        return { success: true, requireVerification: true };
      }

      localStorage.setItem('accessToken', data.accessToken);
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
      localStorage.removeItem('accessToken');
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
