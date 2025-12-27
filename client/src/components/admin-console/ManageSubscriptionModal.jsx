import { useState, useEffect, useCallback } from 'react';
import { X, CreditCard, Save, Loader2, AlertCircle, Calendar, Clock, Crown } from 'lucide-react';
import showToast from '../ui/Toast';
import api from '../../api/axios';

const ManageSubscriptionModal = ({ isOpen, onClose, user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tier: 'free',
    status: 'active',
    durationMode: 'custom', // custom, 30_days, 1_year, lifetime
    durationDays: 30, 
    reason: ''
  });

  // Reset form when user changes
  useEffect(() => {
    if (isOpen && user) {
      setForm({
        tier: user.subscription?.tier || 'free',
        status: user.subscription?.status || 'active',
        durationMode: 'custom',
        durationDays: 30,
        reason: ''
      });
    }
  }, [isOpen, user]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      showToast.warning('Please provide a reason for this change');
      return;
    }

    setLoading(true);
    try {
      // Calculate days based on mode
      let days = form.durationDays;
      if (form.durationMode === '30_days') days = 30;
      if (form.durationMode === '1_year') days = 365;
      if (form.durationMode === 'lifetime') days = 36500;
      
      // If setting to free, usually duration doesn't matter (cleared by backend), 
      // but we pass it anyway.
      
      const payload = {
        tier: form.tier,
        status: form.status,
        durationDays: days,
        reason: form.reason
      };

      const { data } = await api.patch(`/admin/users/${user._id}/subscription`, payload);
      
      showToast.success('Subscription updated successfully');
      if (onUpdate) onUpdate(data.user); // Pass back updated user
      handleClose();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="text-blue-400" size={24} />
            Manage Subscription
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {user.firstName ? user.firstName[0] : user.email[0].toUpperCase()}
             </div>
             <div>
               <p className="text-white font-medium">{user.email}</p>
               <p className="text-sm text-gray-400 flex items-center gap-2">
                 Current: <span className="uppercase font-bold text-blue-300">{user.subscription?.tier || 'Free'}</span>
                 <span className="text-gray-600">•</span>
                 <span className="capitalize">{user.subscription?.status || 'Active'}</span>
               </p>
             </div>
          </div>

          <form id="manage-sub-form" onSubmit={handleSubmit} className="space-y-5">
            
            {/* Tier & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                   <Crown size={14} className="text-amber-400" /> New Tier
                </label>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                  value={form.tier}
                  onChange={e => setForm({ ...form, tier: e.target.value })}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                   <AlertCircle size={14} className="text-purple-400" /> Status
                </label>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                  <option value="on_trial">On Trial</option>
                </select>
              </div>
            </div>

            {/* Duration Section - Hide if Free */}
            {form.tier !== 'free' && (
              <div className="animate-fade-in space-y-4 pt-2 border-t border-white/5">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                        <Clock size={14} className="text-green-400" /> Duration Preset
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'custom', label: 'Custom' },
                            { id: '30_days', label: '30 Days' },
                            { id: '1_year', label: '1 Year' },
                            { id: 'lifetime', label: 'Lifetime' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setForm({ ...form, durationMode: mode.id })}
                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                                    form.durationMode === mode.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-gray-800 text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {form.durationMode === 'custom' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                            <Calendar size={14} className="text-gray-400" /> Days from Now
                        </label>
                        <input
                            type="number"
                            min="1"
                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                            value={form.durationDays}
                            onChange={e => setForm({ ...form, durationDays: e.target.value })}
                        />
                    </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                    Reason for Change <span className="text-red-400">*</span>
                </label>
                <textarea
                    required
                    rows="3"
                    placeholder="E.g., Customer support compensation, manual upgrade request..."
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none transition-colors resize-none"
                    value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-white/5">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="manage-sub-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 font-medium transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Update Subscription
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptionModal;
