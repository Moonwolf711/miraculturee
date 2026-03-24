import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

interface AgentProfile {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  state: string;
  city: string;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  yearsExperience: number | null;
  promoterType: string | null;
  genres: string[];
  skills: string[];
  venueExperience: string | null;
  promotionHistory: string | null;
  socialLinks: { instagram?: string; twitter?: string; tiktok?: string; website?: string } | null;
  totalCampaigns: number;
  rating: number | null;
  ratingCount: number;
  verificationStatus: string;
  profileStrength: number;
  createdAt: string;
}

interface StateCount {
  state: string;
  agentCount: number;
}

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

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-600 text-xs">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-4 h-4 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-gray-400 text-xs ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function AgentMarketplacePage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [states, setStates] = useState<StateCount[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);

  useEffect(() => {
    api.get<StateCount[]>('/agents/states').then(setStates).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedState) params.set('state', selectedState);
    api.get<{ agents: AgentProfile[]; total: number }>(`/agents?${params}`)
      .then((data) => {
        setAgents(data.agents);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedState]);

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display tracking-wider text-warm-50 mb-2">
            PROMOTER AGENT MARKETPLACE
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Find a verified local promoter to run your campaign. Agents know the local scene,
            have venue connections, and earn 50% of campaign proceeds for their work.
          </p>
          <Link
            to="/agents/register"
            className="inline-block mt-4 px-6 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors"
          >
            Become an Agent
          </Link>
        </div>

        {/* State filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setSelectedState('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !selectedState
                  ? 'bg-amber-500 text-noir-950'
                  : 'bg-noir-800 text-gray-400 hover:bg-noir-700'
              }`}
            >
              All States ({states.reduce((s, c) => s + c.agentCount, 0)})
            </button>
            {states.map((s) => (
              <button
                key={s.state}
                onClick={() => setSelectedState(s.state)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedState === s.state
                    ? 'bg-amber-500 text-noir-950'
                    : 'bg-noir-800 text-gray-400 hover:bg-noir-700'
                }`}
              >
                {s.state} ({s.agentCount})
              </button>
            ))}
          </div>
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">No agents found{selectedState ? ` in ${US_STATES[selectedState] || selectedState}` : ''}</p>
            <p className="text-gray-600 text-sm">Be the first — <Link to="/agents/register" className="text-amber-400 hover:underline">apply to become an agent</Link></p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">{total} agent{total !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="text-left bg-noir-900 border border-noir-700/50 rounded-xl hover:border-amber-500/30 transition-all duration-300 group"
                >
                  {/* Banner */}
                  <div className="relative h-28 rounded-t-xl overflow-hidden">
                    {agent.bannerImageUrl ? (
                      <img
                        src={agent.bannerImageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900 group-hover:scale-105 transition-transform duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-noir-900 via-noir-900/40 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="px-4 pb-4">
                    {/* Avatar overlapping banner */}
                    <div className="-mt-8 mb-2 relative z-10">
                      <div className="w-16 h-16 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0 border-[3px] border-noir-900 overflow-hidden">
                        {agent.profileImageUrl ? (
                          <img src={agent.profileImageUrl} alt={agent.displayName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          agent.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>

                    {/* Name + verification */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="text-warm-50 font-semibold truncate">{agent.displayName}</h3>
                      {agent.verificationStatus === 'APPROVED' && (
                        <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      )}
                    </div>

                    {/* Headline */}
                    {agent.headline && (
                      <p className="text-gray-400 text-xs truncate mb-1">{agent.headline}</p>
                    )}

                    {/* Location */}
                    <p className="text-gray-500 text-xs mb-1.5">{agent.city}, {US_STATES[agent.state] || agent.state}</p>

                    {/* Rating */}
                    <div className="mb-2">
                      <StarRating rating={agent.rating} />
                    </div>

                    {/* Genre pills */}
                    {agent.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.genres.slice(0, 3).map((g) => (
                          <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-[10px]">{g}</span>
                        ))}
                        {agent.genres.length > 3 && <span className="text-gray-600 text-[10px] self-center">+{agent.genres.length - 3}</span>}
                      </div>
                    )}
                  </div>

                  {/* Stats footer */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-noir-700/50 text-xs text-gray-500">
                    <span>{agent.totalCampaigns} campaign{agent.totalCampaigns !== 1 ? 's' : ''}</span>
                    {agent.promoterType && <span className="text-amber-400/70">{agent.promoterType}</span>}
                    {agent.yearsExperience !== null && agent.yearsExperience > 0 && <span>{agent.yearsExperience} yrs exp</span>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Agent detail modal */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAgent(null)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Banner */}
              <div className="relative h-36 rounded-t-2xl overflow-hidden">
                {selectedAgent.bannerImageUrl ? (
                  <img src={selectedAgent.bannerImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-noir-900 via-noir-900/30 to-transparent" />
                {/* Close button on banner */}
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-gray-300 hover:bg-black/70 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-6 pb-6">
                {/* Avatar overlapping banner */}
                <div className="-mt-10 mb-3 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-2xl font-bold shrink-0 border-4 border-noir-900 overflow-hidden">
                    {selectedAgent.profileImageUrl ? (
                      <img src={selectedAgent.profileImageUrl} alt={selectedAgent.displayName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      selectedAgent.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                {/* Name + verification + headline */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-warm-50 text-xl font-semibold">{selectedAgent.displayName}</h2>
                    {selectedAgent.verificationStatus === 'APPROVED' && (
                      <svg className="w-5 h-5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  {selectedAgent.headline && <p className="text-gray-400 text-sm mt-0.5">{selectedAgent.headline}</p>}
                </div>

                {/* Location + meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                  <span>{selectedAgent.city}, {US_STATES[selectedAgent.state] || selectedAgent.state}</span>
                  {selectedAgent.yearsExperience !== null && selectedAgent.yearsExperience > 0 && (
                    <span>{selectedAgent.yearsExperience} yrs experience</span>
                  )}
                  {selectedAgent.promoterType && (
                    <span className="text-amber-400/70">{selectedAgent.promoterType}</span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <StarRating rating={selectedAgent.rating} />
                  {selectedAgent.ratingCount > 0 && <span className="text-gray-600 text-xs">({selectedAgent.ratingCount})</span>}
                </div>

                {/* Quick stats */}
                <div className="flex gap-3 mb-5">
                  {selectedAgent.promoterType && (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{selectedAgent.promoterType}</span>
                  )}
                  {selectedAgent.yearsExperience !== null && selectedAgent.yearsExperience > 0 && (
                    <span className="px-2 py-0.5 bg-noir-800 text-gray-400 rounded text-xs">{selectedAgent.yearsExperience} yrs exp</span>
                  )}
                  <span className="px-2 py-0.5 bg-noir-800 text-gray-400 rounded text-xs">{selectedAgent.totalCampaigns} campaigns</span>
                </div>

                {selectedAgent.bio && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">About</h3>
                    <p className="text-gray-400 text-sm">{selectedAgent.bio}</p>
                  </div>
                )}

                {selectedAgent.genres.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Genres</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.genres.map((g) => <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-xs">{g}</span>)}
                    </div>
                  </div>
                )}

                {selectedAgent.skills.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs">{s}</span>)}
                    </div>
                  </div>
                )}

                {selectedAgent.socialLinks && Object.values(selectedAgent.socialLinks).some(Boolean) && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">Links</h3>
                    <div className="flex gap-3 text-sm">
                      {selectedAgent.socialLinks.instagram && (
                        <a href={`https://instagram.com/${selectedAgent.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Instagram</a>
                      )}
                      {selectedAgent.socialLinks.twitter && (
                        <a href={`https://twitter.com/${selectedAgent.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Twitter</a>
                      )}
                      {selectedAgent.socialLinks.tiktok && (
                        <a href={`https://tiktok.com/@${selectedAgent.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">TikTok</a>
                      )}
                      {selectedAgent.socialLinks.website && (
                        <a href={selectedAgent.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Website</a>
                      )}
                    </div>
                  </div>
                )}

                {selectedAgent.venueExperience && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">Venue Experience</h3>
                    <p className="text-gray-400 text-sm">{selectedAgent.venueExperience}</p>
                  </div>
                )}

                {selectedAgent.promotionHistory && (
                  <div className="mb-4">
                    <h3 className="text-gray-300 text-sm font-medium mb-1">Promotion History</h3>
                    <p className="text-gray-400 text-sm">{selectedAgent.promotionHistory}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="flex-1 px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
