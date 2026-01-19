import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import showToast from '../../utils/toastUtils';
import useScrollLock from '../../hooks/useScrollLock';

const EditCodeModal = ({ isOpen, onClose, onSuccess, code }) => {
  const [formData, setFormData] = useState({
    code: '',
    tier: 'pro',
    duration: '1_month',
    maxUses: 1,
    expiresAt: '',
    notes: '',
    isActive: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (code) {
      setFormData({
        code: code.code,
        tier: code.tier,
        duration: code.duration,
        maxUses: code.maxUses,
        expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().split('T')[0] : '',
        notes: code.notes || '',
        isActive: code.isActive
      });
    }
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put(`/admin/redeem-codes/${code._id}`, formData);
      showToast.success('Redeem code updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to update code');
    } finally {
      setLoading(false);
    }
  };

  // Lock background scroll
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div 
      data-modal-content
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div data-modal-content className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-gray-800/50">
          <h3 className="text-lg font-bold text-white">Edit Redeem Code</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Code & Active Status */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium text-gray-400">Code String</label>
                  <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="PRO-2024..."
                  required
                  />
              </div>
              <div className="space-y-1 w-24">
                  <label className="text-sm font-medium text-gray-400">Status</label>
                  <button
                      type="button"
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`w-full h-[42px] rounded-xl font-bold text-sm border transition-colors ${
                          formData.isActive 
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                      }`}
                  >
                      {formData.isActive ? 'Active' : 'Inactive'}
                  </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400">Tier</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({...formData, tier: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400">Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="1_month">1 Month</option>
                  <option value="3_months">3 Months</option>
                  <option value="6_months">6 Months</option>
                  <option value="1_year">1 Year</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400">Max Uses</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({...formData, maxUses: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400">Expires At (Optional)</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-400">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none min-h-[80px]"
                placeholder="Internal notes..."
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> Save Changes</>}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>,
    document.body
  );

};

export default EditCodeModal;
