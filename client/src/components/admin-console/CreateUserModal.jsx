import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Loader2, Save, Eye, EyeOff, AlertCircle, CheckCircle, Check } from 'lucide-react';
import showToast from '../ui/Toast';
import api from '../../api/axios';

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid | reserved
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    website: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = useCallback(() => {
    setForm({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      firstName: '',
      lastName: '',
      phone: '',
      company: '',
      website: ''
    });
    setShowPassword(false);
    setUsernameStatus('idle');
    onClose();
  }, [onClose]);


  // Debounced username availability check
  useEffect(() => {
    if (!form.username || form.username.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(form.username)) {
      setUsernameStatus('invalid');
      return;
    }
    if (form.username.length > 30) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username/${form.username}`);
        setUsernameStatus(data.available ? 'available' : (data.reason === 'reserved' ? 'reserved' : 'taken'));
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [form.username]);

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
    if (!form.email || !form.password) {
      showToast.warning('Email and password are required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      showToast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      showToast.warning('Password must be at least 8 characters');
      return;
    }
    if (form.username && (form.username.length < 3 || form.username.length > 30)) {
       showToast.warning('Username must be 3-30 characters');
       return;
    }
    if (form.username && (usernameStatus === 'taken' || usernameStatus === 'reserved')) {
       showToast.warning('This username is not available');
       return;
    }

    setLoading(true);
    try {
      // Clean payload: replace empty strings with undefined
      const payload = { ...form };
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = undefined;
      });
      
      await api.post('/admin/users', payload);
      showToast.success('User created successfully');
      onUserCreated();
      onClose();
      setForm({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        firstName: '',
        lastName: '',
        phone: '',
        company: '',
        website: ''
      });
    } catch {
      showToast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] overscroll-contain">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="text-blue-400" size={24} />
            Create New User
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Account Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Auto-generated if empty"
                      className={`w-full bg-gray-800 border rounded-xl px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none ${
                        usernameStatus === 'available' ? 'border-green-500/50' :
                        usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'invalid' ? 'border-red-500/50' :
                        'border-white/10'
                      }`}
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                      {usernameStatus === 'available' && <Check className="w-4 h-4 text-green-500" />}
                      {(usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'invalid') && <X className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  <p className={`mt-1 text-xs ${
                    usernameStatus === 'available' ? 'text-green-500' :
                    usernameStatus === 'taken' || usernameStatus === 'reserved' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {usernameStatus === 'available' ? 'Available!' :
                     usernameStatus === 'taken' ? 'Already taken' :
                     usernameStatus === 'reserved' ? 'Not available' :
                     usernameStatus === 'invalid' ? 'Invalid format' :
                     'Lowercase letters, numbers, underscores, dashes. Auto-generated if empty.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  {form.role === 'admin' && (
                    <p className="mt-1.5 text-xs text-yellow-400 flex items-center gap-1">
                      <AlertCircle size={12} /> Admin users have full system access
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white focus:border-blue-500/50 focus:outline-none"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.confirmPassword}
                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4 border-t border-white/5 pt-6">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:outline-none"
                    value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400 flex items-center gap-2">
                <CheckCircle size={14} className="flex-shrink-0" />
                Admin-created users are automatically verified and can log in immediately
              </p>
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
            form="create-user-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 font-medium transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Create User
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;
