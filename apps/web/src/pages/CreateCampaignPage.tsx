import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

interface ArtistEvent {
  id: string;
  title: string;
  venueName: string;
  date: string;
  ticketPriceCents: number;
}

interface DashboardLevel {
  currentLevel: number;
  tierWithinLevel: number;
  maxTicketsForLevel: number;
  discountCents: number;
}

interface CreatedCampaign {
  id: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
}

const PROMO_TEMPLATES = [
  {
    platform: 'Instagram / TikTok',
    btnClass: 'bg-gradient-to-r from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 hover:from-[#833AB4]/25 hover:via-[#E1306C]/25 hover:to-[#F77737]/25 text-[#E1306C] border-[#E1306C]/20',
    template: (venue: string, _url: string) =>
      `I just launched a campaign on @miraculturee for my show at ${venue}. Fans worldwide can donate to unlock $5\u2013$10 tickets for locals who might not be able to afford face value. 100% of donations come to me. Link in bio.\n\n#MiraCulture #LiveMusic #FanPowered`,
  },
  {
    platform: 'X / Twitter',
    btnClass: 'bg-noir-700 hover:bg-noir-600 text-warm-50 border-noir-600',
    template: (venue: string, url: string) =>
      `Just launched my @miraculturee campaign. Fans can donate to unlock affordable tickets for my ${venue} show \u2014 100% comes to me, 0% to scalpers.\n\nSupport the music: ${url}\n\n#MiraCulture`,
  },
  {
    platform: 'Facebook',
    btnClass: 'bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border-[#1877F2]/20',
    template: (venue: string, url: string) =>
      `Excited to launch my MiraCulture campaign for my upcoming show at ${venue}!\n\nHere\u2019s how it works: fans donate to hit a goal, then 10 tickets unlock at just $5\u2013$10 for verified local fans. Every dollar donated goes directly to me. No middlemen.\n\nSupport here: ${url}`,
  },
  {
    platform: 'General',
    btnClass: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20',
    template: (venue: string, url: string) =>
      `I\u2019m running a fan-powered campaign on MiraCulture for my show at ${venue}. Donate to help unlock affordable tickets for local fans \u2014 100% goes to me. ${url}`,
  },
];

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ArtistEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE');
  const [campaignLevel, setCampaignLevel] = useState(1);
  const [levelInfo, setLevelInfo] = useState<DashboardLevel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [createdCampaign, setCreatedCampaign] = useState<CreatedCampaign | null>(null);
  const [copiedIdx, setCopiedIdx] = useState(-1);

  useEffect(() => {
    api
      .get<{ upcomingEvents: ArtistEvent[]; currentLevel: number; tierWithinLevel: number; maxTicketsForLevel: number; discountCents: number }>('/artist/dashboard')
      .then((d) => {
        setEvents(d.upcomingEvents);
        if (d.upcomingEvents.length > 0) setEventId(d.upcomingEvents[0].id);
        const info: DashboardLevel = {
          currentLevel: d.currentLevel,
          tierWithinLevel: d.tierWithinLevel,
          maxTicketsForLevel: d.maxTicketsForLevel,
          discountCents: d.discountCents,
        };
        setLevelInfo(info);
        setCampaignLevel(info.currentLevel);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) { setError('Select an event'); return; }
    setError('');
    setLoading(true);
    try {
      const campaign = await api.post<{ id: string }>('/artist/campaigns', {
        eventId,
        headline,
        message,
        campaignLevel,
      });
      // If they want it active immediately, update status
      if (status === 'ACTIVE') {
        await api.put(`/artist/campaigns/${campaign.id}`, { status: 'ACTIVE' });
      }
      const selectedEvent = events.find((e) => e.id === eventId);
      if (status === 'ACTIVE' && selectedEvent) {
        setCreatedCampaign({
          id: campaign.id,
          eventId,
          eventTitle: selectedEvent.title,
          venueName: selectedEvent.venueName,
        });
      } else {
        navigate('/artist/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const inputClass =
    'w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600';

  /* ---------- Success screen with social promotion templates ---------- */
  if (createdCampaign) {
    const shareUrl = `${window.location.origin}/events/${createdCampaign.eventId}`;
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
        <SEO title="Campaign Live" description="Your campaign is live. Promote it on social media." noindex />
        <div className="w-full max-w-lg">
          <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
            {/* Success header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full border-2 border-green-500/40 bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-2">
                CAMPAIGN LIVE
              </h1>
              <p className="text-gray-400 text-sm font-body">
                Now promote it on your socials to start driving donations.
              </p>
            </div>

            {/* Share link */}
            <div className="bg-noir-950 border border-noir-800 rounded-lg p-4 mb-6">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">Share this link</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm font-body truncate flex-1">{shareUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); setCopiedIdx(-2); setTimeout(() => setCopiedIdx(-1), 2000); }}
                  className="flex-shrink-0 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold transition-colors"
                >
                  {copiedIdx === -2 ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Social media templates */}
            <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-3">
              Ready-to-post templates
            </p>
            <div className="space-y-3 mb-8">
              {PROMO_TEMPLATES.map((tmpl, i) => {
                const text = tmpl.template(createdCampaign.venueName, shareUrl);
                return (
                  <div key={tmpl.platform} className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-body text-xs uppercase tracking-wider text-gray-400 font-semibold">
                        {tmpl.platform}
                      </span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopiedIdx(i); setTimeout(() => setCopiedIdx(-1), 2000); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${tmpl.btnClass}`}
                      >
                        {copiedIdx === i ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="font-body text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Dashboard link */}
            <div className="text-center">
              <Link
                to="/artist/dashboard"
                className="px-5 py-2.5 border border-noir-700 text-gray-300 hover:border-amber-500/50 hover:text-amber-500 font-medium text-sm tracking-wide uppercase rounded-sm transition-all duration-300 inline-block"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO title="Create Campaign" description="Promote your show to reach more fans." noindex />
      <div className="w-full max-w-lg">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-3xl tracking-wider text-warm-50 text-center mb-2">
            PROMOTE YOUR SHOW
          </h1>
          <p className="text-gray-400 text-sm text-center font-body mb-8">
            Create a campaign to highlight your upcoming event to fans.
          </p>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="campaign-event" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Event
              </label>
              {eventsLoading ? (
                <div className="h-12 bg-noir-800 rounded-lg animate-pulse" />
              ) : events.length === 0 ? (
                <p className="text-gray-500 text-sm font-body">No upcoming events. Create an event first.</p>
              ) : (
                <select
                  id="campaign-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={inputClass}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} — {ev.venueName} ({formatDate(ev.date)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Campaign Summary — level-aware */}
            {eventId && events.length > 0 && levelInfo && (() => {
              const selectedEvent = events.find((e) => e.id === eventId);
              if (!selectedEvent) return null;
              const ticketCount = campaignLevel * 10;
              const goalCents = selectedEvent.ticketPriceCents * ticketCount;
              return (
                <div className="bg-noir-950 border border-noir-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Campaign Summary</p>

                  {/* Level selector — only shown if artist is level 2+ */}
                  {levelInfo.currentLevel > 1 && (
                    <div className="mb-3">
                      <label htmlFor="campaign-level" className="text-gray-400 text-xs uppercase tracking-wider font-medium">
                        Campaign Level
                      </label>
                      <select
                        id="campaign-level"
                        value={campaignLevel}
                        onChange={(e) => setCampaignLevel(Number(e.target.value))}
                        className={inputClass + ' mt-1'}
                      >
                        {Array.from({ length: levelInfo.currentLevel }, (_, i) => i + 1).map((lvl) => (
                          <option key={lvl} value={lvl}>
                            Level {lvl} — {lvl * 10} tickets
                            {lvl === levelInfo.currentLevel ? ' (current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-noir-800 rounded-lg p-2 text-center">
                      <div className="text-warm-50 font-semibold">${(levelInfo.discountCents / 100).toFixed(0)}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Local Fan Price</div>
                    </div>
                    <div className="bg-noir-800 rounded-lg p-2 text-center">
                      <div className="text-warm-50 font-semibold">{ticketCount}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Tickets</div>
                    </div>
                    <div className="bg-noir-800 rounded-lg p-2 text-center">
                      <div className="text-amber-400 font-semibold">${(goalCents / 100).toFixed(0)}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Goal</div>
                    </div>
                  </div>

                  <p className="text-gray-500 text-xs font-body">
                    When global fans donate a total of ${(goalCents / 100).toFixed(0)}, {ticketCount} discounted tickets unlock for verified local fans at just ${(levelInfo.discountCents / 100).toFixed(0)} each.
                  </p>
                </div>
              );
            })()}

            <div>
              <label htmlFor="campaign-headline" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Headline
              </label>
              <input
                id="campaign-headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                required
                maxLength={200}
                className={inputClass}
                placeholder="e.g. Don't miss our biggest show of the year!"
              />
            </div>

            <div>
              <label htmlFor="campaign-message" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Message
              </label>
              <textarea
                id="campaign-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                rows={4}
                className={inputClass}
                placeholder="Tell fans why they should come to your show..."
              />
              <p className="text-gray-600 text-xs mt-1 text-right font-body">{message.length}/2000</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-3">
                Publish
              </label>
              <div className="flex gap-3">
                {([
                  { value: 'ACTIVE', label: 'Go Live Now', desc: 'Visible to fans immediately' },
                  { value: 'DRAFT', label: 'Save as Draft', desc: 'Publish later' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex-1 p-3 border rounded-lg text-center transition-colors ${
                      status === opt.value
                        ? 'border-amber-500 bg-amber-500/5 text-warm-50'
                        : 'border-noir-700 bg-noir-800 text-gray-400 hover:border-noir-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || events.length === 0}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Creating...' : status === 'ACTIVE' ? 'Launch Campaign' : 'Save Draft'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
