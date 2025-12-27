import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Calendar, Mail } from 'lucide-react';

const TermsPage = () => {
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
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Scale size={20} />
            </div>
            <h1 className="text-xl font-bold">Terms of Service</h1>
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
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing or using Link Snap ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              Link Snap provides URL shortening services, analytics tracking, and related features. We reserve the 
              right to modify, suspend, or discontinue any aspect of the Service at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>When you create an account, you must provide accurate and complete information. You are responsible for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the security of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Subscription Plans</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>Link Snap offers both free and paid subscription plans:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Free Plan:</strong> Basic URL shortening with limited features</li>
                <li><strong>Pro Plan:</strong> Advanced features including custom aliases, link expiration, and password protection</li>
                <li><strong>Business Plan:</strong> Enterprise features with higher limits and priority support</li>
              </ul>
              <p className="mt-4">
                Paid subscriptions are billed through our payment partner, Lemon Squeezy. By subscribing, you agree to 
                their terms of service as well. Subscriptions auto-renew unless cancelled before the renewal date.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Prohibited Uses</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>You may not use the Service to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Distribute malware, viruses, or harmful code</li>
                <li>Engage in phishing or fraudulent activities</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon intellectual property rights</li>
                <li>Distribute illegal, harmful, or offensive content</li>
                <li>Attempt to bypass rate limits or abuse the Service</li>
                <li>Resell or redistribute the Service without permission</li>
              </ul>
              <p className="mt-4">
                We reserve the right to terminate accounts that violate these terms without prior notice.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              The Service and its original content, features, and functionality are owned by Link Snap and are 
              protected by international copyright, trademark, and other intellectual property laws. You retain 
              ownership of any content you submit through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for conduct that we 
              believe violates these Terms or is harmful to other users, us, or third parties. Upon termination, 
              your right to use the Service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-300 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS 
              OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LINK SNAP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of India, without regard 
              to its conflict of law provisions. Any disputes shall be resolved in the courts located in India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of significant changes 
              by posting a notice on the Service. Your continued use of the Service after such changes constitutes 
              acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="mt-4 flex items-center gap-2 text-blue-400">
              <Mail size={16} />
              <a href="mailto:support@linksnap.com" className="hover:underline">support@linksnap.com</a>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/cookies" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</Link>
          <span className="text-gray-600">•</span>
          <Link to="/" className="text-gray-400 hover:text-white transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
