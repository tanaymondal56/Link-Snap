import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
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
import MobileBackButton from './components/MobileBackButton';
import { initializeVersion } from './config/version';

// Initialize version cache on app load (non-blocking)
initializeVersion();

// Lazy Loaded Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AccountSuspended = lazy(() => import('./pages/AccountSuspended'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// New Admin Console Pages
const AdminConsoleLayout = lazy(() => import('./layouts/AdminConsoleLayout'));
const AdminOverview = lazy(() => import('./pages/admin-console/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin-console/AdminUsers'));
const AdminLinks = lazy(() => import('./pages/admin-console/AdminLinks'));
const AdminFeedback = lazy(() => import('./pages/admin-console/AdminFeedback'));
const AdminSettings = lazy(() => import('./pages/admin-console/AdminSettings'));
const AdminMonitoring = lazy(() => import('./pages/admin-console/AdminMonitoring'));
const ChangelogManager = lazy(() => import('./components/admin/ChangelogManager')); // Reusing existing

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
          {/* Changelog Route - Standalone page */}
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/roadmap" element={<Roadmap />} />

          {/* Dashboard Routes (Protected) */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="/dashboard/overview" element={<OverviewPage />} />
            <Route path="/dashboard/links" element={<UserDashboard />} />
            <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/analytics/:shortId" element={<AnalyticsPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
          </Route>

          {/* Legacy Admin Route (Protected inside component) */}
          <Route
            path="/admin/*"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />

          {/* New Admin Console Routes (Protected by Layout) */}
          <Route path="/admin-console" element={<AdminConsoleLayout />}>
            <Route index element={<Navigate to="/admin-console/overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="links" element={<AdminLinks />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="monitoring" element={<AdminMonitoring />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="changelog" element={<ChangelogManager />} />
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
          {/* Mobile Back Button - shows in PWA mode for navigation */}
          <MobileBackButton />
        </DialogProvider>
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}

export default App;
