import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Bug, Lightbulb, HelpCircle, Send, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import showToast from '../utils/toastUtils';
import { useScrollLock } from '../hooks/useScrollLock';

const feedbackTypes = [
  { id: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { id: 'bug_report', label: 'Bug Report', icon: Bug, color: 'text-red-400', bg: 'bg-red-500/20' },
  { id: 'improvement', label: 'Improvement', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { id: 'question', label: 'Question', icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
];

const FeedbackModal = ({ isOpen, onClose, defaultType = 'feature_request' }) => {
  const { user } = useAuth();
  
  // Scroll Lock
  useScrollLock(isOpen);

  const [formData, setFormData] = useState({
    type: defaultType,
    title: '',
    message: '',
    email: '',
    notifyOnUpdate: true,
    website: '', // Honeypot field - should remain empty
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when field changes
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTypeSelect = (typeId) => {
    setFormData(prev => ({ ...prev, type: typeId }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }
    if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }
    if (!formData.message.trim() || formData.message.trim().length < 20) {
      newErrors.message = 'Please provide more details (min 20 characters)';
    }
    if (!user && !formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      await api.post('/feedback', {
        type: formData.type,
        title: formData.title.trim(),
        message: formData.message.trim(),
        email: user ? undefined : formData.email.trim(),
        notifyOnUpdate: formData.notifyOnUpdate,
        website: formData.website, // Honeypot field
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset form after close
        setTimeout(() => {
          setSuccess(false);
          setFormData({
            type: defaultType,
            title: '',
            message: '',
            email: '',
            notifyOnUpdate: true,
            website: '',
          });
        }, 300);
      }, 2000);
    } catch (error) {
      console.error('Feedback submission error:', error);
      showToast.error(error.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[1000] overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div 
        className="flex min-h-full items-start justify-center p-4 sm:items-center sm:pt-4"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        <div data-modal-content className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl animate-slide-up overflow-hidden flex flex-col my-8">
        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="p-4 bg-green-500/20 rounded-full mb-4 animate-bounce-in">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
            <p className="text-gray-400 text-center">
              Your feedback has been submitted successfully. We appreciate your input!
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Share Your Feedback</h2>
                  <p className="text-sm text-gray-400">Help us improve Link Snap</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  What type of feedback?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {feedbackTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleTypeSelect(type.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        formData.type === type.id
                          ? `${type.bg} border-current ${type.color}`
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <type.icon size={18} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Brief summary of your feedback"
                  maxLength={100}
                  className={`w-full px-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                    errors.title ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-purple-500 focus:border-transparent'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {errors.title && <p className="text-red-400 text-xs">{errors.title}</p>}
                  <p className={`text-xs ml-auto ${formData.title.length > 90 ? 'text-amber-400' : 'text-gray-500'}`}>
                    {formData.title.length}/100
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  Details <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Describe your idea, bug, or suggestion in detail..."
                  rows={4}
                  maxLength={2000}
                  className={`w-full px-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 resize-none transition-all ${
                    errors.message ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-purple-500 focus:border-transparent'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {errors.message && <p className="text-red-400 text-xs">{errors.message}</p>}
                  <p className={`text-xs ml-auto ${formData.message.length > 1800 ? 'text-amber-400' : 'text-gray-500'}`}>
                    {formData.message.length}/2000
                  </p>
                </div>
              </div>

              {/* Email (only for guests) */}
              {!user && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className={`w-full px-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-purple-500 focus:border-transparent'
                    }`}
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
              )}

              {/* Honeypot field - hidden from users, catches bots */}
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  top: '-9999px',
                  opacity: 0,
                  height: 0,
                  width: 0,
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              />

              {/* Screenshot field placeholder - hidden for now */}
              {/* Future: Add drag-and-drop screenshot upload here */}

              {/* Notify checkbox */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  name="notifyOnUpdate"
                  checked={formData.notifyOnUpdate}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-300">
                  Notify me when this is addressed
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>,
    document.body
  );
};

export default FeedbackModal;
