import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Verifying your email...');
  
  // Track if we've already succeeded to ignore any subsequent error responses
  const hasSucceeded = useRef(false);
  // Track if request is in flight to prevent duplicate calls
  const isVerifying = useRef(false);

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
        } else {
          setStatus('success');
          setMessage('Email verified successfully! Redirecting to login...');
          showToast.success('Your email has been verified', 'Verified');
        }
        setTimeout(() => navigate('/login'), 3000);
        
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
  }, [token, navigate]);

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


