import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('FAN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, role);
      navigate(role === 'ARTIST' ? '/artist/dashboard' : '/events');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">I am a...</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'FAN', label: 'Fan', desc: 'Support artists worldwide' },
              { value: 'LOCAL_FAN', label: 'Local Fan', desc: 'Enter local raffles' },
              { value: 'ARTIST', label: 'Artist', desc: 'List your events' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`p-3 border rounded-lg text-center text-sm ${
                  role === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
