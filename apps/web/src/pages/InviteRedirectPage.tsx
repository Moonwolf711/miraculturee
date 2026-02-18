import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function InviteRedirectPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/events', { replace: true });
      return;
    }

    api
      .get<{ eventId: string }>(`/share/${token}`)
      .then((res) => {
        navigate(`/events/${res.eventId}`, { replace: true });
      })
      .catch(() => {
        setError('This share link is invalid or has expired.');
      });
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-noir-950 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-400 font-body text-sm mb-4">{error}</p>
        <a
          href="/events"
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm"
        >
          Browse Events
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
