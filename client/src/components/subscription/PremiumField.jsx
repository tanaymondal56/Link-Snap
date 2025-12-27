import { Link } from 'react-router-dom';
import { Sparkles, Crown } from 'lucide-react';
import { usePremiumField } from '../../hooks/usePremiumField';

/**
 * PremiumField - Wraps form fields for premium features
 * 
 * Shows:
 * - PRO badge in label
 * - Disabled input styling
 * - Hover tooltip with upgrade link
 * 
 * Props:
 * - feature: The feature key to check (e.g., 'custom_alias')
 * - label: Label text for the field
 * - children: The form input(s) to wrap
 * - className: Additional CSS classes
 * - labelIcon: Optional icon to show before label
 */
const PremiumField = ({ 
  feature, 
  label, 
  children, 
  className = '',
  labelIcon: LabelIcon = null,
  labelIconClass = 'text-purple-400'
}) => {
  const { 
    isLocked, 
    upgradePath, 
    upgradeText, 
    showTooltip, 
    setShowTooltip 
  } = usePremiumField(feature);

  // If user has access (not locked), render normally with label
  if (!isLocked) {
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-sm font-medium text-gray-400 ml-1 flex items-center gap-2">
          {LabelIcon && <LabelIcon size={14} className={labelIconClass} />}
          {label}
          <span className="text-xs text-gray-500 font-normal">(optional)</span>
          <Sparkles size={14} className="text-purple-400" />
        </label>
        {children}
      </div>
    );
  }



  // Locked field with hover tooltip
  return (
    <div 
      className={`space-y-2 relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Label with PRO badge */}
      <label className="text-sm font-medium text-gray-400 ml-1 flex items-center gap-2">
        {LabelIcon && <LabelIcon size={14} className={labelIconClass} />}
        {label}
        <span className="text-xs text-gray-500 font-normal">(optional)</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full">
          <Crown size={10} />
          PRO
        </span>
      </label>
      
      {/* Disabled content wrapper */}
      <div className="relative">
        {/* Children with disabled styling */}
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        
        {/* Hover tooltip */}
        {showTooltip && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Link
              to={upgradePath}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all transform hover:scale-105"
            >
              <Crown size={16} />
              {upgradeText}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ProBadge - Inline badge for premium features
 * Use this for simple labeling in existing labels
 */
export const ProBadge = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full ${className}`}>
    <Crown size={10} />
    PRO
  </span>
);



export default PremiumField;
