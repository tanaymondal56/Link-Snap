import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
        },
      }} />
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<div className="text-center mt-20 text-2xl">Landing Page (Coming Soon)</div>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<div className="text-2xl">Dashboard Overview (Coming Soon)</div>} />
          <Route path="links" element={<div className="text-2xl">My Links (Coming Soon)</div>} />
          <Route path="analytics" element={<div className="text-2xl">Analytics (Coming Soon)</div>} />
          <Route path="settings" element={<div className="text-2xl">Settings (Coming Soon)</div>} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<div className="min-h-screen flex items-center justify-center text-2xl font-bold text-gray-800 dark:text-white">404 - Page Not Found</div>} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
