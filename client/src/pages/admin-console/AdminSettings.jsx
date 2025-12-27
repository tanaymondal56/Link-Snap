import { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Server, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  CheckCircle,
  Eye,
  EyeOff,
  Send
} from 'lucide-react';
import BentoCard from '../../components/admin-console/ui/BentoCard';
import api from '../../api/axios';
import showToast from '../../components/ui/Toast';

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    requireEmailVerification: true,
    emailConfigured: false,
  });

  // Email Form State
  const [emailForm, setEmailForm] = useState({
    emailProvider: 'gmail',
    emailUsername: '',
    emailPassword: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [togglingVerification, setTogglingVerification] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/admin/settings');
      setSettings(data);
      if (data.emailUsername) {
        setEmailForm({
          emailProvider: data.emailProvider || 'gmail',
          emailUsername: data.emailUsername || '',
          emailPassword: '', // Don't populate password
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || 587,
          smtpSecure: data.smtpSecure || false,
        });
      }
    } catch (error) {
      console.error(error);
      showToast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerification = async () => {
    setTogglingVerification(true);
    try {
      const newValue = !settings.requireEmailVerification;
      const { data } = await api.patch('/admin/settings', { requireEmailVerification: newValue });
      setSettings(data);
      showToast.success(`Email verification ${newValue ? 'enabled' : 'disabled'}`);
    } catch {
      showToast.error('Failed to update settings');
    } finally {
      setTogglingVerification(false);
    }
  };

  const handleSaveEmailConfig = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!emailForm.emailUsername) {
      showToast.warning('Please enter your email address');
      return;
    }
    if (!settings.emailConfigured && !emailForm.emailPassword) {
      showToast.warning('Please enter your email password or app password');
      return;
    }
    // Validate SMTP fields if custom SMTP is selected
    if (emailForm.emailProvider === 'smtp') {
      if (!emailForm.smtpHost) {
        showToast.warning('Please enter SMTP host');
        return;
      }
      if (!emailForm.smtpPort) {
        showToast.warning('Please enter SMTP port');
        return;
      }
    }

    setSavingEmail(true);
    try {
      const payload = { ...emailForm };
      if (!payload.emailPassword) delete payload.emailPassword; // Don't send empty pass
      
      await api.put('/admin/settings', payload);
      setSettings(prev => ({ ...prev, emailConfigured: true }));
      showToast.success('Email configuration saved');
    } catch {
      showToast.error('Failed to save email config');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailAddress) {
      showToast.warning('Enter an email address to test');
      return;
    }
    setTestingEmail(true);
    try {
      await api.post('/admin/settings/test-email', { email: testEmailAddress });
      showToast.success('Test email sent successfully');
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Settings
          </h1>
          <p className="text-gray-400 mt-1">System configuration and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Policies */}
        <BentoCard title="System Policies" icon={ShieldCheck} variant="default">
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <h3 className="font-medium text-white">Require Email Verification</h3>
                <p className="text-sm text-gray-400">New users must verify email before logging in</p>
              </div>
              <button 
                onClick={handleToggleVerification}
                disabled={togglingVerification}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 ${
                  settings.requireEmailVerification ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.requireEmailVerification ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {/* Add more toggles here */}
          </div>
        </BentoCard>

        {/* Email Configuration */}
        <BentoCard title="Email Configuration" icon={Mail} variant="default" className="row-span-2">
          <form onSubmit={handleSaveEmailConfig} className="mt-4 space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Provider</label>
                  <select 
                    value={emailForm.emailProvider}
                    onChange={(e) => setEmailForm({ ...emailForm, emailProvider: e.target.value })}
                    className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook / Hotmail</option>
                    <option value="yahoo">Yahoo Mail</option>
                    <option value="smtp">Custom SMTP</option>
                  </select>
                  {emailForm.emailProvider === 'gmail' && (
                    <p className="mt-2 text-xs text-gray-500">
                      For Gmail, use an App Password. Enable 2FA and create one at{' '}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Account Settings</a>
                    </p>
                  )}
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email / Username</label>
                  <input 
                    type="text" 
                    value={emailForm.emailUsername}
                    onChange={(e) => setEmailForm({ ...emailForm, emailUsername: e.target.value })}
                    className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Password / App Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={emailForm.emailPassword}
                      onChange={(e) => setEmailForm({ ...emailForm, emailPassword: e.target.value })}
                      placeholder={settings.emailConfigured ? '••••••••' : ''}
                      className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
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

                {emailForm.emailProvider === 'smtp' && (
                  <>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-400 mb-1">SMTP Host</label>
                      <input 
                        type="text" 
                        value={emailForm.smtpHost}
                        onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                        className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Port</label>
                      <input 
                        type="number" 
                        value={emailForm.smtpPort}
                        onChange={(e) => setEmailForm({ ...emailForm, smtpPort: e.target.value })}
                        className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                  </>
                )}
             </div>

             <div className="pt-4 border-t border-white/5 flex justify-end">
                <button 
                  type="submit" 
                  disabled={savingEmail}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 font-medium disabled:opacity-50"
                >
                  {savingEmail ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Configuration
                </button>
             </div>
          </form>

          {/* Test Email Section */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <h4 className="text-sm font-medium text-gray-300 mb-4">Test Connection</h4>
            <form onSubmit={handleTestEmail} className="flex gap-3">
              <input 
                type="email" 
                placeholder="recipient@example.com" 
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="flex-1 bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
              />
              <button 
                type="submit"
                disabled={testingEmail || !settings.emailConfigured}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {testingEmail ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                Send
              </button>
            </form>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};

export default AdminSettings;
