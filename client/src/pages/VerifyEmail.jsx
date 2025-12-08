import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { setAccessToken } from '../api/axios';
import showToast from '../components/ui/Toast';
import { handleApiError } from '../utils/errorHandler';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Verifying your email...');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  
  // Track if we've already succeeded to ignore any subsequent error responses
  const hasSucceeded = useRef(false);
  // Track if request is in flight to prevent duplicate calls
  const isVerifying = useRef(false);

  const handleResendLink = async () => {
    if (!resendEmail) return;
    setIsResending(true);
    try {
      await api.post('/auth/resend-otp', { email: resendEmail });
      showToast.success('A new verification email has been sent!');
      navigate('/verify-otp', { state: { email: resendEmail } });
    } catch (error) {
      handleApiError(error, 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    // If already succeeded or already verifying, don't start another request
    if (hasSucceeded.current || isVerifying.current) {
      return;
    }
    
    const abortController = new AbortController();
    isVerifying.current = true;

    const verify = async () => {
      try {
        const response = await api.get(`/auth/verify-email/${token}`, {
          signal: abortController.signal
        });
        
        // Request succeeded - mark as success
        hasSucceeded.current = true;
        isVerifying.current = false;
        
        // Check if already verified (came from our improved server response)
        if (response.data?.alreadyVerified) {
          setStatus('success');
          setMessage('Your email is already verified! Redirecting to login...');
          showToast.success('Your email is already verified', 'Verified');
          setTimeout(() => navigate('/login'), 2000);
        } else if (response.data?.accessToken) {
          // New: Auto-login with returned tokens
          setAccessToken(response.data.accessToken);
          const userData = {
            _id: response.data._id,
            email: response.data.email,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            role: response.data.role,
          };
          setUser?.(userData);
          
          setStatus('success');
          setMessage('Email verified! Logging you in...');
          showToast.success('Account verified successfully!', 'Welcome');
          setTimeout(() => navigate('/dashboard'), 1500);
        } else {
          setStatus('success');
          setMessage('Email verified successfully! Redirecting...');
          showToast.success('Your email has been verified', 'Verified');
          setTimeout(() => navigate('/login'), 2000);
        }
        
      } catch (error) {
        // Ignore aborted requests (cleanup from Strict Mode)
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || abortController.signal.aborted) {
          return;
        }
        
        // If we've already succeeded, ignore this error
        // (it's from a duplicate request that failed after success)
        if (hasSucceeded.current) {
          return;
        }
        
        isVerifying.current = false;
        
        // Check if it's an "already verified" scenario
        const errorMessage = error.response?.data?.message || '';
        
        // If the error indicates the token was already used, treat it as success
        if (errorMessage.toLowerCase().includes('already verified') || 
            errorMessage.toLowerCase().includes('already been verified')) {
          hasSucceeded.current = true;
          setStatus('success');
          setMessage('Your email is already verified! Redirecting to login...');
          showToast.success('Your email is already verified', 'Verified');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }
        
        setStatus('error');
        setMessage(
          errorMessage || 'Verification failed. Token may be invalid or expired.'
        );
        showToast.error('Token may be invalid or expired', 'Verification Failed');
      }
    };
    
    verify();

    // Cleanup: abort request if component unmounts (Strict Mode)
    return () => {
      abortController.abort();
    };
  }, [token, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-8 rounded-2xl shadow-xl text-center">
        {status === 'verifying' && (
          <div className="flex flex-col items-center">
            <Loader className="w-16 h-16 text-purple-500 animate-spin mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verifying...</h2>
            <p className="text-gray-400">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verified!</h2>
            <p className="text-gray-400">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
            <p className="text-gray-400 mb-6">{message}</p>
            
            {/* Request New Link Section */}
            <div className="w-full mb-6">
              <p className="text-sm text-gray-400 mb-3 text-center">Enter your email to request a new verification link:</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleResendLink}
                  disabled={isResending || !resendEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
                >
                  {isResending ? 'Sending...' : 'Resend'}
                </button>
              </div>
              {resendEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail) && (
                <p className="text-xs text-red-400 mt-2">Please enter a valid email address</p>
              )}
            </div>
            
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;


