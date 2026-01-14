import React, { useEffect, useState } from 'react';
import { CreditCard, Zap, BarChart3, CheckCircle, RefreshCw, Gift, Loader2, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import showToast from '../../utils/toastUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../../api/axios';

const SubscriptionCard = ({ profile, onRefresh }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successType, setSuccessType] = useState('upgrade'); // 'upgrade' or 'redeem'
  const [syncing, setSyncing] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const upgradeSuccess = searchParams.get('upgrade') === 'success';
    const redeemSuccess = searchParams.get('redeem') === 'success';

    if (upgradeSuccess || redeemSuccess) {
       setShowSuccessModal(true);
       setSuccessType(redeemSuccess ? 'redeem' : 'upgrade');
       
       // Fire confetti
       const duration = 3000;
       const end = Date.now() + duration;

       const frame = () => {
         confetti({
           particleCount: 2,
           angle: 60,
           spread: 55,
           origin: { x: 0 },
           colors: ['#3b82f6', '#8b5cf6', '#ec4899']
         });
         confetti({
           particleCount: 2,
           angle: 120,
           spread: 55,
           origin: { x: 1 },
           colors: ['#3b82f6', '#8b5cf6', '#ec4899']
         });
   
         if (Date.now() < end) {
           requestAnimationFrame(frame);
         }
       };
       frame();
       
       // Clean URL
       setSearchParams(params => {
           params.delete('upgrade');
           params.delete('redeem');
           return params;
       });
    }
  }, [searchParams, setSearchParams]);

  // Sync subscription with Lemon Squeezy
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/subscription/sync');
      showToast.success(data.message);
      if (onRefresh) onRefresh();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to sync subscription');
    } finally {
      setSyncing(false);
    }
  };

  // Check code first
  const handleCheckCode = async (e) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    
    setValidating(true);
    try {
      const { data } = await api.post('/subscription/redeem/validate', { code: redeemCode.trim() });
      setValidationData(data);
      setShowConfirmModal(true);
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Invalid code');
    } finally {
      setValidating(false);
    }
  };

  // Actual redeem call
  const handleConfirmRedeem = async () => {
    setRedeeming(true);
    try {
      const { data } = await api.post('/subscription/redeem', { code: redeemCode.trim() });
      showToast.success(data.message);
      setRedeemCode('');
      setShowConfirmModal(false);
      
      setRedeemCode('');
      setShowConfirmModal(false);
      
      // Trigger success modal based on action type
      setSuccessType(data.action === 'extend' ? 'extend' : 'upgrade');
      setShowSuccessModal(true);
      
      // Trigger confetti for successful redemption
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      if (onRefresh) onRefresh();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Redemption failed');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
        {/* Success Modal */}
        {showSuccessModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSuccessModal(false)}>
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={() => setShowSuccessModal(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                            <Zap size={32} className="text-white" fill="white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {successType === 'extend' ? 'Redemption Successful! 🎉' : 'Welcome to Pro! 🚀'}
                        </h2>
                        <p className="text-gray-300 mb-6">
                            {successType === 'extend' 
                                ? 'Your subscription has been successfully extended. Enjoy your continued access!' 
                                : 'Your account has been successfully upgraded. Enjoy unlimited possibilities with custom aliases, advanced analytics, and more.'
                            }
                        </p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
                        >
                            Awesome, let's go!
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Redemption Confirmation Modal */}
        {showConfirmModal && validationData && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmModal(false)}>
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full relative shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Decorative Shine (matched from RedeemPage) */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
                    >
                        <X size={20} />
                    </button>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                                <CheckCircle className="text-green-400" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Code Verified</h3>
                                <p className="text-gray-400 text-sm font-mono">{validationData.code}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
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

                            <div className="bg-gray-950/30 rounded-lg p-4 text-sm space-y-2 border border-white/5">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Duration</span>
                                    <span className="text-white font-medium capitalize">{validationData.duration.replace('_', ' ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">New Expiry</span>
                                    <span className="text-green-400 font-medium">{formatDate(validationData.future.expiresAt)}</span>
                                </div>
                            </div>

                            {validationData.warning && (
                                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <p>{validationData.warning}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all border border-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRedeem}
                                disabled={redeeming}
                                className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {redeeming ? <Loader2 size={18} className="animate-spin" /> : 'Confirm & Redeem'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Current Plan Card */}
        <div className="glass-dark rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Zap size={120} />
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 relative z-10">
                <CreditCard size={20} className="text-purple-400" />
                Current Plan
            </h3>
            
            <div className="flex flex-col md:flex-row gap-8 relative z-10">
                <div className="flex-1">
                    <div className="flex items-baseline gap-4 mb-2">
                        <span className="text-3xl font-bold text-white capitalize">
                            {profile?.subscription?.tier || 'Free'}
                        </span>
                            {profile?.subscription?.status === 'active' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded uppercase border border-green-500/30">
                                Active
                            </span>
                            )}
                            {profile?.subscription?.status === 'past_due' && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded uppercase border border-red-500/30">
                                Past Due
                            </span>
                            )}
                            {profile?.subscription?.status === 'paused' && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded uppercase border border-yellow-500/30">
                                Paused
                            </span>
                            )}
                    </div>
                    <p className="text-gray-400 text-sm mb-6">
                        {profile?.subscription?.tier === 'free' 
                            ? 'Upgrade to Pro for more links, custom aliases, and advanced analytics.' 
                            : profile?.subscription?.billingCycle === 'lifetime'
                                ? 'Lifetime Access - No recurring billing.'
                                : profile?.subscription?.billingCycle === 'one_time'
                                    ? `Expires on: ${profile?.subscription?.currentPeriodEnd ? formatDate(profile.subscription.currentPeriodEnd) : 'N/A'}`
                                    : `Next billing date: ${profile?.subscription?.currentPeriodEnd ? formatDate(profile.subscription.currentPeriodEnd) : 'N/A'}`
                        }
                    </p>
                    
                    <div className="flex flex-wrap gap-3">
                        {profile?.subscription?.tier === 'free' ? (
                            <button 
                                onClick={() => navigate('/pricing')}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all"
                            >
                                Upgrade Plan
                            </button>
                        ) : (
                             // Only show Manage button for recurring subscriptions (monthly/yearly)
                             // AND if we have a portal URL
                             ['monthly', 'yearly'].includes(profile?.subscription?.billingCycle) && (
                                <button 
                                        onClick={() => {
                                            if (profile?.subscription?.customerPortalUrl) {
                                                window.location.href = profile.subscription.customerPortalUrl;
                                            } else {
                                                showToast.error("Billing portal unavailable");
                                            }
                                        }}
                                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-600 transition-all"
                                >
                                    Manage Subscription
                                </button>
                             )
                        )}
                        
                        {/* Sync Button - Only show if we actually have an external subscription ID */}
                        {profile?.subscription?.subscriptionId && ['monthly', 'yearly'].includes(profile?.subscription?.billingCycle || 'monthly') && (
                          <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl border border-gray-600 transition-all flex items-center gap-2 disabled:opacity-50"
                            title="Sync subscription status with payment provider"
                          >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync'}
                          </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Link Usage */}
                <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-white flex items-center gap-2">
                        <Zap size={18} className="text-blue-400" />
                        Links Created
                    </h4>
                    <span className="text-xs text-gray-400">Resets {profile?.linkUsage?.resetAt ? formatDate(profile.linkUsage.resetAt) : 'monthly'}</span>
                </div>
                {(() => {
                    const tier = profile?.subscription?.tier || 'free';
                    const limit = tier === 'free' ? 25 : (tier === 'pro' ? 500 : 99999);
                    const count = profile?.linkUsage?.count || 0;
                    const percent = Math.min((count / limit) * 100, 100);
                    
                    return (
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white font-bold">{count}</span>
                                <span className="text-gray-400">/ {tier === 'business' ? 'Unlimited' : limit}</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })()}
                </div>
                
                {/* Click Usage */}
                <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-white flex items-center gap-2">
                        <BarChart3 size={18} className="text-green-400" />
                        Monthly Clicks
                    </h4>
                        <span className="text-xs text-gray-400">Resets {profile?.clickUsage?.resetAt ? formatDate(profile.clickUsage.resetAt) : 'monthly'}</span>
                </div>
                {(() => {
                    const tier = profile?.subscription?.tier || 'free';
                    const limit = tier === 'free' ? 1000 : (tier === 'pro' ? 50000 : 250000);
                    const count = profile?.clickUsage?.count || 0;
                    const percent = Math.min((count / limit) * 100, 100);
                    
                    return (
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white font-bold">{count}</span>
                                <span className="text-gray-400">/ {tier === 'business' ? 'Unlimited' : limit.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${percent > 90 ? 'bg-red-500' : 'bg-green-500'}`} 
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })()}
                </div>
        </div>
        
        {/* Redeem Code Section */}
          <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
          <h4 className="font-medium text-white flex items-center gap-2 mb-4">
            <Gift size={18} className="text-amber-400" />
            Have a promo code?
          </h4>
          <form onSubmit={handleCheckCode} className="flex gap-3">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g., PRO-1Y-ABC123)"
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors font-mono"
              maxLength={20}
            />
            <button
              type="submit"
              disabled={validating || !redeemCode.trim()}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              {validating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  checking...
                </>
              ) : (
                'Redeem'
              )}
            </button>
          </form>
        </div>
    </div>
  );
};

export default SubscriptionCard;
