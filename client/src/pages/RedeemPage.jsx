import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Loader2, Gift, AlertTriangle, CheckCircle, ArrowRight, X, CreditCard, Calendar } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import showToast from '../utils/toastUtils';
import confetti from 'canvas-confetti';

const RedeemPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [shouldAutoCheck, setShouldAutoCheck] = useState(!!searchParams.get('code'));
  const [validationData, setValidationData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, validating, valid, invalid, redeeming, success
  const [error, setError] = useState(null);

  // Auto-validate on load if user is logged in and code exists
  const validateCode = useCallback(async (codeToValidate) => {
    setStatus('validating');
    setError(null);
    try {
      const { data } = await api.post('/subscription/redeem/validate', { code: codeToValidate });
      setValidationData(data);
      setStatus('valid');
    } catch (err) {
      console.error(err);
      setStatus('invalid');
      setError(err.response?.data?.message || 'Invalid or expired code');
      setValidationData(null);
    }
  }, []);

  useEffect(() => {
    if (user && shouldAutoCheck && status === 'idle') {
      const urlCode = searchParams.get('code');
      if (urlCode) {
        validateCode(urlCode);
      }
      setShouldAutoCheck(false);
    }
  }, [user, shouldAutoCheck, searchParams, status, validateCode]);

    const handleRedeem = async () => {
    setStatus('redeeming');
    try {
      const { data } = await api.post('/subscription/redeem', { code });
      // Update validationData with success action to use in UI
      setValidationData({ ...validationData, action: data.action });
      setStatus('success');
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#ec4899']
      });

      // Delay redirect to let user see success
      setTimeout(() => {
        navigate('/dashboard/settings?tab=subscription&redeem=success');
      }, 2000);

    } catch (err) {
      setStatus('valid'); // Go back to valid state to retry or see error
      showToast.error(err.response?.data?.message || 'Redemption failed');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) validateCode(code.trim());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Mesh */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
            {/* Header / Logo */}
            <div className="text-center mb-8">
                 <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                        <Gift className="text-white" size={24} />
                    </div>
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        LinkSnap Redeem
                    </span>
                </Link>
                <h1 className="text-3xl font-bold text-white mb-2">Claim Your Subscription</h1>
                <p className="text-gray-400">Enter your promo code to upgrade your account</p>
            </div>

            {/* Main Card */}
            <div className="glass-dark rounded-2xl border border-gray-800 p-1 shadow-2xl backdrop-blur-xl bg-gray-900/60">
                <div className="p-6 sm:p-8 space-y-6">
                    
                    {/* Step 1: Authentication Check */}
                    {!user ? (
                        <div className="text-center space-y-6">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-blue-200 text-sm">
                                You need to be logged in to redeem a code.
                            </div>
                            
                            {code && (
                                <div className="bg-gray-800/50 rounded-lg p-3 inline-block border border-gray-700">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">Code:</span>
                                    <span className="ml-2 font-mono text-white">{code}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <Link 
                                    to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    Log In
                                </Link>
                                <Link 
                                    to={`/register?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all border border-gray-700 flex items-center justify-center gap-2"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        </div>
                    ) : (
                        // Logged In Flow
                        <div className="space-y-6">
                            
                            {/* Input Field */}
                            {status !== 'success' && status !== 'valid' && (
                                <form onSubmit={handleManualSubmit} className="relative">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => {
                                            setCode(e.target.value.toUpperCase());
                                            setError(null);
                                            setStatus('idle');
                                        }}
                                        placeholder="ENTER-CODE-HERE"
                                        className={`w-full bg-gray-950/50 border-2 rounded-xl px-4 py-4 text-center text-lg font-mono tracking-widest text-white uppercase placeholder-gray-600 focus:outline-none transition-colors ${
                                            error ? 'border-red-500/50 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'
                                        }`}
                                        disabled={status === 'validating'}
                                    />
                                    {status === 'validating' && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Loader2 className="animate-spin text-blue-500" />
                                        </div>
                                    )}
                                    {error && (
                                        <p className="text-red-400 text-sm mt-2 text-center flex items-center justify-center gap-2">
                                            <AlertTriangle size={14} />
                                            {error}
                                        </p>
                                    )}
                                    <button 
                                        type="submit"
                                        className="w-full mt-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all"
                                        disabled={!code.trim() || status === 'validating'}
                                    >
                                        Check Code
                                    </button>
                                </form>
                            )}

                            {/* Validation Result Card */}
                            {status === 'valid' && validationData && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    
                                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 p-6 relative overflow-hidden">
                                        {/* Decorative Shine */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                        
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                                                <CheckCircle className="text-green-400" size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Code Verified</h3>
                                                <p className="text-gray-400 text-sm font-mono">{validationData.code}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Comparison */}
                                            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-sm">
                                                <div className="text-center p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                                                    <p className="text-gray-500 text-xs uppercase mb-1">Current</p>
                                                    <p className="font-semibold text-white capitalize">{validationData.current.tier}</p>
                                                </div>
                                                <ArrowRight className="text-gray-600" size={16} />
                                                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                                    <p className="text-blue-300 text-xs uppercase mb-1">New Plan</p>
                                                    <p className="font-bold text-white capitalize">{validationData.future.tier}</p>
                                                </div>
                                            </div>

                                            {/* Expiry Details */}
                                            <div className="bg-gray-950/30 rounded-lg p-4 text-sm space-y-2 border border-white/5">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Duration</span>
                                                    <span className="text-white font-medium capitalize">{validationData.duration.replace('_', ' ')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">New Expiry</span>
                                                    <span className="text-green-400 font-medium">
                                                        {formatDate(validationData.future.expiresAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Warning */}
                                            {validationData.warning && (
                                                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs">
                                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                                    <p>{validationData.warning}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setStatus('idle');
                                                setValidationData(null);
                                                setCode('');
                                            }}
                                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all border border-gray-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleRedeem}
                                            className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            Confirm & Redeem
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Success State */}
                            {status === 'success' && (
                                <div className="text-center py-8">
                                    <div className="inline-flex mb-4 p-4 bg-green-500/10 rounded-full text-green-400">
                                        <CheckCircle size={48} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">
                                        {validationData?.action === 'upgrade' 
                                            ? 'Welcome to Pro! 🚀' 
                                            : 'Redemption Successful! 🎉'
                                        }
                                    </h2>
                                    <p className="text-gray-400">
                                         {validationData?.action === 'upgrade' 
                                            ? 'Upgrade complete. Redirecting to dashboard...' 
                                            : 'Subscription extended. Redirecting to dashboard...'
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Footer */}
            <div className="text-center mt-8 text-gray-500 text-sm">
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
                <span className="mx-2">•</span>
                <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                <span className="mx-2">•</span>
                <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
        </div>
    </div>
  );
};

export default RedeemPage;
