import { useState, useRef } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import showToast from '../utils/toastUtils';
import { handleApiError } from '../utils/errorHandler';
import { Loader, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Check, X } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useParams(); // From URL like /reset-password/:token
  
  // Get email from state or URL params
  const urlParams = new URLSearchParams(location.search);
  const initialEmail = location.state?.email || urlParams.get('email') || '';
  
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const inputRefs = useRef([]);

  // Password validation rules
  const passwordRules = {
    length: newPassword.length >= 8,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  };
  
  const isPasswordValid = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Handle OTP input changes
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pastedData[i] || '';
    }
    setOtp(newOtp);
  };

  // Client-side validation BEFORE API call
  const validateForm = () => {
    // If using token, no need for OTP validation
    if (!token) {
      if (!email.trim()) {
        showToast.warning('Please enter your email', 'Missing Email');
        return false;
      }
      
      const otpValue = otp.join('');
      if (otpValue.length !== 6) {
        showToast.warning('Please enter the 6-digit code', 'Missing Code');
        return false;
      }
    }

    if (!isPasswordValid) {
      showToast.warning('Please meet all password requirements', 'Weak Password');
      return false;
    }

    if (!passwordsMatch) {
      showToast.warning("Passwords don't match", 'Check Again');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation BEFORE API call
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        newPassword,
      };

      if (token) {
        payload.token = token;
      } else {
        payload.email = email.toLowerCase();
        payload.otp = otp.join('');
      }

      await api.post('/auth/reset-password', payload);
      
      setIsSuccess(true);
      showToast.success('Your password has been reset!', 'Success');

    } catch (error) {
      handleApiError(error, 'Failed to reset password');
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
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                Reset Password
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {token ? 'Create a new password for your account.' : 'Enter your reset code and create a new password.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* OTP Section - only show if no token */}
              {!token && (
                <>
                  {/* Email Display/Input */}
                  {initialEmail ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">Resetting password for</p>
                      <p className="text-white font-medium">{initialEmail}</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>
                  )}
                  
                  {/* OTP Inputs */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-3 text-center">Enter the 6-digit code from your email</label>
                    <div className="flex justify-between gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={handlePaste}
                          className="w-12 h-14 text-center text-xl font-bold bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all text-white"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* New Password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-gray-400 mb-2">Password must have:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center gap-1 ${passwordRules.length ? 'text-green-400' : 'text-gray-500'}`}>
                      {passwordRules.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordRules.lowercase ? 'text-green-400' : 'text-gray-500'}`}>
                      {passwordRules.lowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Lowercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordRules.uppercase ? 'text-green-400' : 'text-gray-500'}`}>
                      {passwordRules.uppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Uppercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordRules.number ? 'text-green-400' : 'text-gray-500'}`}>
                      {passwordRules.number ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Number
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all ${
                    confirmPassword && !passwordsMatch 
                      ? 'border-red-500/50 focus:border-red-500' 
                      : confirmPassword && passwordsMatch 
                        ? 'border-green-500/50 focus:border-green-500' 
                        : 'border-white/10 focus:border-purple-500'
                  }`}
                />
                {confirmPassword && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    {passwordsMatch ? (
                      <Check className="h-5 w-5 text-green-400" />
                    ) : (
                      <X className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isPasswordValid || !passwordsMatch}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    Reset Password <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link 
                to="/forgot-password"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Request New Code
              </Link>
            </div>
          </>
        ) : (
          // Success State
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-green-500 to-emerald-500 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Password Reset!</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your password has been successfully reset.<br/>
              You can now log in with your new password.
            </p>
            
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
