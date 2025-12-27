import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Calendar, Mail } from 'lucide-react';

const CookiePage = () => {
  const lastUpdated = 'December 17, 2024';
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <Cookie size={20} />
            </div>
            <h1 className="text-xl font-bold">Cookie Policy</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center gap-2 text-sm text-gray-400">
          <Calendar size={14} />
          <span>Last updated: {lastUpdated}</span>
        </div>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. What Are Cookies?</h2>
            <p className="text-gray-300 leading-relaxed">
              Cookies are small text files that are stored on your device when you visit a website. They help 
              websites remember your preferences, keep you logged in, and provide a better user experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Link Snap uses cookies and similar technologies for the following purposes:
            </p>
            
            <div className="space-y-6">
              <div className="bg-gray-900/50 p-4 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-2">Essential Cookies</h3>
                <p className="text-gray-400 text-sm mb-2">Required for the website to function properly</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li>Authentication and login sessions</li>
                  <li>Security tokens (CSRF protection)</li>
                  <li>User preferences</li>
                </ul>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-2">Functional Cookies</h3>
                <p className="text-gray-400 text-sm mb-2">Enhance your experience</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li>Remembering your settings</li>
                  <li>Storing recently created links</li>
                  <li>Theme preferences (dark/light mode)</li>
                </ul>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-2">Analytics Cookies</h3>
                <p className="text-gray-400 text-sm mb-2">Help us improve our service</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li>Understanding how you use our website</li>
                  <li>Identifying popular features</li>
                  <li>Measuring performance</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Cookies We Use</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Cookie Name</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Purpose</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">token</td>
                    <td className="py-3 px-4">Authentication session</td>
                    <td className="py-3 px-4">7 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">refreshToken</td>
                    <td className="py-3 px-4">Session renewal</td>
                    <td className="py-3 px-4">30 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">changelog_seen</td>
                    <td className="py-3 px-4">Track viewed updates</td>
                    <td className="py-3 px-4">Persistent</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">theme</td>
                    <td className="py-3 px-4">UI theme preference</td>
                    <td className="py-3 px-4">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              When you make a payment, our payment processor (Lemon Squeezy) may set their own cookies. 
              These are governed by their respective privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Managing Cookies</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>You can control cookies through your browser settings. Here's how:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies</li>
                <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
                <li><strong>Edge:</strong> Settings → Cookies and site permissions</li>
              </ul>
              <p className="mt-4 text-amber-400/80">
                Note: Disabling essential cookies may prevent you from using certain features of Link Snap, 
                including logging into your account.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Updates to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Cookie Policy from time to time. Any changes will be posted on this page 
              with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about our use of cookies, please contact us:
            </p>
            <div className="mt-4 flex items-center gap-2 text-blue-400">
              <Mail size={16} />
              <a href="mailto:privacy@linksnap.com" className="hover:underline">privacy@linksnap.com</a>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm">
          <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
          <span className="text-gray-600">•</span>
          <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default CookiePage;
