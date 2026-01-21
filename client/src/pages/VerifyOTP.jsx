import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { setAccessToken } from '../api/axios';
import showToast from '../utils/toastUtils';
import { handleApiError } from '../utils/errorHandler';
import { Loader, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  
  // Get email from router state or internal storage
  // If user refreshes, we might lose state, so session storage backup is good
  const [email, setEmail] = useState('');
  
  useEffect(() => {
    // Priority: 1. Router state, 2. URL param, 3. Session storage
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmail = urlParams.get('email');
    
    if (location.state?.email) {
      setEmail(location.state.email);
      sessionStorage.setItem('verifyEmail', location.state.email);
    } else if (urlEmail) {
      setEmail(urlEmail);
      sessionStorage.setItem('verifyEmail', urlEmail);
    } else {
      const stored = sessionStorage.getItem('verifyEmail');
      if (stored) {
        setEmail(stored);
      }
      // Don't redirect immediately - email might be set on next render
      // Only show error after a small delay to prevent false negatives
    }
  }, [location]);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [activeResend, setActiveResend] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef([]);

  // Timer logic
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setActiveResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, value) => {
    // allow only numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace logic
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    // Clean pasted data: remove spaces, dashes, and non-digits
    const cleanedData = e.clipboardData.getData('text').replace(/[\s-]/g, '');
    const pastedData = cleanedData.slice(0, 6).split('');
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      pastedData.forEach((val, i) => {
        if (i < 6 && /^\d+$/.test(val)) newOtp[i] = val;
      });
      setOtp(newOtp);
      inputRefs.current[Math.min(pastedData.length, 5)].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return;

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp: otpCode });
      
      // Success!
      
      // Check if user was already verified (and thus no tokens returned)
      if (data.message === 'Email already verified' || !data.accessToken) {
        showToast.info('Email already verified. Please login.', 'Account Verified');
        sessionStorage.removeItem('verifyEmail');
        navigate('/login');
        return;
      }

      // Log them in
      setAccessToken(data.accessToken);
      
      // Update AuthContext user
      const userData = {
        _id: data._id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      };
      // We need to update user context - but we can't easily access setUser directly here 
      // if it's not exposed properly. 
      // Assumption: useAuth exposes setUser based on previous reads, if not we'll rely on silent refresh redirect
      setUser?.(userData);

      showToast.success('Account verified successfully!', 'Welcome');
      sessionStorage.removeItem('verifyEmail');
      navigate('/dashboard');

    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.expired) {
        // OTP expired - show clear message and enable resend
        showToast.warning('Your code has expired. Click "Resend Code" to get a new one.', 'Code Expired');
        setActiveResend(true);
        setTimer(0);
      } else if (!navigator.onLine) {
        showToast.error("You're offline. Please check your connection.", 'No Connection');
      } else if (!error.response) {
        showToast.error("Couldn't reach the server. Please try again.", 'Server Unavailable');
      } else {
        showToast.error(errorData?.message || 'Verification failed');
      }
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

      {/* Error state when email is missing */}
      {!email ? (
        <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-red-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Email Not Found</h2>
          <p className="text-gray-400 text-sm mb-6">
            We couldn't find your email for verification. Please try signing up or logging in again.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Go to Home
          </button>
        </div>
      ) : (
      <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
            Verify Account
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We sent a code to <span className="text-white font-medium">{email}</span>. 
            Enter it below or click the link in the email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-between gap-2 sm:gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all duration-300 text-white placeholder-gray-600"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={otp.join('').length !== 6 || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              otp.join('').length === 6
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25 transform hover:-translate-y-0.5'
                : 'bg-white/5 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <Loader className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Verify Email <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Didn't receive the code?{' '}
            {activeResend ? (
              <button 
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isResending}
                onClick={async () => {
                  try {
                    setIsResending(true);
                    setTimer(60); 
                    setActiveResend(false);
                    await api.post('/auth/resend-otp', { email });
                    showToast.success('A new code has been sent to your email!');
                  } catch (error) {
                    handleApiError(error, 'Failed to resend code');
                    setActiveResend(true); // Re-enable on error
                  } finally {
                    setIsResending(false);
                  }
                }}
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            ) : (
              <span className="text-gray-600">Resend in {timer}s</span>
            )}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            <button 
              onClick={() => {
                sessionStorage.removeItem('verifyEmail');
                navigate('/');
              }}
              className="text-gray-400 hover:text-white transition-colors underline"
            >
              Use a different email
            </button>
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

export default VerifyOTP;
