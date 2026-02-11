import { Link } from 'react-router-dom';
import SEO from '../components/SEO.js';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-noir-950 py-20 px-4 sm:px-6">
      <SEO
        title="Privacy Policy"
        description="MiraCulture privacy policy — how we collect, use, and protect your personal information."
      />

      <article className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
            LEGAL
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-warm-50">
            PRIVACY POLICY
          </h1>
          <div className="mt-6 flex items-center justify-center gap-3" aria-hidden="true">
            <div className="h-px w-12 bg-amber-500/30" />
            <div className="w-1 h-1 rotate-45 bg-amber-500/50" />
            <div className="h-px w-12 bg-amber-500/30" />
          </div>
          <p className="mt-6 font-body text-gray-500 text-sm">
            Last updated: February 10, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 font-body text-gray-300 text-base leading-relaxed">
          {/* Introduction */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              INTRODUCTION
            </h2>
            <p>
              MiraCulture (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the MiraCulture
              platform (the &quot;Service&quot;). This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our Service.
            </p>
            <p className="mt-3 text-gray-400">
              By using MiraCulture, you agree to the collection and use of information in
              accordance with this policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              INFORMATION WE COLLECT
            </h2>

            <h3 className="text-warm-50 font-semibold mt-4 mb-2">Account Information</h3>
            <p className="text-gray-400">
              When you create an account, we collect your name, email address, and a securely
              hashed password. If you register as an artist, we also collect your stage name
              and genre.
            </p>

            <h3 className="text-warm-50 font-semibold mt-4 mb-2">Payment Information</h3>
            <p className="text-gray-400">
              All payment processing is handled by <strong className="text-gray-300">Stripe</strong>.
              We never store your credit card number, CVV, or full card details on our servers.
              Stripe may collect payment method details, billing address, and transaction history
              in accordance with their own{' '}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                Privacy Policy
              </a>
              .
            </p>

            <h3 className="text-warm-50 font-semibold mt-4 mb-2">Event and Venue Data</h3>
            <p className="text-gray-400">
              We collect and display event information including venue names, addresses,
              and geographic coordinates (latitude/longitude) to help you discover events
              near you. Some event data is sourced from third-party providers such as EDMTrain.
            </p>

            <h3 className="text-warm-50 font-semibold mt-4 mb-2">Usage Data</h3>
            <p className="text-gray-400">
              We may collect information about how you access and use the Service, including
              your browser type, device information, pages visited, and the date and time of
              your visits.
            </p>

            <h3 className="text-warm-50 font-semibold mt-4 mb-2">Real-Time Connection Data</h3>
            <p className="text-gray-400">
              We use WebSocket connections (via Socket.IO) to deliver real-time updates such
              as ticket availability and raffle status. These connections may use cookies or
              tokens for session management.
            </p>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              HOW WE USE YOUR INFORMATION
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>To create and manage your account</li>
              <li>To process support ticket purchases, raffle entries, and direct ticket purchases</li>
              <li>To conduct fair and transparent raffle draws</li>
              <li>To send transactional emails (purchase confirmations, raffle results) via Resend</li>
              <li>To deliver real-time notifications about ticket availability and event updates</li>
              <li>To display events relevant to your location</li>
              <li>To improve and maintain the Service</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              THIRD-PARTY SERVICES
            </h2>
            <p className="text-gray-400">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>
                <strong className="text-gray-300">Stripe</strong> — Payment processing. Subject to{' '}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500 hover:text-amber-400 underline"
                >
                  Stripe&apos;s Privacy Policy
                </a>
              </li>
              <li>
                <strong className="text-gray-300">Resend</strong> — Transactional email delivery
              </li>
              <li>
                <strong className="text-gray-300">EDMTrain</strong> — Event data sourcing for venue and
                artist information
              </li>
            </ul>
            <p className="text-gray-400 mt-3">
              We do not sell, trade, or rent your personal information to third parties.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              DATA SECURITY
            </h2>
            <p className="text-gray-400">
              We implement appropriate technical and organizational measures to protect your
              personal data. Passwords are cryptographically hashed and never stored in plain
              text. All data is transmitted over encrypted HTTPS connections. Payment data is
              handled entirely by Stripe&apos;s PCI-compliant infrastructure.
            </p>
            <p className="text-gray-400 mt-3">
              However, no method of transmission over the Internet or electronic storage is
              100% secure. While we strive to protect your information, we cannot guarantee
              its absolute security.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              DATA RETENTION
            </h2>
            <p className="text-gray-400">
              We retain your account information for as long as your account is active.
              Transaction records are retained as required by applicable financial regulations.
              Past event data is archived but not deleted, as it may be needed for transaction
              history and audit purposes.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              YOUR RIGHTS
            </h2>
            <p className="text-gray-400">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and personal data</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Receive a copy of your data in a portable format</li>
            </ul>
            <p className="text-gray-400 mt-3">
              To exercise any of these rights, please contact us at{' '}
              <a
                href="mailto:privacy@miraculture.com"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                privacy@miraculture.com
              </a>
              .
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              CHILDREN&apos;S PRIVACY
            </h2>
            <p className="text-gray-400">
              The Service is not intended for individuals under the age of 18. We do not
              knowingly collect personal information from children. If you believe a child
              has provided us with personal data, please contact us and we will promptly
              delete it.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              CHANGES TO THIS POLICY
            </h2>
            <p className="text-gray-400">
              We may update this Privacy Policy from time to time. We will notify you of
              any changes by posting the new policy on this page and updating the &quot;Last
              updated&quot; date. Your continued use of the Service after changes are posted
              constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              CONTACT US
            </h2>
            <p className="text-gray-400">
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a
                href="mailto:privacy@miraculture.com"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                privacy@miraculture.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Back link */}
        <div className="mt-16 text-center">
          <Link
            to="/"
            className="text-gray-500 hover:text-amber-500 text-sm transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>
      </article>
    </div>
  );
}
