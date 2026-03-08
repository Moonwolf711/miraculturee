import { Link } from 'react-router-dom';
import type { CampaignItem } from './types.js';
import { formatDate } from './types.js';
import { EmptyState, LoadingList } from './UpcomingTickets.js';

interface CampaignsTabProps {
  campaigns: CampaignItem[];
  loading: boolean;
  copiedId: string | null;
  onShareTwitter: (c: CampaignItem) => void;
  onShareFacebook: (c: CampaignItem) => void;
  onCopyShareText: (c: CampaignItem) => void;
  onSocialShare: (c: CampaignItem, platform: string) => void;
}

export default function CampaignsTab({
  campaigns,
  loading,
  copiedId,
  onShareTwitter,
  onShareFacebook,
  onCopyShareText,
  onSocialShare,
}: CampaignsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-400 text-sm">Create campaigns for your events and share them on social media.</p>
        <Link
          to="/artist/campaigns/new"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors flex-shrink-0"
        >
          New Campaign
        </Link>
      </div>

      {loading ? (
        <LoadingList />
      ) : campaigns.length > 0 ? (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-noir-900 border border-noir-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-warm-50 font-medium">{c.headline}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {c.eventTitle} &middot; {formatDate(c.eventDate)}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${
                  c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : c.status === 'DRAFT' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      : 'bg-noir-700 text-gray-500 border border-noir-600'
                }`}>
                  {c.status}
                </span>
              </div>

              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{c.message}</p>

              {c.goalCents > 0 && (
                <div className="mb-4 p-3 bg-noir-950 rounded-lg border border-noir-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-gray-400">
                      ${(c.fundedCents / 100).toFixed(0)} of ${(c.goalCents / 100).toFixed(0)} goal
                    </span>
                    {c.goalReached ? (
                      <span className="text-green-400 font-semibold">Goal Reached!</span>
                    ) : (
                      <span className="text-gray-500">{Math.min(100, Math.round((c.fundedCents / c.goalCents) * 100))}%</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-noir-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${c.goalReached ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (c.fundedCents / c.goalCents) * 100)}%` }}
                    />
                  </div>
                  {c.bonusCents > 0 && (
                    <p className="text-amber-400 text-xs mt-2 font-medium">
                      Bonus earned: ${(c.bonusCents / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-noir-800">
                <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">Share:</span>
                <button onClick={() => onShareTwitter(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Share on X (Twitter)">X</button>
                <button onClick={() => onShareFacebook(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Share on Facebook">FB</button>
                <button
                  onClick={() => onSocialShare(c, 'instagram.com')}
                  className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                  title="Open Instagram (copies text to clipboard)"
                >
                  {copiedId === c.id + '-ig' ? 'Copied!' : 'IG'}
                </button>
                <button
                  onClick={() => onSocialShare(c, 'tiktok.com')}
                  className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                  title="Open TikTok (copies text to clipboard)"
                >
                  {copiedId === c.id + '-tt' ? 'Copied!' : 'TT'}
                </button>
                <button onClick={() => onCopyShareText(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Copy campaign text to clipboard">
                  {copiedId === c.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          message="No campaigns yet. Create one to promote your shows on social media."
          ctaText="Create Campaign"
          ctaLink="/artist/campaigns/new"
        />
      )}
    </div>
  );
}
