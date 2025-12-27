import { useState, useRef } from 'react';
import { Crown, Sun, Flame, Sparkles, Star, Waves } from 'lucide-react';
import './IdBadge.css';

/**
 * Elite ID Badge Component
 * Displays user's Elite ID with tier-specific styling and tooltips
 */

const TIER_CONFIG = {
  admin: {
    icon: Crown,
    label: 'Admin',
    message: 'Core builder of this platform',
    className: 'tier-admin',
  },
  pioneer: {
    icon: Sun,
    label: 'Pioneer',
    message: 'You believed before anyone else',
    className: 'tier-pioneer',
  },
  torchbearer: {
    icon: Flame,
    label: 'Torchbearer',
    message: 'You carried the flame forward',
    className: 'tier-torchbearer',
  },
  dreamer: {
    icon: Sparkles,
    label: 'Dreamer',
    message: 'You saw the vision early',
    className: 'tier-dreamer',
  },
  believer: {
    icon: Star,
    label: 'Believer',
    message: 'You joined when we were a whisper',
    className: 'tier-believer',
  },
  wave: {
    icon: Waves,
    label: 'Wave',
    message: "You're part of the movement now",
    className: 'tier-wave',
  },
};

const IdBadge = ({ eliteId, idTier, size = 'md', showTooltip = true }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const badgeRef = useRef(null);

  if (!eliteId || !idTier) return null;

  const config = TIER_CONFIG[idTier] || TIER_CONFIG.wave;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'id-badge-sm',
    md: 'id-badge-md',
    lg: 'id-badge-lg',
  };

  // Calculate tooltip position dynamically
  const handleMouseEnter = () => {
    if (!showTooltip || !badgeRef.current) {
      setIsHovered(true);
      return;
    }

    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipWidth = 240;
    const tooltipHeight = 100;
    const padding = 12;

    // Default: show above and centered
    let top = rect.top - tooltipHeight - padding;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

    // If tooltip would go off top of screen, show below
    if (top < padding) {
      top = rect.bottom + padding;
    }

    // If tooltip would go off left edge
    if (left < padding) {
      left = padding;
    }

    // If tooltip would go off right edge
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    setTooltipStyle({ top: `${top}px`, left: `${left}px` });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div 
      className="id-badge-container"
      ref={badgeRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
    >
      <div className={`id-badge ${config.className} ${sizeClasses[size]}`}>
        <Icon className="id-badge-icon" />
        <span className="id-badge-text">{eliteId}</span>
      </div>

      {showTooltip && isHovered && (
        <div className="id-badge-tooltip" style={tooltipStyle}>
          <div className="tooltip-tier">{config.label}</div>
          <div className="tooltip-message">"{config.message}"</div>
          <div className="tooltip-note">This ID can never be earned again.</div>
        </div>
      )}
    </div>
  );
};

export default IdBadge;
