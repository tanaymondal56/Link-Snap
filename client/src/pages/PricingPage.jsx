import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import { Check, X, Shield, Zap, Globe, Lock, Hammer, Star } from 'lucide-react';
import ComingSoonFeature from '../components/subscription/ComingSoonFeature';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import showToast from '../components/ui/Toast';

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [billingInterval, setBillingInterval] = useState('monthly'); // 'monthly' | 'yearly'

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data } = await api.get('/subscription/pricing');
        setPricing(data);
      } catch (err) {
        console.error('Failed to load pricing', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPricing();
  }, []);

  const handleCheckout = async (tier, interval) => {
    if (!user) {
        // Trigger generic login/signup flow
        // Ideally pass state to redirect back here
        navigate('/login', { state: { from: '/pricing' } });
        return;
    }
    
    setLoading(true);
    try {
        const selectedTier = pricing.tiers[tier];
        const plan = interval === 'monthly' ? selectedTier.monthly : selectedTier.yearly;
        
        const { data } = await api.post('/subscription/checkout', {
            variantId: plan.variantId,
            redirectUrl: `${window.location.origin}/dashboard/settings?upgrade=success` 
        });
        
    if (data.url) {
            window.location.href = data.url;
            // Don't setLoading(false) - keep loading screen while redirecting
        } else {
            showToast.error('Failed to initiate checkout. Please try again.');
            setLoading(false);
        }
    } catch {
        showToast.error("Couldn't start checkout. Please check your connection.");
        setLoading(false);
    }
  };

  const handleManage = () => {
    navigate('/dashboard/settings');
  };

  const isCurrentPlan = (tier) => {
      if (!user) return tier === 'free';
      return user.subscription?.tier === tier && user.subscription?.status === 'active';
  };

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">Loading...</div>;
  }

  const proPrice = billingInterval === 'monthly' 
      ? pricing?.tiers?.pro?.monthly 
      : pricing?.tiers?.pro?.yearly;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white py-20 px-4 sm:px-6 lg:px-8">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Pricing | Link Snap - Free & Pro Plans</title>
        <meta name="description" content="Choose from our Free or Pro plans. Get unlimited links, custom aliases, analytics, and more. Plans starting at $0/month." />
        <meta property="og:title" content="Link Snap Pricing" />
        <meta property="og:description" content="Simple pricing, powerful features. Free forever with optional Pro upgrade." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Link Snap Pricing" />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
            Simple Pricing, Powerful Features
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
             Unlock the full potential of your links with our Pro plan. Localized pricing applied at checkout.
          </p>
          
          {/* Toggle */}
          <div className="mt-8 flex justify-center">
             <div className="relative bg-gray-800 p-1 rounded-xl flex items-center">
                <button 
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${billingInterval === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setBillingInterval('yearly')}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${billingInterval === 'yearly' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Yearly <span className="ml-1 text-xs text-green-300 font-normal">-17%</span>
                </button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* FREE TIER */}
          <div className="relative p-8 bg-gray-900/50 border border-white/10 rounded-2xl flex flex-col">
            <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Free</h3>
                <p className="text-gray-400 text-sm">For individuals getting started</p>
            </div>
            <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-gray-500">/forever</span>
            </div>
            <button 
                onClick={user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active' ? handleManage : undefined}
                disabled={isCurrentPlan('free') && !(user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active')}
                className={`w-full py-3 rounded-xl font-semibold mb-8 transition-colors ${
                    isCurrentPlan('free') 
                    ? 'bg-gray-800 text-gray-400 cursor-default' 
                    : (user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active'
                        ? 'bg-gray-800 hover:bg-gray-700 text-white shadow-lg'
                        : 'bg-white/10 hover:bg-white/20 text-white')
                }`}
            >
                {isCurrentPlan('free') ? 'Current Plan' : (user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active' ? 'Manage Subscription' : 'Get Started')}
            </button>
            <ul className="space-y-3 flex-1">
                <li className="text-xs text-gray-500 uppercase tracking-wider mb-2">Included:</li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={18} className="text-green-400 flex-shrink-0" /> 25 Links / month
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={18} className="text-green-400 flex-shrink-0" /> 1,000 Clicks / month
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={18} className="text-green-400 flex-shrink-0" /> 30-day Analytics History
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={18} className="text-green-400 flex-shrink-0" /> Basic QR Codes
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={18} className="text-green-400 flex-shrink-0" /> Random Short IDs
                </li>
                
                <li className="text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4">Not Included:</li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                    <X size={18} className="text-gray-600 flex-shrink-0" /> Custom Aliases
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                    <X size={18} className="text-gray-600 flex-shrink-0" /> Link Expiration
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                    <X size={18} className="text-gray-600 flex-shrink-0" /> Password Protection
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                    <X size={18} className="text-gray-600 flex-shrink-0" /> Geo-Analytics
                </li>
            </ul>
          </div>

          {/* PRO TIER (Highlight) */}
          <div className="relative p-8 bg-gradient-to-b from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl flex flex-col scale-105 shadow-2xl shadow-blue-900/20 z-10">
            <div className="absolute top-0 right-0 -mt-3 -mr-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                MOST POPULAR
            </div>
            <div className="mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Star className="text-yellow-400 fill-yellow-400 h-5 w-5" /> Pro
                </h3>
                <p className="text-gray-400 text-sm">For power users and creators</p>
            </div>
            <div className="mb-6">
                <span className="text-4xl font-bold">{proPrice?.display || '$9.00'}</span>
                <span className="text-gray-500">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
            <button 
                onClick={() => {
                    const isPro = user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active';
                    const isPlanMatches = isPro && user?.subscription?.billingCycle === billingInterval;
                    if (isPro && !isPlanMatches) {
                        handleManage();
                    } else {
                        handleCheckout('pro', billingInterval);
                    }
                }}
                disabled={isCurrentPlan('pro') && user?.subscription?.billingCycle === billingInterval}
                className={`w-full py-3 rounded-xl font-bold mb-8 transition-all ${
                    isCurrentPlan('pro') && user?.subscription?.billingCycle === billingInterval
                    ? 'bg-green-600/20 text-green-400 border border-green-500/50 cursor-default'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-blue-500/25'
                }`}
            >
                {isCurrentPlan('pro') && user?.subscription?.billingCycle === billingInterval 
                    ? 'Active Plan' 
                    : (user?.subscription?.tier === 'pro' && user?.subscription?.status === 'active' ? 'Manage Subscription' : 'Upgrade Now')}
            </button>
            <ul className="space-y-3 flex-1">
                <li className="text-xs text-amber-400 uppercase tracking-wider mb-2">Everything in Free, plus:</li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-blue-500/20 rounded-full"><Zap size={14} className="text-blue-400" /></div>
                    <strong>500 Links</strong> / month (20x more)
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-blue-500/20 rounded-full"><Zap size={14} className="text-blue-400" /></div>
                    <strong>50,000 Clicks</strong> / month (50x more)
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-purple-500/20 rounded-full"><Globe size={14} className="text-purple-400" /></div>
                    <strong>Custom Aliases</strong> (my-brand)
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-amber-500/20 rounded-full"><Lock size={14} className="text-amber-400" /></div>
                    <strong>Link Expiration</strong> (auto-disable)
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-green-500/20 rounded-full"><Shield size={14} className="text-green-400" /></div>
                    <strong>Password Protection</strong>
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-cyan-500/20 rounded-full"><Globe size={14} className="text-cyan-400" /></div>
                    <strong>Geo-Analytics</strong> (country, city)
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="p-1 bg-blue-500/20 rounded-full"><Zap size={14} className="text-blue-400" /></div>
                    <strong>1-Year</strong> Analytics History
                </li>
            </ul>
            
            {/* Upcoming Features */}
            <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Coming Soon:</p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-gray-400">
                        <Hammer size={12} className="text-amber-400" /> Time-Based Redirects
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-400">
                        <Hammer size={12} className="text-amber-400" /> Click Limits
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-400">
                        <Hammer size={12} className="text-amber-400" /> Link Rotation
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-400">
                        <Hammer size={12} className="text-amber-400" /> Custom QR Code Styles
                    </li>
                </ul>
                <a 
                    href="/roadmap" 
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 transition-colors"
                >
                    View full roadmap →
                </a>
            </div>
             <p className="text-xs text-gray-500 mt-4 text-center">
                * Local pricing calculated at checkout.
            </p>
          </div>

          {/* BUSINESS TIER (Coming Soon) */}
          <div className="relative p-8 bg-gray-900/50 border border-white/10 rounded-2xl flex flex-col opacity-80 hover:opacity-100 transition-opacity">
            <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Business</h3>
                <p className="text-gray-400 text-sm">For teams and high volume</p>
            </div>
            <div className="mb-6 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-500">Coming Soon</span>
            </div>
            <ComingSoonFeature 
                title="Business Suite" 
                description="Team management, SSO, Custom Domains, and API Webhooks." 
            />
             <ul className="space-y-4 flex-1 mt-8 grayscale opacity-70">
                <li className="flex items-center gap-3 text-sm text-gray-300">
                     <Check size={18} className="text-gray-500 flex-shrink-0" /> Unlimited Links
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-300">
                     <Check size={18} className="text-gray-500 flex-shrink-0" /> Custom Domains
                </li>
                 <li className="flex items-center gap-3 text-sm text-gray-300">
                     <Check size={18} className="text-gray-500 flex-shrink-0" /> Team Collaboration
                </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
