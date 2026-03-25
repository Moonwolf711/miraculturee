import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington DC',
};

const US_STATE_CODES = Object.keys(US_STATES);

const GENRE_OPTIONS = [
  'EDM', 'Rap', 'Hip-Hop', 'R&B', 'Rock', 'Pop', 'Country', 'Jazz', 'Latin',
  'Reggae', 'Metal', 'Indie', 'Folk', 'Blues', 'Soul', 'Funk', 'Classical',
  'Afrobeats', 'World',
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'shows', label: 'Most Shows' },
  { value: 'popular', label: 'Most Popular' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalArtistCard {
  id: string;
  stageName: string;
  city: string;
  state: string;
  professionalType: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  genres: string[];
  instruments: string[];
  totalShows: number;
  totalTicketsSold: number;
  availableForBooking: boolean;
  verificationStatus: string;
  socialLinks: {
    instagram?: string; twitter?: string; tiktok?: string;
    spotify?: string; soundcloud?: string; youtube?: string; website?: string;
  } | null;
  followerCounts: {
    instagram?: number; tiktok?: number; spotify?: number; soundcloud?: number;
  } | null;
  bookingEmail: string | null;
  bookingRate: string | null;
  externalEpkUrl: string | null;
  yearsActive: number | null;
  releases: {
    id: string; title: string; type: string;
    platform: string | null; url: string | null; releaseDate: string | null;
  }[];
  shows: {
    id: string; venueName: string; venueCity: string | null;
    eventTitle: string | null; date: string | null; role: string | null;
    ticketsSold: number | null; totalAttendance: number | null;
  }[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BookingRequestModal({
  artist, onClose,
}: {
  artist: LocalArtistCard; onClose: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', eventTitle: '', eventDate: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!form.name || !form.email) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/local-artists/${artist.id}/booking-request`, {
        requesterName: form.name,
        requesterEmail: form.email,
        eventTitle: form.eventTitle || undefined,
        eventDate: form.eventDate || undefined,
        message: form.message || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-warm-50 font-semibold mb-1">Request Sent!</h3>
          <p className="text-gray-400 text-sm mb-4">Your booking request has been sent to {artist.stageName}.</p>
          <button onClick={onClose} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-warm-50 text-lg font-semibold mb-4">Send Booking Request to {artist.stageName}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Your Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Your Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Event Title</label>
                <input type="text" value={form.eventTitle} onChange={(e) => setForm((p) => ({ ...p, eventTitle: e.target.value }))}
                  className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Event Date</label>
                <input type="date" value={form.eventDate} onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))}
                  className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Message</label>
              <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                rows={3} placeholder="Tell the artist about your event..."
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600 resize-none" />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">Cancel</button>
            <button onClick={handleSend} disabled={sending || !form.name || !form.email}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50">
              {sending ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LocalArtistMarketplacePage() {
  const [artists, setArtists] = useState<LocalArtistCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedArtist, setSelectedArtist] = useState<LocalArtistCard | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Filters
  const [citySearch, setCitySearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [bookableOnly, setBookableOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (citySearch.trim()) params.set('city', citySearch.trim());
    if (stateFilter) params.set('state', stateFilter);
    if (genreFilter.length > 0) params.set('genre', genreFilter.join(','));
    if (bookableOnly) params.set('available', 'true');
    if (sortBy) params.set('sort', sortBy);

    api.get<{ artists: LocalArtistCard[]; total: number }>(`/local-artists?${params}`)
      .then((data) => { setArtists(data.artists); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [citySearch, stateFilter, genreFilter, bookableOnly, sortBy]);

  // Fetch full artist detail when selected
  const handleSelectArtist = async (artist: LocalArtistCard) => {
    try {
      const full = await api.get<LocalArtistCard>(`/local-artists/${artist.id}`);
      setSelectedArtist(full);
    } catch {
      setSelectedArtist(artist);
    }
  };

  const toggleGenre = (genre: string) => {
    setGenreFilter((prev) => prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]);
  };

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <SEO title="Local Artists" description="Discover local artists in your area on MiraCulture." />
      <div className="max-w-6xl mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display tracking-wider text-warm-50 mb-2">LOCAL ARTIST MARKETPLACE</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Discover talented local artists for your next event. Browse EPKs, listen to releases, and send booking requests directly.
          </p>
          <Link to="/local-artists/register"
            className="inline-block mt-4 px-6 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors">
            Create Your EPK
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* City search */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-gray-500 text-xs mb-1">City</label>
              <input type="text" value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Search city..."
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
            </div>

            {/* State */}
            <div className="min-w-[120px]">
              <label className="block text-gray-500 text-xs mb-1">State</label>
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50">
                <option value="">All States</option>
                {US_STATE_CODES.map((s) => <option key={s} value={s}>{US_STATES[s]}</option>)}
              </select>
            </div>

            {/* Genre multi-select */}
            <div className="relative min-w-[140px]">
              <label className="block text-gray-500 text-xs mb-1">Genres</label>
              <button onClick={() => setShowGenreDropdown(!showGenreDropdown)}
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between">
                <span className={genreFilter.length > 0 ? 'text-amber-400' : 'text-gray-600'}>
                  {genreFilter.length > 0 ? `${genreFilter.length} selected` : 'Any genre'}
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showGenreDropdown && (
                <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-y-auto bg-noir-800 border border-noir-600 rounded-lg shadow-xl">
                  {GENRE_OPTIONS.map((g) => (
                    <button key={g} onClick={() => toggleGenre(g)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                        genreFilter.includes(g) ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-noir-700'
                      }`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                        genreFilter.includes(g) ? 'border-amber-500 bg-amber-500/20' : 'border-noir-600'
                      }`}>
                        {genreFilter.includes(g) && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </span>
                      {g}
                    </button>
                  ))}
                  {genreFilter.length > 0 && (
                    <button onClick={() => setGenreFilter([])}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-noir-700 border-t border-noir-600">Clear all</button>
                  )}
                </div>
              )}
            </div>

            {/* Available toggle */}
            <div className="flex items-center gap-2 pb-0.5">
              <button onClick={() => setBookableOnly(!bookableOnly)}
                className={`relative w-9 h-5 rounded-full transition-colors ${bookableOnly ? 'bg-green-500' : 'bg-noir-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bookableOnly ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-gray-400 text-xs whitespace-nowrap">Bookable</span>
            </div>

            {/* Sort */}
            <div className="min-w-[120px]">
              <label className="block text-gray-500 text-xs mb-1">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Active filter pills */}
          {(genreFilter.length > 0 || bookableOnly || stateFilter || citySearch) && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-noir-700/50">
              {genreFilter.map((g) => (
                <span key={g} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-xs">
                  {g}
                  <button onClick={() => toggleGenre(g)} className="hover:text-amber-200">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              {bookableOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs">
                  Available
                  <button onClick={() => setBookableOnly(false)} className="hover:text-green-200">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              <button onClick={() => { setGenreFilter([]); setBookableOnly(false); setStateFilter(''); setCitySearch(''); }}
                className="text-gray-500 text-xs hover:text-gray-300">Clear all</button>
            </div>
          )}
        </div>

        {/* Artist grid */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading artists...</div>
        ) : artists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">No artists found</p>
            <p className="text-gray-600 text-sm">Be the first -- <Link to="/local-artists/register" className="text-amber-400 hover:underline">create your EPK</Link></p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">{total} artist{total !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {artists.map((artist) => (
                <button key={artist.id}
                  onClick={() => handleSelectArtist(artist)}
                  className="text-left bg-noir-900 border border-noir-700/50 rounded-xl hover:border-amber-500/30 transition-all duration-300 group">
                  {/* Banner */}
                  <div className="relative h-28 rounded-t-xl overflow-hidden">
                    {artist.bannerImageUrl ? (
                      <img src={artist.bannerImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900 group-hover:scale-105 transition-transform duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-noir-900 via-noir-900/40 to-transparent" />
                  </div>
                  {/* Content */}
                  <div className="px-4 pb-4">
                    <div className="-mt-8 mb-2 relative z-10">
                      <div className="w-16 h-16 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0 border-[3px] border-noir-900 overflow-hidden">
                        {artist.profileImageUrl ? (
                          <img src={artist.profileImageUrl} alt={artist.stageName} className="w-full h-full rounded-full object-cover" />
                        ) : artist.stageName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="text-warm-50 font-semibold truncate">{artist.stageName}</h3>
                      {artist.verificationStatus === 'APPROVED' && (
                        <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      )}
                      {artist.availableForBooking && (
                        <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded text-[9px]">Available</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mb-1">{artist.city}, {US_STATES[artist.state] || artist.state}</p>
                    {artist.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {artist.genres.slice(0, 3).map((g) => (
                          <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-[10px]">{g}</span>
                        ))}
                        {artist.genres.length > 3 && <span className="text-gray-600 text-[10px] self-center">+{artist.genres.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-noir-700/50 text-xs text-gray-500">
                    <span>{artist.totalShows} show{artist.totalShows !== 1 ? 's' : ''}</span>
                    {artist.professionalType && <span className="text-amber-400/70">{artist.professionalType}</span>}
                    {artist.yearsActive !== null && artist.yearsActive > 0 && <span>{artist.yearsActive} yrs</span>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ============== ARTIST DETAIL MODAL ============== */}
        {selectedArtist && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedArtist(null)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Banner */}
              <div className="relative h-36 rounded-t-2xl overflow-hidden">
                {selectedArtist.bannerImageUrl ? (
                  <img src={selectedArtist.bannerImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-noir-900 via-noir-900/30 to-transparent" />
                <button onClick={() => setSelectedArtist(null)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-gray-300 hover:bg-black/70 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-6 pb-6">
                {/* Avatar */}
                <div className="-mt-10 mb-3 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-2xl font-bold shrink-0 border-4 border-noir-900 overflow-hidden">
                    {selectedArtist.profileImageUrl ? (
                      <img src={selectedArtist.profileImageUrl} alt={selectedArtist.stageName} className="w-full h-full rounded-full object-cover" />
                    ) : selectedArtist.stageName.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Name + badges */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-warm-50 text-xl font-semibold">{selectedArtist.stageName}</h2>
                    {selectedArtist.verificationStatus === 'APPROVED' && (
                      <svg className="w-5 h-5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                    {selectedArtist.availableForBooking && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs">Available for Booking</span>
                    )}
                  </div>
                  {selectedArtist.professionalType && <p className="text-amber-400/70 text-sm mt-0.5">{selectedArtist.professionalType}</p>}
                </div>

                {/* Location + meta */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                  <span>{selectedArtist.city}, {US_STATES[selectedArtist.state] || selectedArtist.state}</span>
                  {selectedArtist.yearsActive !== null && selectedArtist.yearsActive > 0 && <span>{selectedArtist.yearsActive} yrs active</span>}
                  <span>{selectedArtist.totalShows} show{selectedArtist.totalShows !== 1 ? 's' : ''}</span>
                  {selectedArtist.totalTicketsSold > 0 && <span>{selectedArtist.totalTicketsSold.toLocaleString()} tickets sold</span>}
                </div>

                {/* Bio */}
                {selectedArtist.bio && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">About</h3>
                    <p className="text-gray-400 text-sm">{selectedArtist.bio}</p>
                  </div>
                )}

                {/* Genres */}
                {selectedArtist.genres.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Genres</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedArtist.genres.map((g) => <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-xs">{g}</span>)}
                    </div>
                  </div>
                )}

                {/* Instruments */}
                {selectedArtist.instruments.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Instruments / Tools</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedArtist.instruments.map((i) => <span key={i} className="px-2 py-0.5 bg-noir-800 text-gray-300 rounded-full text-xs">{i}</span>)}
                    </div>
                  </div>
                )}

                {/* Releases */}
                {selectedArtist.releases && selectedArtist.releases.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Releases</h3>
                    <div className="space-y-2">
                      {selectedArtist.releases.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-noir-800 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-warm-50 text-sm">{r.title}</p>
                            <p className="text-gray-500 text-xs">{r.type}{r.releaseDate ? ` - ${r.releaseDate}` : ''}{r.platform ? ` on ${r.platform}` : ''}</p>
                          </div>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              className="text-amber-400 text-xs hover:underline shrink-0">Listen</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Shows */}
                {selectedArtist.shows && selectedArtist.shows.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Past Shows</h3>
                    <div className="space-y-1">
                      {selectedArtist.shows.slice(0, 5).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-sm">
                          <span className="text-warm-50">{s.venueName}</span>
                          {s.venueCity && <span className="text-gray-600">{s.venueCity}</span>}
                          {s.role && <span className="text-amber-400/70 text-xs">{s.role}</span>}
                          {s.date && <span className="text-gray-600 text-xs">{s.date}</span>}
                        </div>
                      ))}
                      {selectedArtist.shows.length > 5 && (
                        <p className="text-gray-500 text-xs">+{selectedArtist.shows.length - 5} more shows</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Social links with follower counts */}
                {selectedArtist.socialLinks && Object.values(selectedArtist.socialLinks).some(Boolean) && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Social Links</h3>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {selectedArtist.socialLinks.instagram && (
                        <a href={`https://instagram.com/${selectedArtist.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                          Instagram{selectedArtist.followerCounts?.instagram ? ` (${selectedArtist.followerCounts.instagram.toLocaleString()})` : ''}
                        </a>
                      )}
                      {selectedArtist.socialLinks.twitter && (
                        <a href={`https://twitter.com/${selectedArtist.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Twitter</a>
                      )}
                      {selectedArtist.socialLinks.tiktok && (
                        <a href={`https://tiktok.com/@${selectedArtist.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                          TikTok{selectedArtist.followerCounts?.tiktok ? ` (${selectedArtist.followerCounts.tiktok.toLocaleString()})` : ''}
                        </a>
                      )}
                      {selectedArtist.socialLinks.spotify && (
                        <a href={selectedArtist.socialLinks.spotify} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                          Spotify{selectedArtist.followerCounts?.spotify ? ` (${selectedArtist.followerCounts.spotify.toLocaleString()})` : ''}
                        </a>
                      )}
                      {selectedArtist.socialLinks.soundcloud && (
                        <a href={`https://soundcloud.com/${selectedArtist.socialLinks.soundcloud}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                          SoundCloud{selectedArtist.followerCounts?.soundcloud ? ` (${selectedArtist.followerCounts.soundcloud.toLocaleString()})` : ''}
                        </a>
                      )}
                      {selectedArtist.socialLinks.youtube && (
                        <a href={`https://youtube.com/${selectedArtist.socialLinks.youtube}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">YouTube</a>
                      )}
                      {selectedArtist.socialLinks.website && (
                        <a href={selectedArtist.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Website</a>
                      )}
                    </div>
                  </div>
                )}

                {/* Booking info */}
                {(selectedArtist.bookingEmail || selectedArtist.bookingRate) && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">Booking</h3>
                    <div className="text-sm text-gray-400 space-y-0.5">
                      {selectedArtist.bookingRate && <p>Rate: {selectedArtist.bookingRate}</p>}
                      {selectedArtist.bookingEmail && <p>Contact: {selectedArtist.bookingEmail}</p>}
                    </div>
                  </div>
                )}

                {/* External EPK */}
                {selectedArtist.externalEpkUrl && (
                  <div className="mb-4">
                    <a href={selectedArtist.externalEpkUrl} target="_blank" rel="noopener noreferrer"
                      className="text-amber-400 text-sm hover:underline">View Full EPK</a>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setSelectedArtist(null)}
                    className="flex-1 px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">Close</button>
                  {selectedArtist.availableForBooking && (
                    <button onClick={() => setShowBookingModal(true)}
                      className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors">
                      Send Booking Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Booking request modal */}
        {showBookingModal && selectedArtist && (
          <BookingRequestModal artist={selectedArtist} onClose={() => setShowBookingModal(false)} />
        )}
      </div>
    </div>
  );
}
