import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Loader2, Save, Calendar, FileText, Hash, Users, CreditCard, Clock } from 'lucide-react';
import showToast from '../ui/Toast';
import api from '../../api/axios';

const GenerateCodeModal = ({ isOpen, onClose, onCodeGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tier: 'pro',
    duration: '1_month',
    maxUses: 1,
    customCode: '',
    expiresAt: '',
    notes: ''
  });

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setForm({
        tier: 'pro',
        duration: '1_month',
        maxUses: 1,
        customCode: '',
        expiresAt: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Process expiration date to be end of the selected day
      let expiresAtISO = undefined;
      if (form.expiresAt) {
        const date = new Date(form.expiresAt);
        date.setHours(23, 59, 59, 999); // Set to end of day
        expiresAtISO = date.toISOString();
      }

      const payload = {
        tier: form.tier,
        duration: form.duration,
        maxUses: parseInt(form.maxUses) || 1,
        notes: form.notes || undefined,
        customCode: form.customCode ? form.customCode.toUpperCase() : undefined,
        expiresAt: expiresAtISO
      };

      const { data } = await api.post('/admin/redeem-codes', payload);
      
      showToast.success(`Code generated: ${data.code.code}`);
      
      // Copy to clipboard automatically
      await navigator.clipboard.writeText(data.code.code);
      showToast.success('Copied to clipboard!');
      
      onCodeGenerated();
      onClose();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const getDurationLabel = (key) => {
    const map = {
      '1_month': '1 Month',
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year',
      'lifetime': 'Lifetime'
    };
    return map[key] || key;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Gift className="text-green-400" size={24} />
            Generate Redeem Code
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="generate-code-form" onSubmit={handleSubmit} className="space-y-5">
            
            {/* Tier & Duration Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                   <CreditCard size={14} className="text-blue-400" /> Plan Tier
                </label>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  value={form.tier}
                  onChange={e => setForm({ ...form, tier: e.target.value })}
                >
                  <option value="pro">Pro Plan</option>
                  <option value="business">Business Plan</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                   <Clock size={14} className="text-purple-400" /> Duration
                </label>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                >
                  {['1_month', '3_months', '6_months', '1_year', 'lifetime'].map(d => (
                    <option key={d} value={d}>{getDurationLabel(d)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Code & Max Uses Row */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                        <Hash size={14} className="text-amber-400" /> Custom Code <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        placeholder="Automatic (Random)"
                        className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors uppercase font-mono tracking-wider"
                        value={form.customCode}
                        onChange={e => setForm({ ...form, customCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                        maxLength={20}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                        <Users size={14} className="text-cyan-400" /> Max Uses
                    </label>
                    <input
                        type="number"
                        min="1"
                        className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                        value={form.maxUses}
                        onChange={e => setForm({ ...form, maxUses: e.target.value })}
                    />
                </div>
            </div>

            {/* Expiration Date */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-red-400" /> Code Expires At <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                    <input
                        type="date"
                        className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors inverted-calendar-icon"
                        value={form.expiresAt}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                    If set, the code cannot be redeemed after this date.
                </p>
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-400" /> Internal Notes <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <textarea
                    rows="3"
                    placeholder="E.g., Generated for Twitter giveaway 2025..."
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors resize-none"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    maxLength={200}
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
            form="generate-code-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 font-medium transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Gift size={20} />}
            Generate Code
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateCodeModal;
