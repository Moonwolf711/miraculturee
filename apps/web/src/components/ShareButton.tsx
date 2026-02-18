import { useState } from 'react';
import { api } from '../lib/api.js';

interface ShareButtonProps {
  eventId: string;
  artistName: string;
  eventTitle: string;
  variant?: 'full' | 'icon';
}

async function getShareUrl(eventId: string, platform: string): Promise<string> {
  try {
    const res = await api.post<{ shareUrl: string }>('/share/create', { eventId, platform });
    return res.shareUrl;
  } catch {
    return window.location.href;
  }
}

export default function ShareButton({ eventId, artistName, eventTitle, variant = 'full' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareText = `Hey ${artistName}, your fans want you on MiraCulture! Activate a campaign so we can get fair tickets to "${eventTitle}"`;

  const showCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    setLoading(true);
    try {
      const url = await getShareUrl(eventId, 'copy');
      await navigator.clipboard.writeText(url);
      showCopied();
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (platform: 'twitter' | 'facebook' | 'tiktok' | 'instagram') => {
    // For platforms that open a popup, open the window SYNCHRONOUSLY
    // to avoid popup blockers, then set the URL after the async call.
    if (platform === 'twitter' || platform === 'facebook') {
      const popup = window.open('about:blank', '_blank');
      setLoading(true);
      getShareUrl(eventId, platform).then((url) => {
        const text = `${shareText} ${url}`;
        if (platform === 'twitter') {
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
          if (popup) {
            popup.location.href = twitterUrl;
          } else {
            window.location.href = twitterUrl;
          }
        } else {
          const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;
          if (popup) {
            popup.location.href = fbUrl;
          } else {
            window.location.href = fbUrl;
          }
        }
      }).finally(() => setLoading(false));
      return;
    }

    // Instagram & TikTok: copy text to clipboard (no web share intent)
    setLoading(true);
    getShareUrl(eventId, platform).then(async (url) => {
      const text = `${shareText} ${url}`;
      await navigator.clipboard.writeText(text);
      showCopied();
    }).finally(() => setLoading(false));
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyLink(); }}
        disabled={loading}
        title="Share event"
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

  const btnBase = "flex items-center justify-center gap-2 px-3 py-2.5 font-medium rounded-lg transition-colors text-sm disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {/* Instagram */}
      <button
        onClick={() => handleShare('instagram')}
        disabled={loading}
        className={`${btnBase} flex-1 min-w-[100px] bg-gradient-to-r from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 hover:from-[#833AB4]/25 hover:via-[#E1306C]/25 hover:to-[#F77737]/25 text-[#E1306C] border border-[#E1306C]/20`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
        {copied ? 'Copied!' : 'Instagram'}
      </button>

      {/* Facebook */}
      <button
        onClick={() => handleShare('facebook')}
        disabled={loading}
        className={`${btnBase} flex-1 min-w-[100px] bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/20`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        Facebook
      </button>

      {/* TikTok */}
      <button
        onClick={() => handleShare('tiktok')}
        disabled={loading}
        className={`${btnBase} flex-1 min-w-[100px] bg-noir-700 hover:bg-noir-600 text-warm-50 border border-noir-600`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.44V13.2a8.16 8.16 0 004.77 1.53v-3.4a4.85 4.85 0 01-.8-.08 4.83 4.83 0 01-2.39-1.06V6.69h4z" />
        </svg>
        {copied ? 'Copied!' : 'TikTok'}
      </button>

      {/* X / Twitter */}
      <button
        onClick={() => handleShare('twitter')}
        disabled={loading}
        className={`${btnBase} flex-1 min-w-[100px] bg-noir-700 hover:bg-noir-600 text-warm-50 border border-noir-600`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </button>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        disabled={loading}
        className={`${btnBase} flex-1 min-w-[100px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20`}
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
    </div>
  );
}
