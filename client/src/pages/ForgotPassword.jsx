import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { handleApiError } from '../utils/errorHandler';
import { Loader, Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Client-side email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation BEFORE API call
    if (!email.trim()) {
      showToast.warning('Please enter your email address', 'Missing Email');
      return;
    }

    if (!validateEmail(email)) {
      showToast.warning('Please enter a valid email address', 'Invalid Email');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.toLowerCase() });

      // Handle unverified user - redirect to verify OTP
      if (data.unverified) {
        showToast.info('Please verify your email first', 'Verification Required');
        navigate('/verify-otp', { state: { email: data.email } });
        return;
      }

      // Success - show success state (use input email, not response)
      setIsSuccess(true);
      showToast.success('Check your email for reset instructions', 'Email Sent');

    } catch (error) {
      handleApiError(error, 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1d] p-4 text-white relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] -left-[10%] w-[50vw] h-[50vw] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        {!isSuccess ? (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                Forgot Password?
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                No worries! Enter your email and we'll send you reset instructions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    Send Reset Link <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link 
                to="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </>
        ) : (
          // Success State
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-green-500 to-emerald-500 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Check Your Email</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              We've sent password reset instructions to<br/>
              <span className="text-white font-medium">{email}</span>
            </p>
            <p className="text-gray-500 text-xs mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate('/reset-password', { state: { email } })}
                className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
              >
                Enter Reset Code
              </button>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="w-full py-3 rounded-xl font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-all"
              >
                Try Different Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
