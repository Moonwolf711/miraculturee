import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import type { Recommendation, TopGenre, SimilarFan } from './types.js';

export default function ForYouTab() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [genres, setGenres] = useState<TopGenre[]>([]);
  const [similarFans, setSimilarFans] = useState<SimilarFan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<{ recommendations: Recommendation[] }>('/preferences/recommendations?limit=10')
        .then(r => setRecommendations(r.recommendations))
        .catch(() => {}),
      api.get<{ genres: TopGenre[] }>('/preferences/genres')
        .then(r => setGenres(r.genres))
        .catch(() => {}),
      api.get<{ similarFans: SimilarFan[] }>('/preferences/similar-fans?limit=5')
        .then(r => setSimilarFans(r.similarFans))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<{ synced: number; message: string }>('/preferences/sync');
      setSyncResult(res.message);
      // Refresh data
      const [recs, g, fans] = await Promise.all([
        api.get<{ recommendations: Recommendation[] }>('/preferences/recommendations?limit=10'),
        api.get<{ genres: TopGenre[] }>('/preferences/genres'),
        api.get<{ similarFans: SimilarFan[] }>('/preferences/similar-fans?limit=5'),
      ]);
      setRecommendations(recs.recommendations);
      setGenres(g.genres);
      setSimilarFans(fans.similarFans);
    } catch {
      setSyncResult('Failed to sync preferences');
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-noir-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const isEmpty = recommendations.length === 0 && genres.length === 0;

  return (
    <div className="space-y-8">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-warm-50">Personalized For You</h2>
          <p className="text-sm text-gray-500 mt-1">Based on your support history and activity</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-all disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Refresh Preferences'}
        </button>
      </div>

      {syncResult && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
          {syncResult}
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-16 bg-noir-900 rounded-xl border border-noir-800">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h3 className="text-warm-50 font-medium mb-2">No preferences yet</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Support artists and enter raffles to build your taste profile. We'll recommend shows you'll love.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-2.5 bg-amber-500 text-noir-950 rounded-lg font-medium hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync My History'}
          </button>
        </div>
      ) : (
        <>
          {/* Top Genres */}
          {genres.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Your Top Genres</h3>
              <div className="flex flex-wrap gap-2">
                {genres.map(g => (
                  <span
                    key={g.genre}
                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-sm"
                  >
                    {g.genre}
                    <span className="ml-1.5 text-amber-500/60">{g.count}x</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recommended Artists</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 bg-noir-900 border border-noir-800 rounded-lg hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-warm-50 font-medium">{rec.artistName ?? 'Unknown Artist'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {rec.genre && (
                            <span className="text-xs text-gray-500">{rec.genre}</span>
                          )}
                          {rec.venueCity && (
                            <span className="text-xs text-gray-600">{rec.venueCity}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className="h-1.5 rounded-full bg-amber-500"
                          style={{ width: `${Math.round(rec.relevanceScore * 40)}px` }}
                        />
                        <span className="text-xs text-gray-600">{Math.round(rec.relevanceScore * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Fans */}
          {similarFans.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Fans Like You</h3>
              <div className="flex flex-wrap gap-3">
                {similarFans.map(fan => (
                  <div
                    key={fan.id}
                    className="flex items-center gap-2 px-3 py-2 bg-noir-900 border border-noir-800 rounded-lg"
                  >
                    <div className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold">
                      {(fan.name ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-warm-50">{fan.name ?? 'Anonymous'}</p>
                      {fan.city && <p className="text-xs text-gray-500">{fan.city}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
