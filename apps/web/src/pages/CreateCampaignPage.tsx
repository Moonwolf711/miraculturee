import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

interface ArtistEvent {
  id: string;
  title: string;
  venueName: string;
  date: string;
}

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ArtistEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ upcomingEvents: ArtistEvent[] }>('/artist/dashboard')
      .then((d) => {
        setEvents(d.upcomingEvents);
        if (d.upcomingEvents.length > 0) setEventId(d.upcomingEvents[0].id);
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
      });
      // If they want it active immediately, update status
      if (status === 'ACTIVE') {
        await api.put(`/artist/campaigns/${campaign.id}`, { status: 'ACTIVE' });
      }
      navigate('/artist/dashboard');
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
