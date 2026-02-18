import { useState } from 'react';
import { api } from '../lib/api.js';

interface ShareButtonProps {
  eventId: string;
  artistName: string;
  eventTitle: string;
  variant?: 'full' | 'icon';
}

export default function ShareButton({ eventId, artistName, eventTitle, variant = 'full' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCopyLink = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ shareUrl: string }>('/share/create', {
        eventId,
        platform: 'copy',
      });
      await navigator.clipboard.writeText(res.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy current URL
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterShare = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ shareUrl: string }>('/share/create', {
        eventId,
        platform: 'twitter',
      });
      const text = `Hey @${artistName}, your fans want you on @MiraCulture! Activate a campaign so we can get fair tickets to your show "${eventTitle}" ${res.shareUrl}`;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      // Fallback
      const text = `Hey ${artistName}, your fans want you on MiraCulture! ${window.location.href}`;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyLink(); }}
        disabled={loading}
        title="Share with artist"
        className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors disabled:opacity-50"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleCopyLink}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-noir-700 hover:bg-noir-600 text-gray-200 font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
            </svg>
            Copy Link
          </>
        )}
      </button>
      <button
        onClick={handleTwitterShare}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] font-medium rounded-lg transition-colors text-sm border border-[#1DA1F2]/20 disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share on X
      </button>
    </div>
  );
}
