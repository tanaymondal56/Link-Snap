import axios from 'axios';

// Dynamically determine API base URL
// In production: use relative '/api' (works with Cloudflare, etc.)
// In development: use VITE_API_URL or localhost
const getBaseURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const isProduction = import.meta.env.PROD;

  // In production: always use relative path (same origin)
  // This routes requests through the CF Pages /api proxy function
  if (isProduction) {
    return '/api';
  }

  // In development: use env var or fallback
  if (apiUrl) {
    return apiUrl;
  }
  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Important for cookies
  timeout: 10000, // 10 seconds timeout
});

export const setAccessToken = () => {
  // No-op
};

export const getAccessToken = () => {
  return null;
};

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper to get cookie value by name
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Request interceptor to attach access token and CSRF token
api.interceptors.request.use(
  (config) => {
    // Using HttpOnly cookies instead of Authorization header for access tokens
    
    // Attach CSRF token for state-changing requests
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('XSRF-TOKEN');
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh and banned users
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 403 Banned User - Immediate logout and redirect
    if (error.response?.status === 403 && error.response?.data?.banned) {
      // Clear all auth data immediately
      localStorage.removeItem('ls_auth_user');
      localStorage.removeItem('ls_auth_cached_at');

      // Store the ban message and details for the suspended page
      const banData = error.response.data;
      sessionStorage.setItem('banMessage', banData.message || 'Your account has been suspended.');
      if (banData.bannedReason) {
        sessionStorage.setItem('banReason', banData.bannedReason);
      }
      if (banData.bannedAt) {
        sessionStorage.setItem('banBannedAt', banData.bannedAt);
      }
      if (banData.bannedUntil) {
        sessionStorage.setItem('banBannedUntil', banData.bannedUntil);
      }
      if (banData.userEmail) {
        sessionStorage.setItem('banUserEmail', banData.userEmail);
      }

      // Redirect to account suspended page
      window.location.href = '/account-suspended';
      return Promise.reject(error);
    }

    // Skip refresh logic for auth endpoints to avoid loops, EXCEPT for /auth/me which is a normal protected route
    const isAuthEndpoint = originalRequest.url.includes('/auth/') && !originalRequest.url.includes('/auth/me');

    // If error is 401 (Unauthorized) with TOKEN_EXPIRED code and we haven't tried to refresh yet.
    // Only refresh on expired tokens; do not refresh on DBSC failures or other auth errors.
    const isTokenExpired = error.response?.status === 401 && 
      (error.response?.data?.code === 'TOKEN_EXPIRED' || !error.response?.data?.code);
    if (isTokenExpired && !originalRequest._retry && !isAuthEndpoint) {

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest._retry = true;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint with POST (cookie is sent automatically)
        const { data } = await api.post('/auth/refresh');

        // Check if banned response from refresh endpoint
        if (data.banned) {
          localStorage.removeItem('ls_auth_user');
          localStorage.removeItem('ls_auth_cached_at');
          sessionStorage.setItem('banMessage', data.message || 'Your account has been suspended.');
          if (data.bannedReason) sessionStorage.setItem('banReason', data.bannedReason);
          if (data.bannedAt) sessionStorage.setItem('banBannedAt', data.bannedAt);
          if (data.bannedUntil) sessionStorage.setItem('banBannedUntil', data.bannedUntil);
          if (data.userEmail) sessionStorage.setItem('banUserEmail', data.userEmail);
          window.location.href = '/account-suspended';
          return Promise.reject(new Error('Account suspended'));
        }

        // Process queued requests
        processQueue(null, data.accessToken);

        // Retry original request (cookie is sent automatically)
        return api(originalRequest);
      } catch (refreshError) {
        // Check if refresh failed due to ban
        if (refreshError.response?.status === 403 && refreshError.response?.data?.banned) {
          localStorage.removeItem('ls_auth_user');
          localStorage.removeItem('ls_auth_cached_at');
          const banData = refreshError.response.data;
          sessionStorage.setItem('banMessage', banData.message || 'Your account has been suspended.');
          if (banData.bannedReason) sessionStorage.setItem('banReason', banData.bannedReason);
          if (banData.bannedAt) sessionStorage.setItem('banBannedAt', banData.bannedAt);
          if (banData.bannedUntil) sessionStorage.setItem('banBannedUntil', banData.bannedUntil);
          if (banData.userEmail) sessionStorage.setItem('banUserEmail', banData.userEmail);
          window.location.href = '/account-suspended';
        }

        // Only clear token on explicit auth failures (401/403), NOT on network errors
        // This prevents logout when server is temporarily unavailable
        if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
          window.dispatchEvent(new Event('auth:logout'));
          processQueue(refreshError, null);
        } else {
          // Network error or server unavailable - keep token and let user retry
          processQueue(refreshError, null);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
