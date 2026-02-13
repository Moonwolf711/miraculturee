import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';

export default function BecomeArtistPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [stageName, setStageName] = useState('');
  const [genre, setGenre] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/upgrade-to-artist',
        { stageName, genre: genre || undefined, bio: bio || undefined },
      );
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      await refreshUser();
      navigate('/artist/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade account.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600';

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO title="Become an Artist" description="Upgrade your account to list events and run campaigns on MiraCulture." noindex />
      <div className="w-full max-w-lg">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-3xl tracking-wider text-warm-50 text-center mb-2">
            BECOME AN ARTIST
          </h1>
          <p className="text-gray-400 text-sm text-center font-body mb-8">
            Set up your artist profile to list events and promote your shows.
          </p>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="stage-name" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Stage Name *
              </label>
              <input
                id="stage-name"
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                required
                maxLength={100}
                className={inputClass}
                placeholder="Your artist or band name"
              />
            </div>

            <div>
              <label htmlFor="genre" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Genre
              </label>
              <input
                id="genre"
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                maxLength={50}
                className={inputClass}
                placeholder="e.g. Hip-Hop, Rock, Jazz"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                className={inputClass}
                placeholder="Tell fans about yourself..."
              />
              <p className="text-gray-600 text-xs mt-1 text-right font-body">{bio.length}/500</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Setting up...' : 'Create Artist Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
