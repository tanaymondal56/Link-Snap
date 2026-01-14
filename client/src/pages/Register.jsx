import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Mail, Lock, ArrowRight, CheckCircle, User, XCircle, Check, X } from 'lucide-react';
import showToast from '../utils/toastUtils';
import api from '../lib/api';

const Register = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid | reserved
  const { register, user } = useAuth();
  const navigate = useNavigate();

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    // Validate format first
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
        if (data.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus(data.reason === 'reserved' ? 'reserved' : 'taken');
        }
      } catch (error) {
        console.error('Username check failed:', error);
        setUsernameStatus('idle'); // Don't block on error
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [username]);

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      showToast.warning('Password must be at least 8 characters long', 'Weak Password');
      return;
    }
    if (password !== confirmPassword) {
      showToast.warning("Your passwords don't match", 'Check Again');
      return;
    }
    if (!username) {
      showToast.warning("Please enter a username", 'Missing Info');
      return;
    }
    if (username.length < 3 || username.length > 30) {
      showToast.warning("Username must be 3-30 characters long", 'Invalid Username');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      showToast.warning("Username can only contain lowercase letters, numbers, underscores, and dashes", 'Invalid Username');
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'reserved') {
      showToast.warning("This username is not available", 'Username Taken');
      return;
    }

    setIsLoading(true);
    const result = await register(username, email, password);
    setIsLoading(false);
    if (result.success && !result.requireVerification) {
      navigate('/dashboard');
    }
  };

  const getUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />;
      case 'available':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'taken':
      case 'reserved':
      case 'invalid':
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getUsernameStatusMessage = () => {
    switch (usernameStatus) {
      case 'available':
        return <span className="text-green-500 text-xs">Available!</span>;
      case 'taken':
        return <span className="text-red-500 text-xs">Already taken</span>;
      case 'reserved':
        return <span className="text-red-500 text-xs">Not available</span>;
      case 'invalid':
        return <span className="text-red-500 text-xs">Invalid format</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-blob animation-delay-2000" />

      <div className="max-w-md w-full space-y-8 glass-dark p-8 rounded-2xl shadow-2xl relative z-10 border border-white/10">
        <div className="text-center">
          <h2 className="mt-2 text-3xl font-bold text-white">Create your account</h2>
          <p className="mt-2 text-sm text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in instead
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={`block w-full pl-10 pr-10 py-3 border rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm ${
                  usernameStatus === 'available' ? 'border-green-500/50' :
                  usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'invalid' ? 'border-red-500/50' :
                  'border-gray-700'
                }`}
                placeholder="Username (unique, lowercase, alphanumeric)"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {getUsernameStatusIcon()}
              </div>
            </div>
            {getUsernameStatusMessage() && (
              <div className="ml-1 -mt-2">{getUsernameStatusMessage()}</div>
            )}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CheckCircle className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <span className="flex items-center">
                  Sign up{' '}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
