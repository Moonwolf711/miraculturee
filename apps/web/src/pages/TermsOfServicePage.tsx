import { Link } from 'react-router-dom';
import SEO from '../components/SEO.js';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-noir-950 py-20 px-4 sm:px-6">
      <SEO
        title="Terms of Service"
        description="MiraCulture terms of service — rules, raffle terms, refund policy, and platform usage guidelines."
      />

      <article className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
            LEGAL
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-warm-50">
            TERMS OF SERVICE
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
          {/* Acceptance */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              1. ACCEPTANCE OF TERMS
            </h2>
            <p className="text-gray-400">
              By accessing or using the MiraCulture platform (&quot;Service&quot;), you agree
              to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree
              to all of these Terms, you may not use the Service.
            </p>
            <p className="text-gray-400 mt-3">
              MiraCulture reserves the right to update these Terms at any time. Continued
              use of the Service after changes are posted constitutes acceptance of the
              revised Terms.
            </p>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              2. ELIGIBILITY
            </h2>
            <p className="text-gray-400">
              You must be at least 18 years of age to use the Service. By creating an account,
              you represent and warrant that you meet this age requirement and that all
              information you provide is accurate and complete.
            </p>
          </section>

          {/* Account Responsibilities */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              3. ACCOUNT RESPONSIBILITIES
            </h2>
            <p className="text-gray-400">
              You are responsible for maintaining the confidentiality of your account
              credentials and for all activities that occur under your account. You must
              notify us immediately of any unauthorized use of your account.
            </p>
            <p className="text-gray-400 mt-3">
              You may not create multiple accounts, share your account with others, or use
              automated tools (bots) to interact with the Service.
            </p>
          </section>

          {/* How the Platform Works */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              4. HOW THE PLATFORM WORKS
            </h2>
            <p className="text-gray-400">
              MiraCulture connects supporters, fans, and artists through a fair ticket
              distribution system. The platform operates as follows:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>
                <strong className="text-gray-300">Support Purchases:</strong> Supporters buy
                tickets at face value to fund access for fans who cannot afford full-price
                tickets. 100% of the ticket purchase price goes toward securing tickets for
                the artist&apos;s event.
              </li>
              <li>
                <strong className="text-gray-300">Raffle Entries:</strong> Fans enter a raffle
                for a nominal entry fee ($5). Winners are selected through a cryptographically
                random draw and receive tickets to the event.
              </li>
              <li>
                <strong className="text-gray-300">Direct Ticket Purchases:</strong> Fans may
                also purchase tickets directly at face value plus a small service fee when
                available.
              </li>
            </ul>
          </section>

          {/* Raffle Terms */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              5. RAFFLE TERMS
            </h2>
            <p className="text-gray-400">
              Each event may have one or more raffle pools. By entering a raffle, you
              acknowledge and agree to the following:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>
                Entry requires a non-refundable fee of $5 per raffle pool (the
                &quot;Entry Fee&quot;).
              </li>
              <li>
                Winners are selected using a cryptographically secure random number generator.
                MiraCulture has no ability to influence or predict the outcome.
              </li>
              <li>
                Winning is not guaranteed. The number of winners depends on the number of
                available tickets funded by supporters.
              </li>
              <li>
                Each user may enter a given raffle pool only once.
              </li>
              <li>
                Raffle draws are scheduled approximately 24 hours before the event date.
                MiraCulture reserves the right to adjust draw timing.
              </li>
              <li>
                If a raffle pool is cancelled (e.g., event cancellation), entry fees may be
                refunded at MiraCulture&apos;s discretion.
              </li>
              <li>
                Winners will be notified via email and in-app notification. Failure to claim
                or use a ticket does not entitle the winner to a refund.
              </li>
            </ul>
          </section>

          {/* Support Purchases */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              6. SUPPORT PURCHASES
            </h2>
            <p className="text-gray-400">
              When you make a support purchase, you are funding tickets for the community.
              Support purchases are contributions to the MiraCulture mission and are
              generally non-refundable once confirmed.
            </p>
            <p className="text-gray-400 mt-3">
              A 2.5% platform fee is applied to support purchases to cover operational costs.
              The remaining funds are used exclusively to secure tickets for the associated event.
            </p>
            <p className="text-gray-400 mt-3">
              Supporters will receive a confirmation email and in-app notification upon
              successful payment processing.
            </p>
          </section>

          {/* Direct Ticket Purchases */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              7. DIRECT TICKET PURCHASES
            </h2>
            <p className="text-gray-400">
              Direct ticket purchases are subject to the ticket price set by the artist plus
              a service fee. Once confirmed, direct ticket purchases are non-refundable except
              in the event of cancellation by the artist or venue.
            </p>
            <p className="text-gray-400 mt-3">
              Tickets are non-transferable and may not be resold. Any attempt to resell tickets
              obtained through MiraCulture may result in ticket cancellation and account
              termination.
            </p>
          </section>

          {/* Artist Responsibilities */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              8. ARTIST RESPONSIBILITIES
            </h2>
            <p className="text-gray-400">
              Artists who list events on MiraCulture agree to the following:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>
                All event information (date, venue, ticket price, capacity) must be accurate
                and up to date.
              </li>
              <li>
                Ticket prices must reflect face value. Inflated pricing is prohibited.
              </li>
              <li>
                Artists must honor all tickets distributed through the platform, whether
                purchased directly, through support funding, or won via raffle.
              </li>
              <li>
                Artists are responsible for communicating any event changes (date changes,
                cancellations, venue changes) promptly.
              </li>
              <li>
                Events must be conducted with professionalism and in alignment with
                MiraCulture&apos;s mission of accessibility and inclusion.
              </li>
            </ul>
          </section>

          {/* Prohibited Conduct */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              9. PROHIBITED CONDUCT
            </h2>
            <p className="text-gray-400">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>Resell or transfer tickets obtained through the platform</li>
              <li>Use bots, scripts, or automated tools to interact with the Service</li>
              <li>Create multiple accounts to increase raffle odds</li>
              <li>Provide false or misleading information</li>
              <li>Interfere with the operation of the Service or its infrastructure</li>
              <li>Attempt to manipulate raffle outcomes</li>
              <li>Engage in fraudulent payment activity</li>
            </ul>
            <p className="text-gray-400 mt-3">
              Violation of these rules may result in immediate account termination, ticket
              cancellation, and forfeiture of any funds.
            </p>
          </section>

          {/* Refund Policy */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              10. REFUND POLICY
            </h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm text-gray-400 border-collapse">
                <thead>
                  <tr className="border-b border-noir-700">
                    <th className="text-left py-2 pr-4 text-gray-300 font-semibold">
                      Purchase Type
                    </th>
                    <th className="text-left py-2 text-gray-300 font-semibold">
                      Refund Policy
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-noir-800">
                    <td className="py-2 pr-4">Raffle Entry ($5)</td>
                    <td className="py-2">
                      Non-refundable. Refunded only if the event or raffle is cancelled.
                    </td>
                  </tr>
                  <tr className="border-b border-noir-800">
                    <td className="py-2 pr-4">Support Purchase</td>
                    <td className="py-2">
                      Non-refundable once payment is confirmed. Refunded if the event is
                      cancelled before tickets are allocated.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Direct Ticket</td>
                    <td className="py-2">
                      Non-refundable after confirmation. Refunded if the event is cancelled
                      by the artist or venue.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-400 mt-4">
              Refund requests for cancelled events will be processed within 10 business days.
              Contact{' '}
              <a
                href="mailto:support@mira-culture.com"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                support@mira-culture.com
              </a>{' '}
              for refund inquiries.
            </p>
          </section>

          {/* Platform Fees */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              11. PLATFORM FEES
            </h2>
            <p className="text-gray-400">
              MiraCulture charges a 2.5% platform fee on support purchases to cover
              operational costs including payment processing, infrastructure, and platform
              maintenance. This fee is transparently disclosed at the time of purchase.
            </p>
            <p className="text-gray-400 mt-3">
              Raffle entry fees ($5) cover the cost of raffle administration and platform
              operations.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              12. INTELLECTUAL PROPERTY
            </h2>
            <p className="text-gray-400">
              The MiraCulture name, logo, and all content, features, and functionality of
              the Service are owned by MiraCulture and are protected by copyright, trademark,
              and other intellectual property laws.
            </p>
            <p className="text-gray-400 mt-3">
              Artists retain all intellectual property rights to their own content (names,
              likenesses, music, and promotional materials) shared on the platform.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              13. LIMITATION OF LIABILITY
            </h2>
            <p className="text-gray-400">
              To the fullest extent permitted by law, MiraCulture shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising
              from your use of the Service, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
              <li>Event cancellations or changes by artists or venues</li>
              <li>Inability to attend an event after winning a raffle</li>
              <li>Technical failures affecting raffle draws or ticket delivery</li>
              <li>Unauthorized access to your account</li>
            </ul>
            <p className="text-gray-400 mt-3">
              MiraCulture&apos;s total liability for any claim shall not exceed the amount
              you paid to MiraCulture in the 12 months preceding the claim.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              14. DISPUTE RESOLUTION
            </h2>
            <p className="text-gray-400">
              Any disputes arising from these Terms or your use of the Service shall first be
              addressed through good-faith negotiation by contacting{' '}
              <a
                href="mailto:support@mira-culture.com"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                support@mira-culture.com
              </a>
              . If a dispute cannot be resolved through negotiation, it shall be submitted to
              binding arbitration in accordance with applicable laws.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              15. TERMINATION
            </h2>
            <p className="text-gray-400">
              We reserve the right to suspend or terminate your account at any time for
              violation of these Terms, fraudulent activity, or conduct that harms the
              MiraCulture community. Upon termination, your right to use the Service
              ceases immediately.
            </p>
            <p className="text-gray-400 mt-3">
              You may delete your account at any time by contacting us. Account deletion
              does not entitle you to a refund of any prior purchases.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              16. GOVERNING LAW
            </h2>
            <p className="text-gray-400">
              These Terms shall be governed by and construed in accordance with the laws of
              the United States. Any legal action arising from these Terms shall be brought
              in the courts of competent jurisdiction.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
              17. CONTACT
            </h2>
            <p className="text-gray-400">
              For questions about these Terms, contact us at{' '}
              <a
                href="mailto:legal@mira-culture.com"
                className="text-amber-500 hover:text-amber-400 underline"
              >
                legal@mira-culture.com
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
