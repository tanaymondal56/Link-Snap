import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  User,
  Building2,
  Phone,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import showToast from './ui/Toast';
import api from '../api/axios';

const AuthModal = ({ isOpen, onClose, defaultTab = 'login', onSuccess }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid | reserved
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !prevOpen) {
      setPrevOpen(true);
      setActiveTab(defaultTab);
      setIdentifier('');
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setCompany('');
      setShowPassword(false);
      setUsernameStatus('idle');
    } else if (!isOpen && prevOpen) {
      setPrevOpen(false);
    }
  }, [isOpen, prevOpen, defaultTab]);

  // Debounced username availability check
  useEffect(() => {
    if (activeTab !== 'register' || !username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      setUsernameStatus('invalid');
      return;
    }
    if (username.length > 30) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username/${username}`);
        setUsernameStatus(data.available ? 'available' : (data.reason === 'reserved' ? 'reserved' : 'taken'));
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [username, activeTab]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Identifier validation (email or username required)
    if (!identifier.trim()) {
      showToast.warning('Please enter your email or username', 'Missing Field');
      return;
    }
    
    // Password required
    if (!password) {
      showToast.warning('Please enter your password', 'Missing Password');
      return;
    }
    
    setIsLoading(true);
    const result = await login(identifier, password);
    setIsLoading(false);

    if (result.success) {
      onSuccess?.();
      onClose();

      // Check if admin and redirect to admin panel on first login
      // Only redirect if not already choosing a specific destination
      if (result.user?.role === 'admin') {
        // Check if admin has visited admin panel before (stored in localStorage)
        const hasVisitedAdmin = localStorage.getItem('adminVisited');
        if (!hasVisitedAdmin) {
          localStorage.setItem('adminVisited', 'true');
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } else if (result.unverified) {
      // User needs to verify their email - redirect to OTP page
      onClose();
      navigate('/verify-otp', { state: { email: result.email } });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast.warning('Please enter a valid email address', 'Invalid Email');
      return;
    }
    
    // Username validation
    if (!username.trim()) {
      showToast.warning('Username is required', 'Missing Field');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      showToast.warning('Username can only contain lowercase letters, numbers, underscores, and dashes', 'Invalid Username');
      return;
    }
    if (username.length < 3 || username.length > 30) {
      showToast.warning('Username must be 3-30 characters', 'Invalid Username');
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'reserved') {
      showToast.warning('This username is not available', 'Username Taken');
      return;
    }
    
    // First name is required
    if (!firstName.trim()) {
      showToast.warning('First name is required', 'Missing Field');
      return;
    }
    
    // First name format
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(firstName.trim())) {
      showToast.warning('First name can only contain letters, spaces, hyphens, and apostrophes', 'Invalid Name');
      return;
    }
    
    // Last name format (if provided)
    if (lastName.trim() && !nameRegex.test(lastName.trim())) {
      showToast.warning('Last name can only contain letters, spaces, hyphens, and apostrophes', 'Invalid Name');
      return;
    }
    
    // Password validation
    if (password.length < 8) {
      showToast.warning('Password must be at least 8 characters', 'Too Short');
      return;
    }
    if (!/[a-z]/.test(password)) {
      showToast.warning('Password must contain at least one lowercase letter', 'Weak Password');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast.warning('Password must contain at least one uppercase letter', 'Weak Password');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast.warning('Password must contain at least one number', 'Weak Password');
      return;
    }
    
    // Confirm password
    if (password !== confirmPassword) {
      showToast.warning("Passwords don't match", 'Check Again');
      return;
    }
    
    // Phone validation (if provided)
    if (phone.trim() && !/^[\d\s\-+()]+$/.test(phone.trim())) {
      showToast.warning('Please enter a valid phone number', 'Invalid Phone');
      return;
    }
    
    setIsLoading(true);
    const result = await register(username, email, password, {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
    });
    setIsLoading(false);

    if (result.success) {
      if (result.accountExists) {
        // Account already exists - switch to login tab, don't redirect to OTP
        setActiveTab('login');
        // Keep modal open so user can log in
      } else if (result.requireVerification) {
        // Close modal, user needs to verify email
        onClose();
        navigate('/verify-otp', { state: { email: result.email } });
      } else {
        onSuccess?.();
        onClose();
        navigate('/dashboard');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[95%] max-w-md animate-modal-in flex flex-col max-h-[95vh] overscroll-contain">
        {/* Gradient border effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-75 blur-sm" />

        <div className="relative bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header with tabs */}
          <div className="pt-8 px-8 shrink-0">
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>

            {/* Tab switcher */}
            <div className="flex bg-gray-800/50 rounded-xl p-1 mb-6">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={activeTab === 'login' ? handleLogin : handleRegister}
            className="px-8 pb-8 space-y-4 overflow-y-auto custom-scrollbar"
          >
            {/* Email / Username for Login, Email for Register */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              </div>
              {activeTab === 'login' ? (
                <>
                  <input
                    type="text"
                    required
                    placeholder="Email or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </>
              ) : (
                <input
                  type="email"
                  required
                  placeholder="Email address *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              )}
            </div>

            {/* Username - Required (Register only) */}
            {activeTab === 'register' && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Username * (e.g., john_doe)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className={`w-full pl-12 pr-12 py-3.5 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all ${
                    usernameStatus === 'available' ? 'border-green-500/50' :
                    usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'invalid' ? 'border-red-500/50' :
                    'border-gray-700'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  {usernameStatus === 'checking' && <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />}
                  {usernameStatus === 'available' && <Check className="h-5 w-5 text-green-500" />}
                  {(usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'invalid') && <X className="h-5 w-5 text-red-500" />}
                </div>
                <p className={`mt-1 text-xs ${usernameStatus === 'available' ? 'text-green-500' : usernameStatus === 'taken' || usernameStatus === 'reserved' ? 'text-red-500' : 'text-gray-500'}`}>
                  {usernameStatus === 'available' ? 'Available!' : usernameStatus === 'taken' ? 'Already taken' : usernameStatus === 'reserved' ? 'Not available' : usernameStatus === 'invalid' ? 'Invalid format' : 'Lowercase letters, numbers, underscores, dashes only'}
                </p>
              </div>
            )}

            {/* Password */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Forgot Password Link (Login only) */}
            {activeTab === 'login' && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/forgot-password');
                  }}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Confirm Password (Register only) */}
            {activeTab === 'register' && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CheckCircle className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>
            )}

            {/* First Name - Required (Register only) */}
            {activeTab === 'register' && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="First name *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>
            )}

            {/* Additional Fields (Register only) */}
            {activeTab === 'register' && (
              <>
                {/* Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-gray-900 text-gray-500">Optional Information</span>
                  </div>
                </div>

                {/* Last Name Field */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  />
                </div>

                {/* Phone Field */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    placeholder="Phone number (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  />
                </div>

                {/* Company Field */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Company (optional)"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  />
                </div>
              </>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gray-900 text-gray-500">
                  {activeTab === 'login' ? "Don't have an account?" : 'Already have an account?'}
                </span>
              </div>
            </div>

            {/* Switch tab link */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')}
              className="w-full py-3 text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              {activeTab === 'login' ? 'Create a free account' : 'Sign in to your account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
