import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import { AuthProvider } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import ConfirmDialogProvider from './components/ui/ConfirmDialog';
import DialogProvider from './components/ui/DialogProvider';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import PostUpdateChoiceModal from './components/PostUpdateChoiceModal';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';

// Lazy Loaded Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AccountSuspended = lazy(() => import('./pages/AccountSuspended'));
const Changelog = lazy(() => import('./pages/Changelog'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Auth Modal wrapper component
const AuthModalWrapper = () => {
  const { authModal, closeAuthModal } = useAuth();

  return (
    <AuthModal isOpen={authModal.isOpen} onClose={closeAuthModal} defaultTab={authModal.tab} />
  );
};

// Redirect old auth routes to home with modal
const AuthRedirect = ({ tab }) => {
  const { openAuthModal, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    if (user) {
      navigate('/dashboard', { replace: true });
    } else {
      // Navigate first, then open modal after a small delay
      navigate('/', { replace: true });
      // Use setTimeout to ensure navigation completes before opening modal
      setTimeout(() => {
        openAuthModal(tab);
      }, 100);
    }
  }, [user, loading, navigate, openAuthModal, tab]);

  // Show loading while checking auth
  if (loading) {
    return <LoadingFallback />;
  }

  return null;
};

function AppContent() {
  return (
    <>
      {/* Handle post-update choice modal */}
      <PostUpdateChoiceModal />
      <Toaster
        position="top-right"
        containerStyle={{
          top: 20,
          right: 20,
        }}
        gutter={12}
      />
      <AuthModalWrapper />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes - Landing Page */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
          </Route>

          {/* Changelog Route - Standalone page */}
          <Route path="/changelog" element={<Changelog />} />

          {/* Account Suspended Route - No layout needed */}
          <Route path="/account-suspended" element={<AccountSuspended />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="links" element={<UserDashboard />} />
            <Route
              path="analytics"
              element={
                <div className="p-8 text-2xl text-white">Analytics Overview (Coming Soon)</div>
              }
            />
            <Route path="analytics/:id" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
          </Route>

          {/* Redirect old login/register routes to home with modal */}
          <Route path="/login" element={<AuthRedirect tab="login" />} />
          <Route path="/register" element={<AuthRedirect tab="register" />} />

          {/* 404 Route */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-950 text-2xl font-bold text-white">
                404 - Page Not Found
              </div>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <DialogProvider>
          <OfflineIndicator>
            <AppContent />
          </OfflineIndicator>
          {/* PWA Update Prompt - shows when new version is available */}
          <PWAUpdatePrompt />
          {/* Add to Home Screen Prompt - shows for mobile users */}
          <InstallPrompt />
        </DialogProvider>
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}

export default App;
