import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
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
import DevCommandCenter from './components/DevCommandCenter';
import EasterEggs from './components/EasterEggs';
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
const BioSettings = lazy(() => import('./pages/dashboard/BioSettings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// New Admin Console Pages
const AdminConsoleLayout = lazy(() => import('./layouts/AdminConsoleLayout'));
const AdminOverview = lazy(() => import('./pages/admin-console/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin-console/AdminUsers'));
const AdminLinks = lazy(() => import('./pages/admin-console/AdminLinks'));
const AdminFeedback = lazy(() => import('./pages/admin-console/AdminFeedback'));
const AdminSettings = lazy(() => import('./pages/admin-console/AdminSettings'));
const AdminMonitoring = lazy(() => import('./pages/admin-console/AdminMonitoring'));
const AdminSubscriptions = lazy(() => import('./pages/admin-console/AdminSubscriptions'));
const DeviceManagement = lazy(() => import('./pages/admin-console/DeviceManagement'));
const ChangelogManager = lazy(() => import('./components/admin/ChangelogManager')); // Reusing existing
const PricingPage = lazy(() => import('./pages/PricingPage'));
const RedeemPage = lazy(() => import('./pages/RedeemPage'));

// Legal Pages
const TermsPage = lazy(() => import('./pages/legal/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'));
const CookiePage = lazy(() => import('./pages/legal/CookiePage'));

// Easter Egg Pages
const CreditsPage = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.CreditsPage })));
const TimelinePage = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.TimelinePage })));
const ThanksPage = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.ThanksPage })));
const DevNullPage = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.DevNullPage })));
const Funny404Page = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.Funny404Page })));
const TeapotPage = lazy(() => import('./pages/EasterEggPages').then(m => ({ default: m.TeapotPage })));

// Link-in-Bio Public Profile
const PublicProfile = lazy(() => import('./pages/PublicProfile'));

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
      {/* Dev Command Center - only in development */}
      <DevCommandCenter />
      {/* Easter Eggs - keyboard triggers and effects */}
      <EasterEggs />
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
            <Route path="/account-suspended" element={<AccountSuspended />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/redeem" element={<RedeemPage />} />
            
            {/* Legal Pages */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiePage />} />
          </Route>

          {/* Changelog Route - Standalone page */}
          {/* Changelog Route - Standalone page */}
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/roadmap" element={<Roadmap />} />

          {/* Easter Egg Routes */}
          <Route path="/easter/credits" element={<CreditsPage />} />
          <Route path="/easter/timeline" element={<TimelinePage />} />
          <Route path="/easter/thanks" element={<ThanksPage />} />
          <Route path="/dev/null" element={<DevNullPage />} />
          <Route path="/404" element={<Funny404Page />} />
          <Route path="/teapot" element={<TeapotPage />} />

          {/* Link-in-Bio Public Profile - using /u/ prefix (React Router V6 has issues with @ in paths) */}
          <Route path="/u/:username" element={<PublicProfile />} />

          {/* Dashboard Routes (Protected) */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="/dashboard/overview" element={<OverviewPage />} />
            <Route path="/dashboard/links" element={<UserDashboard />} />
            <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/analytics/:shortId" element={<AnalyticsPage />} />
            <Route path="/dashboard/bio" element={<BioSettings />} />
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
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="devices" element={<DeviceManagement />} />
            <Route path="changelog" element={<ChangelogManager />} />
          </Route>

          {/* Redirect old login/register routes to home with modal */}
          <Route path="/login" element={<AuthRedirect tab="login" />} />
          <Route path="/register" element={<AuthRedirect tab="register" />} />

          {/* 404 Route */}
          <Route
            path="*"
            element={
              <div 
                className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white cursor-pointer group"
                onClick={() => {
                  // Sad trombone sound on click (requires user interaction)
                  try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const notes = [300, 280, 260, 200];
                    notes.forEach((freq, i) => {
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.frequency.value = freq;
                      osc.type = 'sawtooth';
                      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.3);
                      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.3 + 0.3);
                      osc.start(ctx.currentTime + i * 0.3);
                      osc.stop(ctx.currentTime + i * 0.3 + 0.35);
                    });
                  } catch {
                    // AudioContext may not be available
                  }
                }}
              >
                <div className="text-8xl mb-4 animate-bounce">😢</div>
                <h1 className="text-6xl font-bold text-gray-600 group-hover:text-red-400 transition-colors">404</h1>
                <p className="text-xl text-gray-400 mt-4">Page Not Found</p>
                <p className="text-sm text-gray-600 mt-2 group-hover:text-gray-400 transition-colors">
                  Click for sad trombone 🎺
                </p>
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
    <HelmetProvider>
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
    </HelmetProvider>
  );
}

export default App;
