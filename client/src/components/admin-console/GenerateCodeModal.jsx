import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Gift,
  Loader2,
  Save,
  Calendar,
  FileText,
  Hash,
  Users,
  CreditCard,
  Clock,
} from 'lucide-react';
import showToast from '../../utils/toastUtils';
import api from '../../api/axios';
import useScrollLock from '../../hooks/useScrollLock';

const DURATION_PRESETS = [
  { value: '1_day', label: '1 Day (Trial / Promo)' },
  { value: '3_days', label: '3 Days (Weekend Pass)' },
  { value: '7_days', label: '7 Days (1 Week)' },
  { value: '14_days', label: '14 Days (2 Weeks)' },
  { value: '1_month', label: '1 Month' },
  { value: '3_months', label: '3 Months' },
  { value: '6_months', label: '6 Months' },
  { value: '1_year', label: '1 Year' },
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'custom_days', label: 'Custom Days (1–29)...' },
];

const GenerateCodeModal = ({ isOpen, onClose, onCodeGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDays, setCustomDays] = useState(7);
  const [form, setForm] = useState({
    tier: 'pro',
    duration: '1_month',
    maxUses: 1,
    customCode: '',
    expiresAt: '',
    notes: '',
  });

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setIsCustomDays(false);
      setCustomDays(7);
      setForm({
        tier: 'pro',
        duration: '1_month',
        maxUses: 1,
        customCode: '',
        expiresAt: '',
        notes: '',
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

  // Lock background scroll
  useScrollLock(isOpen);

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

      const finalDuration = isCustomDays
        ? `${Math.min(29, Math.max(1, parseInt(customDays) || 1))}_days`
        : form.duration;

      const payload = {
        tier: form.tier,
        duration: finalDuration,
        maxUses: parseInt(form.maxUses) || 1,
        notes: form.notes || undefined,
        customCode: form.customCode ? form.customCode.toUpperCase() : undefined,
        expiresAt: expiresAtISO,
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

  return createPortal(
    <div
      data-modal-content
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />
      <div
        data-modal-content
        className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-scale-in"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Gift className="text-green-400" size={24} />
            Generate Redeem Code
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar overscroll-contain">
          <form id="generate-code-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Tier & Duration Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-blue-400" /> Plan Tier
                </span>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value })}
                >
                  <option value="pro">Pro Plan</option>
                  <option value="business">Business Plan</option>
                </select>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-400" /> Duration
                </span>
                <select
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  value={isCustomDays ? 'custom_days' : form.duration}
                  onChange={(e) => {
                    if (e.target.value === 'custom_days') {
                      setIsCustomDays(true);
                    } else {
                      setIsCustomDays(false);
                      setForm({ ...form, duration: e.target.value });
                    }
                  }}
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Days Stepper (Visible when Custom Days is selected) */}
            {isCustomDays && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 animate-fade-in space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-300 flex items-center gap-1.5">
                    <Clock size={14} /> Custom Period: {customDays} {customDays === 1 ? 'Day' : 'Days'} Access
                  </span>
                  <span className="text-xs text-purple-400/80">Allowed: 1 to 29 Days</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="29"
                    value={customDays}
                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                    className="flex-1 accent-purple-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
                  />
                  <div className="flex items-center gap-1.5 w-24">
                    <input
                      type="number"
                      min="1"
                      max="29"
                      value={customDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setCustomDays(Math.min(29, Math.max(1, val)));
                        }
                      }}
                      className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-2.5 py-1 text-center text-white font-bold text-sm focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-xs text-gray-400">Days</span>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Code & Max Uses Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                  <Hash size={14} className="text-amber-400" /> Custom Code{' '}
                  <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </span>
                <input
                  type="text"
                  placeholder="Automatic (Random)"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors uppercase font-mono tracking-wider"
                  value={form.customCode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                    })
                  }
                  maxLength={20}
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-cyan-400" /> Max Uses
                </span>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                />
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                <Calendar size={14} className="text-red-400" /> Code Expires At{' '}
                <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </span>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors inverted-calendar-icon"
                  value={form.expiresAt}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                If set, the code cannot be redeemed after this date.
              </p>
            </div>

            {/* Notes */}
            <div>
              <span className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" /> Internal Notes{' '}
                <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </span>
              <textarea
                rows="3"
                placeholder="E.g., Generated for Twitter giveaway 2025..."
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-colors resize-none"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
    </div>,
    document.body
  );
};

export default GenerateCodeModal;
