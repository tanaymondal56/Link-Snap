import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Important for cookies
  timeout: 10000, // 10 seconds timeout
});

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

// Request interceptor to attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

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

    // Skip refresh logic for auth endpoints to avoid loops
    const isAuthEndpoint = originalRequest.url.includes('/auth/');

    // If error is 401 (Unauthorized) and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint (cookie is sent automatically)
        const { data } = await api.get('/auth/refresh');

        // Check if banned response from refresh endpoint
        if (data.banned) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          sessionStorage.setItem('banMessage', data.message || 'Your account has been suspended.');
          if (data.bannedReason) sessionStorage.setItem('banReason', data.bannedReason);
          if (data.bannedAt) sessionStorage.setItem('banBannedAt', data.bannedAt);
          if (data.bannedUntil) sessionStorage.setItem('banBannedUntil', data.bannedUntil);
          if (data.userEmail) sessionStorage.setItem('banUserEmail', data.userEmail);
          window.location.href = '/account-suspended';
          return Promise.reject(new Error('Account suspended'));
        }

        // Save new access token
        localStorage.setItem('accessToken', data.accessToken);

        // Process queued requests
        processQueue(null, data.accessToken);

        // Update header and retry original request
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Check if refresh failed due to ban
        if (refreshError.response?.status === 403 && refreshError.response?.data?.banned) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          const banData = refreshError.response.data;
          sessionStorage.setItem('banMessage', banData.message || 'Your account has been suspended.');
          if (banData.bannedReason) sessionStorage.setItem('banReason', banData.bannedReason);
          if (banData.bannedAt) sessionStorage.setItem('banBannedAt', banData.bannedAt);
          if (banData.bannedUntil) sessionStorage.setItem('banBannedUntil', banData.bannedUntil);
          if (banData.userEmail) sessionStorage.setItem('banUserEmail', banData.userEmail);
          window.location.href = '/account-suspended';
        }

        // If refresh fails, clear token but DON'T redirect (let AuthContext handle it)
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
