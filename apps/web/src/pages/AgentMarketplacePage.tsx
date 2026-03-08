import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

interface AgentProfile {
  id: string;
  displayName: string;
  bio: string | null;
  state: string;
  city: string;
  profileImageUrl: string | null;
  venueExperience: string | null;
  promotionHistory: string | null;
  socialLinks: { instagram?: string; twitter?: string; website?: string } | null;
  totalCampaigns: number;
  rating: number | null;
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="text-left bg-noir-900 border border-noir-700/50 rounded-xl p-6 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0">
                      {agent.profileImageUrl ? (
                        <img src={agent.profileImageUrl} alt={agent.displayName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        agent.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-warm-50 font-semibold truncate">{agent.displayName}</h3>
                      <p className="text-gray-500 text-sm">{agent.city}, {US_STATES[agent.state] || agent.state}</p>
                      <StarRating rating={agent.rating} />
                    </div>
                  </div>
                  {agent.bio && (
                    <p className="text-gray-400 text-sm mt-3 line-clamp-2">{agent.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                    <span>{agent.totalCampaigns} campaign{agent.totalCampaigns !== 1 ? 's' : ''}</span>
                    {agent.venueExperience && <span>Venue experience</span>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Agent detail modal */}
        {selectedAgent && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAgent(null)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-2xl font-bold shrink-0">
                  {selectedAgent.profileImageUrl ? (
                    <img src={selectedAgent.profileImageUrl} alt={selectedAgent.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    selectedAgent.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-warm-50 text-xl font-semibold">{selectedAgent.displayName}</h2>
                  <p className="text-gray-400">{selectedAgent.city}, {US_STATES[selectedAgent.state] || selectedAgent.state}</p>
                  <StarRating rating={selectedAgent.rating} />
                </div>
              </div>

              {selectedAgent.bio && (
                <div className="mb-4">
                  <h3 className="text-gray-300 text-sm font-medium mb-1">About</h3>
                  <p className="text-gray-400 text-sm">{selectedAgent.bio}</p>
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

              {selectedAgent.socialLinks && (
                <div className="mb-4">
                  <h3 className="text-gray-300 text-sm font-medium mb-1">Links</h3>
                  <div className="flex gap-3 text-sm">
                    {selectedAgent.socialLinks.instagram && (
                      <a href={`https://instagram.com/${selectedAgent.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Instagram</a>
                    )}
                    {selectedAgent.socialLinks.twitter && (
                      <a href={`https://twitter.com/${selectedAgent.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Twitter</a>
                    )}
                    {selectedAgent.socialLinks.website && (
                      <a href={selectedAgent.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Website</a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                <span>{selectedAgent.totalCampaigns} campaign{selectedAgent.totalCampaigns !== 1 ? 's' : ''} completed</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="flex-1 px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
