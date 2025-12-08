import { useState, useRef } from 'react';
import { Trash2, Copy, Edit3, Check } from 'lucide-react';

/**
 * SwipeableCard Component
 * A card wrapper that reveals action buttons when swiped left on mobile
 * 
 * Props:
 * - children: ReactNode - Card content
 * - onDelete: function - Called when delete action triggered
 * - onCopy: function - Called when copy action triggered  
 * - onEdit: function - Called when edit action triggered
 * - disabled: boolean - Disable swipe actions
 */
const SwipeableCard = ({ 
  children, 
  onDelete, 
  onCopy, 
  onEdit,
  disabled = false 
}) => {
  const cardRef = useRef(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [copied, setCopied] = useState(false);

  const ACTION_WIDTH = 180; // Total width of action buttons
  const THRESHOLD = 60; // Minimum swipe to trigger

  const handleTouchStart = (e) => {
    if (disabled) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || disabled) return;
    const deltaX = e.touches[0].clientX - startX;
    // Only allow left swipe (negative values), with resistance
    const newTranslate = Math.min(0, Math.max(-ACTION_WIDTH, deltaX + translateX));
    setTranslateX(newTranslate);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isDragging || disabled) return;
    setIsDragging(false);

    // Snap to open or closed based on threshold
    if (translateX < -THRESHOLD) {
      setTranslateX(-ACTION_WIDTH);
    } else {
      setTranslateX(0);
    }
  };

  const handleAction = (action, callback) => {
    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    // Reset card position
    setTranslateX(0);
    
    // Execute callback
    if (callback) callback();
  };

  const handleCopy = () => {
    handleAction('copy', () => {
      if (onCopy) onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Close on outside click
  const handleCardClick = () => {
    if (translateX < 0) {
      setTranslateX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl md:overflow-visible">
      {/* Action Buttons (revealed on swipe) */}
      <div 
        className="absolute inset-y-0 right-0 flex items-stretch md:hidden"
        style={{ width: ACTION_WIDTH }}
      >
        {/* Edit Button */}
        {onEdit && (
          <button
            onClick={() => handleAction('edit', onEdit)}
            className="flex-1 flex items-center justify-center bg-purple-600 hover:bg-purple-500 transition-colors"
            aria-label="Edit"
          >
            <Edit3 className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Copy Button */}
        {onCopy && (
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-500 transition-colors"
            aria-label="Copy"
          >
            {copied ? (
              <Check className="w-5 h-5 text-white" />
            ) : (
              <Copy className="w-5 h-5 text-white" />
            )}
          </button>
        )}

        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={() => handleAction('delete', onDelete)}
            className="flex-1 flex items-center justify-center bg-red-600 hover:bg-red-500 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`relative bg-gray-900 touch-pan-y ${
          isDragging ? '' : 'transition-transform duration-200'
        }`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {children}
      </div>

      {/* Swipe hint on first render - subtle gradient */}
      {translateX === 0 && (
        <div 
          className="absolute inset-y-0 right-0 w-8 pointer-events-none md:hidden"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.02))'
          }}
        />
      )}
    </div>
  );
};

export default SwipeableCard;
