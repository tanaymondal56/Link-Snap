import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Calendar, Mail } from 'lucide-react';

const PrivacyPage = () => {
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
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <Shield size={20} />
            </div>
            <h1 className="text-xl font-bold">Privacy Policy</h1>
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
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              Link Snap ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our URL 
              shortening service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            <div className="text-gray-300 leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
                <p>When you create an account, we collect:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Email address</li>
                  <li>Name (if provided)</li>
                  <li>Password (stored securely using hashing)</li>
                  <li>Profile information you choose to provide</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Usage Data</h3>
                <p>We automatically collect:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>URLs you shorten</li>
                  <li>Click analytics (timestamps, referring pages)</li>
                  <li>Device and browser information</li>
                  <li>IP addresses (for analytics and security)</li>
                  <li>Geographic location data (country/region level)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <div className="text-gray-300 leading-relaxed">
              <p className="mb-3">We use the collected information to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide and maintain the URL shortening service</li>
                <li>Generate analytics and statistics for your shortened links</li>
                <li>Process your subscription payments</li>
                <li>Send service-related communications</li>
                <li>Detect and prevent fraud and abuse</li>
                <li>Improve our services</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Retention</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>We retain your data based on your subscription tier:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Free Plan:</strong> Analytics data retained for 30 days</li>
                <li><strong>Pro Plan:</strong> Analytics data retained for 1 year</li>
                <li><strong>Business Plan:</strong> Unlimited analytics data retention</li>
              </ul>
              <p className="mt-4">
                Account information is retained until you delete your account. You can request account deletion 
                at any time through your settings.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Third-Party Services</h2>
            <div className="text-gray-300 leading-relaxed">
              <p className="mb-3">We use the following third-party services:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Lemon Squeezy:</strong> Payment processing for subscriptions</li>
                <li><strong>MongoDB:</strong> Database hosting</li>
              </ul>
              <p className="mt-4">
                These services have their own privacy policies governing their use of your data.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-3 text-gray-300">
              <li>HTTPS encryption for all data transmission</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Your Rights</h2>
            <div className="text-gray-300 leading-relaxed">
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We use cookies and similar tracking technologies. For detailed information, please see our{' '}
              <Link to="/cookies" className="text-blue-400 hover:underline">Cookie Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Children's Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us:
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
          <Link to="/cookies" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
