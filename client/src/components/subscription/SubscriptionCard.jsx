import React, { useEffect, useState } from 'react';
import { CreditCard, Zap, BarChart3, CheckCircle, RefreshCw, Gift, Loader2, AlertTriangle, ArrowRight, X, HelpCircle } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import showToast from '../../utils/toastUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../../api/axios';
import BadgeTooltip from '../ui/BadgeTooltip';

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

        {/* Membership Card (Current Plan) */}
        <div 
            className="rounded-3xl p-4 sm:p-6 lg:p-8 relative overflow-hidden shadow-2xl transition-all duration-700 hover:scale-[1.01] mt-2 group"
            style={{ 
                background: `linear-gradient(135deg, var(--glass-bg) 0%, rgba(0,0,0,0.8) 100%)`, 
                border: '1px solid var(--glass-border)',
                boxShadow: '0 20px 40px -10px var(--cta-shadow)'
            }}
        >
            {/* Glowing Orbs inside the card */}
            <div 
                className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none transition-transform duration-1000 group-hover:scale-110" 
                style={{ background: 'var(--accent-from)' }} 
            />
            <div 
                className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-transform duration-1000 group-hover:scale-110" 
                style={{ background: 'var(--accent-to)' }} 
            />
            
            {/* Card Watermark */}
            <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 pointer-events-none transform rotate-12 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[15deg] hidden sm:block">
                <Zap size={220} style={{ color: 'var(--accent-to)' }} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-8 border-b border-white/5 pb-4 sm:pb-6 gap-4 sm:gap-6">
                 <div>
                     <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-2 opacity-80" style={{ color: 'var(--subtext-color)' }}>
                         Membership Status
                     </h3>
                     <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                         <span 
                            className="text-3xl sm:text-5xl md:text-6xl font-black capitalize tracking-tight"
                            style={{ 
                                color: 'var(--heading-color)',
                                textShadow: '0 0 40px var(--cta-shadow)'
                            }}
                         >
                             {profile?.subscription?.tier || 'Free'}
                         </span>
                         {profile?.subscription?.status === 'active' && (
                         <span className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg uppercase tracking-wider border border-green-500/30 backdrop-blur-md">
                             Active
                         </span>
                         )}
                         {profile?.subscription?.status === 'past_due' && (
                         <span className="px-3 py-1.5 bg-red-500/20 text-red-500 text-xs font-bold rounded-lg uppercase tracking-wider border border-red-500/30 backdrop-blur-md">
                             Past Due
                         </span>
                         )}
                         {profile?.subscription?.status === 'paused' && (
                         <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-lg uppercase tracking-wider border border-yellow-500/30 backdrop-blur-md">
                             Paused
                         </span>
                         )}
                     </div>
                 </div>
                 <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-md border shadow-2xl" style={{ backgroundColor: 'var(--stat-icon-bg)', borderColor: 'var(--glass-border)' }}>
                     <CreditCard size={24} className="sm:hidden" style={{ color: 'var(--stat-icon-color)' }} />
                     <CreditCard size={32} className="hidden sm:block" style={{ color: 'var(--stat-icon-color)' }} />
                 </div>
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-4 sm:gap-8 justify-between items-end">
                <div className="flex-1 w-full">
                    <p className="font-medium text-lg sm:text-xl mb-2" style={{ color: 'var(--heading-color)' }}>
                        {profile?.subscription?.tier === 'free' 
                            ? 'Free Tier Benefits' 
                            : 'Premium Membership Active'
                        }
                    </p>
                    <p className="text-sm md:text-base opacity-80 mb-4 sm:mb-8 max-w-xl leading-relaxed" style={{ color: 'var(--subtext-color)' }}>
                        {profile?.subscription?.tier === 'free' 
                            ? 'Upgrade to Pro for more links, custom aliases, and advanced analytics.' 
                            : profile?.subscription?.billingCycle === 'lifetime'
                                ? 'Lifetime Access - No recurring billing.'
                                : profile?.subscription?.billingCycle === 'one_time'
                                    ? `Expires on: ${profile?.subscription?.currentPeriodEnd ? formatDate(profile.subscription.currentPeriodEnd) : 'N/A'}`
                                    : `Next billing date: ${profile?.subscription?.currentPeriodEnd ? formatDate(profile.subscription.currentPeriodEnd) : 'N/A'}`
                        }
                    </p>
                    
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                        {profile?.subscription?.tier === 'free' ? (
                            <button 
                                onClick={() => navigate('/pricing')}
                                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                style={{
                                    background: 'linear-gradient(to right, var(--accent-from), var(--accent-to))',
                                    boxShadow: '0 8px 25px var(--cta-shadow)'
                                }}
                            >
                                <Zap size={18} fill="currentColor" />
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
                                    className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 backdrop-blur-md font-bold rounded-xl transition-all hover:bg-white/10 active:scale-95 shadow-xl hover:shadow-2xl"
                                    style={{
                                        backgroundColor: 'var(--stat-icon-bg)',
                                        color: 'var(--heading-color)',
                                        border: '1px solid var(--glass-border)'
                                    }}
                                >
                                    Manage Subscription
                                </button>
                             )
                        )}
                        
                        {/* Sync Button */}
                        {profile?.subscription?.subscriptionId && ['monthly', 'yearly'].includes(profile?.subscription?.billingCycle || 'monthly') && (
                          <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 backdrop-blur-md font-medium rounded-xl transition-all hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'var(--subtext-color)',
                                border: '1px solid var(--glass-border)'
                            }}
                            title="Force sync subscription status"
                          >
                            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Force Sync'}
                          </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Usage Stats - Matches Overview Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
            {/* Links Created */}
            <div className="rounded-2xl p-4 sm:p-6 transition-colors duration-300 relative overflow-hidden group" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex justify-between items-center mb-4 sm:mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                            <Zap size={20} style={{ color: 'var(--stat-icon-color)' }} />
                        </div>
                        <h4 className="font-semibold text-lg" style={{ color: 'var(--heading-color)' }}>
                            Links Created
                        </h4>
                    </div>
                    <BadgeTooltip content="Links currently active in your account. Delete links to free up space.">
                        <div className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-help">
                            <HelpCircle size={18} style={{ color: 'var(--subtext-color)' }} />
                        </div>
                    </BadgeTooltip>
                </div>
                {(() => {
                    const tier = profile?.subscription?.tier || 'free';
                    const limit = tier === 'free' ? 25 : (tier === 'pro' ? 500 : 10000);
                    const count = profile?.linkUsage?.count || 0;
                    const percent = tier === 'business' ? 5 : Math.min((count / limit) * 100, 100);
                    
                    return (
                        <div className="relative z-10">
                            <div className="flex justify-between text-base mb-3 items-end">
                                <span className="font-bold text-2xl sm:text-3xl tracking-tight" style={{ color: 'var(--heading-color)' }}>{count}</span>
                                <span className="font-medium mb-1" style={{ color: 'var(--subtext-color)' }}>/ {tier === 'business' ? '∞' : limit.toLocaleString()} max</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--divider-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}>
                                <div 
                                    className="h-full rounded-full transition-all duration-1000 ease-out relative"
                                    style={{ 
                                        width: `${percent}%`,
                                        background: percent >= 80 ? 'linear-gradient(to right, #f59e0b, #ef4444)' : 'linear-gradient(to right, var(--progress-from), var(--progress-to))'
                                    }}
                                >
                                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-100%]" />
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
                
            {/* Monthly Created */}
            <div className="rounded-2xl p-4 sm:p-6 transition-colors duration-300 relative overflow-hidden group" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex justify-between items-center mb-4 sm:mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                            <BarChart3 size={20} style={{ color: 'var(--stat-icon-color)' }} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-lg leading-tight" style={{ color: 'var(--heading-color)' }}>
                                Monthly Usage
                            </h4>
                            <span className="text-xs mt-0.5 block" style={{ color: 'var(--subtext-color)' }}>
                                Resets {(() => {
                                    const now = new Date();
                                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                                    return nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                })()}
                            </span>
                        </div>
                    </div>
                    <BadgeTooltip content="Total links created this month. Resets on the 1st of each month.">
                        <div className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-help">
                            <HelpCircle size={18} style={{ color: 'var(--subtext-color)' }} />
                        </div>
                    </BadgeTooltip>
                </div>
                {(() => {
                    const tier = profile?.subscription?.tier || 'free';
                    const limit = tier === 'free' ? 100 : (tier === 'pro' ? 2000 : 10000);
                    const count = profile?.linkUsage?.hardCount || 0;
                    const percent = Math.min((count / limit) * 100, 100);
                    
                    return (
                        <div className="relative z-10">
                            <div className="flex justify-between text-base mb-3 items-end">
                                <span className="font-bold text-2xl sm:text-3xl tracking-tight" style={{ color: 'var(--heading-color)' }}>{count.toLocaleString()}</span>
                                <span className="font-medium mb-1" style={{ color: 'var(--subtext-color)' }}>/ {limit.toLocaleString()} limit</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--divider-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}>
                                <div 
                                    className="h-full rounded-full transition-all duration-1000 ease-out relative"
                                    style={{ 
                                        width: `${percent}%`,
                                        background: percent >= 80 ? 'linear-gradient(to right, #f59e0b, #ef4444)' : 'linear-gradient(to right, var(--progress-from), var(--progress-to))'
                                    }}
                                >
                                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-100%]" />
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
        
        {/* Redeem Code Section */}
        <div className="rounded-2xl p-4 sm:p-6 mt-4 sm:mt-6 transition-colors duration-300 relative overflow-hidden group" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <h4 className="font-semibold text-lg flex items-center gap-3 mb-4 sm:mb-5" style={{ color: 'var(--heading-color)' }}>
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                 <Gift size={20} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            Have a promo code?
          </h4>
          <form onSubmit={handleCheckCode} className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative z-10 w-full max-w-2xl">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g., PRO-1Y-ABC123)"
              className="flex-1 rounded-xl px-4 sm:px-5 py-3 sm:py-4 font-mono text-sm sm:text-base transition-all focus:outline-none"
              style={{
                  backgroundColor: 'var(--topbar-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--heading-color)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--input-focus)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
              maxLength={20}
            />
            <button
              type="submit"
              disabled={validating || !redeemCode.trim()}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              style={{
                  background: 'linear-gradient(to right, var(--accent-from), var(--accent-to))',
                  color: 'white',
                  boxShadow: '0 8px 20px var(--cta-shadow)'
              }}
            >
              {validating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  checking...
                </>
              ) : (
                'Redeem Code'
              )}
            </button>
          </form>
        </div>
    </div>
  );
};

export default SubscriptionCard;
