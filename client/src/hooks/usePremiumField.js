import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasFeature } from '../utils/subscriptionUtils';

/**
 * usePremiumField - Hook to check premium field access and get status
 * Returns: { isLocked, upgradePath, upgradeText, showTooltip, setShowTooltip }
 */
export const usePremiumField = (feature) => {
  const { user } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Note: hasFeature already handles admin bypass check if needed, 
  // but we keep the explicit check here if it was intended to override subscriptionUtils
  // checks. However, based on recent changes, subscriptionUtils should handle it.
  // The original code had: const canAccess = user?.role === 'admin' || (user && hasFeature(user, feature));
  // But we removed admin bypass in subscriptionUtils to test free tier.
  // So we should rely on hasFeature logic which now STRICTLY checks tier.
  
  const canAccess = user && hasFeature(user, feature);
  const isLoggedOut = !user;
  const upgradePath = isLoggedOut ? '/register' : '/pricing';
  const upgradeText = isLoggedOut ? 'Sign up free to unlock' : 'Upgrade to Pro';
  
  return {
    isLocked: !canAccess,
    canAccess,
    isLoggedOut,
    upgradePath,
    upgradeText,
    showTooltip,
    setShowTooltip,
    user
  };
};

export default usePremiumField;
