import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldX,
  Mail,
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import api from '../api/axios';

// Read ban info from session storage (called once during module init)
const getBanInfo = () => {
  const message = sessionStorage.getItem('banMessage') || '';
  const reason = sessionStorage.getItem('banReason') || '';
  const bannedAt = sessionStorage.getItem('banBannedAt') || '';
  const bannedUntil = sessionStorage.getItem('banBannedUntil') || '';
  const userEmail = sessionStorage.getItem('banUserEmail') || '';
  let support = null;
  try {
    const supportStr = sessionStorage.getItem('banSupport');
    if (supportStr) support = JSON.parse(supportStr);
  } catch (e) {
    console.error('Failed to parse support info', e);
  }
  return { message, reason, bannedAt, bannedUntil, userEmail, support };
};

const AccountSuspended = () => {
  // Get the ban info from session storage on initial render
  const [banInfo] = useState(getBanInfo);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appealStatus, setAppealStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [appealResponse, setAppealResponse] = useState(null);
  const [checkingAppeal, setCheckingAppeal] = useState(false);
  const [isReactivated, setIsReactivated] = useState(false);
  const [appealsCount, setAppealsCount] = useState(0);
  const [maxAppeals, setMaxAppeals] = useState(3);

  useEffect(() => {
    // Clear session storage after component mounts
    sessionStorage.removeItem('banMessage');
    sessionStorage.removeItem('banReason');
    sessionStorage.removeItem('banSupport');
    sessionStorage.removeItem('banBannedAt');
    sessionStorage.removeItem('banBannedUntil');
    // Keep email and token for appeal form
  }, []);

  // Check if user already has an appeal
  useEffect(() => {
    const checkExistingAppeal = async () => {
      const appealToken = sessionStorage.getItem('banAppealToken');
      const email = banInfo.userEmail;

      if (!email && !appealToken) return;

      setCheckingAppeal(true);
      try {
        const config = {};
        if (appealToken) {
          config.headers = { Authorization: `Bearer ${appealToken}` };
        }

        const { data } = await api.get(
          `/appeals/status?email=${encodeURIComponent(email || '')}`,
          config
        );

        if (data.isActive) {
          setIsReactivated(true);
        }

        if (data.appealsCount !== undefined) {
          setAppealsCount(data.appealsCount);
          setMaxAppeals(data.maxAppeals || 3);
        }

        if (data.hasAppeal) {
          setAppealStatus(data.status);
          setAppealResponse(data.adminResponse);
        }
      } catch (error) {
        console.error('Failed to check appeal status:', error);
      } finally {
        setCheckingAppeal(false);
      }
    };

    checkExistingAppeal();
  }, [banInfo.userEmail]);

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();

    if (!appealMessage) {
      return;
    }

    if (appealMessage.length < 10) {
      return;
    }

    const appealToken = sessionStorage.getItem('banAppealToken');
    if (!appealToken) {
      alert('Session expired. Please try logging in again to submit an appeal.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(
        '/appeals',
        { message: appealMessage },
        { headers: { Authorization: `Bearer ${appealToken}` } }
      );
      setAppealStatus('pending');
      setShowAppealForm(false);
      setAppealMessage('');
    } catch (error) {
      console.error('Failed to submit appeal:', error);
      // Show error in form
      alert(error.response?.data?.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const supportEmail = banInfo.support?.email || 'support@linksnap.com';

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return null;
    }
  };

  const bannedAtFormatted = formatDate(banInfo.bannedAt);
  const bannedUntilFormatted = formatDate(banInfo.bannedUntil);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Main Card */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                isReactivated
                  ? 'bg-green-500/20 border-green-500/30'
                  : 'bg-red-500/20 border-red-500/30'
              }`}
            >
              {isReactivated ? (
                <CheckCircle className="w-10 h-10 text-green-400" />
              ) : (
                <ShieldX className="w-10 h-10 text-red-400" />
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {isReactivated ? 'Account Reactivated' : 'Account Suspended'}
          </h1>

          {isReactivated ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 mb-6">
              <div className="flex flex-col items-center text-center gap-4">
                <p className="text-green-200 text-sm">
                  Good news! Your account has been reactivated. You can now access your dashboard
                  and links.
                </p>
                <Link
                  to="/login"
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-green-900/20"
                >
                  Log In Now
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Status Message */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-200 text-sm">
                    {banInfo.message ||
                      'Your account has been suspended. Please contact support for assistance.'}
                  </p>
                </div>
              </div>

              {/* Ban timestamp and duration */}
              {(bannedAtFormatted || bannedUntilFormatted) && (
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 flex-1">
                      {bannedAtFormatted && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Suspended on</span>
                          <span className="text-gray-300">{bannedAtFormatted}</span>
                        </div>
                      )}
                      {bannedUntilFormatted && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Suspended until</span>
                          <span className="text-orange-300">{bannedUntilFormatted}</span>
                        </div>
                      )}
                      {!bannedUntilFormatted && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Duration</span>
                          <span className="text-red-300">Indefinite</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Reason if provided */}
              {banInfo.reason && (
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reason</p>
                      <p className="text-gray-300 text-sm">{banInfo.reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Appeal Status */}
              {checkingAppeal ? (
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4 mb-4 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-gray-400 text-sm">Checking appeal status...</span>
                </div>
              ) : appealStatus === 'pending' ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-300 text-sm font-medium">Appeal Submitted</p>
                      <p className="text-yellow-200/70 text-xs mt-1">
                        Your appeal is pending review. We'll notify you once it's been reviewed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : appealStatus === 'approved' ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-green-300 text-sm font-medium">Appeal Approved</p>
                      {appealResponse && (
                        <p className="text-green-200/70 text-xs mt-1">{appealResponse}</p>
                      )}
                      <p className="text-green-200/70 text-xs mt-1">
                        Try logging in again - your account may have been reactivated.
                      </p>
                    </div>
                  </div>
                </div>
              ) : appealStatus === 'rejected' ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="w-full">
                      <p className="text-red-300 text-sm font-medium">Appeal Rejected</p>
                      {appealResponse && (
                        <p className="text-red-200/70 text-xs mt-1">{appealResponse}</p>
                      )}

                      {/* Appeal Limit Info */}
                      <div className="mt-3 pt-3 border-t border-red-500/20 flex justify-between items-center">
                        <span className="text-xs text-red-300/70">
                          {appealsCount >= maxAppeals
                            ? 'Maximum appeal limit reached.'
                            : `${maxAppeals - appealsCount} appeal${maxAppeals - appealsCount !== 1 ? 's' : ''} remaining.`}
                        </span>
                        {appealsCount < maxAppeals && (
                          <span className="text-[10px] text-red-300/50">
                            You can submit a new appeal.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Appeal Form */}
              {showAppealForm ? (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 mb-4">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" />
                    Submit Appeal
                  </h3>
                  <form onSubmit={handleSubmitAppeal} className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Account Email</label>
                      <div className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 text-sm flex items-center gap-2 cursor-not-allowed">
                        <Mail className="w-3 h-3" />
                        {banInfo.userEmail || 'Unknown Account'}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        This appeal will be securely linked to this account.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Appeal Message</label>
                      <textarea
                        value={appealMessage}
                        onChange={(e) => setAppealMessage(e.target.value)}
                        placeholder="Explain why you believe your account should be reinstated..."
                        className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-violet-500 focus:outline-none resize-none"
                        rows={4}
                        maxLength={2000}
                        required
                      />
                      <p className="text-xs text-gray-500 text-right mt-1">
                        {appealMessage.length}/2000
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAppealForm(false)}
                        className="flex-1 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || appealMessage.length < 10}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Submit Appeal
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                (!appealStatus || (appealStatus === 'rejected' && appealsCount < maxAppeals)) && (
                  <button
                    onClick={() => setShowAppealForm(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 text-violet-300 border border-violet-500/30 rounded-lg transition-all duration-200 font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    {appealStatus === 'rejected' ? 'Submit New Appeal' : 'Submit an Appeal'}
                  </button>
                )
              )}

              {/* Info Text */}
              <p className="text-gray-400 text-center text-sm mb-6">
                {banInfo.support?.message ||
                  'If you believe this is a mistake or would like to appeal this decision, please contact our support team.'}
              </p>

              {/* Contact Support */}
              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg p-4 mb-6">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-400" />
                  Contact Support
                </h3>
                <p className="text-gray-400 text-sm mb-2">Email us at:</p>
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-violet-400 hover:text-violet-300 transition-colors text-sm font-medium"
                >
                  {supportEmail}
                </a>
                <p className="text-gray-500 text-xs mt-3">
                  Please include your account email and any relevant information when contacting us.
                </p>
              </div>

              {/* What to include */}
              <div className="bg-gray-700/20 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-2">When contacting support, include:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-violet-400 rounded-full"></span>
                    Your registered email address
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-violet-400 rounded-full"></span>
                    Reason for appeal (if applicable)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-violet-400 rounded-full"></span>
                    Any additional context or information
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Back to Home */}
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all duration-200 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          © {new Date().getFullYear()} Link Snap. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AccountSuspended;
