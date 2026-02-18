interface SocialAccount {
  id: string;
  provider: string;
  providerUsername: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

interface SocialAccountCardProps {
  account: SocialAccount;
  onDisconnect: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  SPOTIFY: 'Spotify',
  SOUNDCLOUD: 'SoundCloud',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export default function SocialAccountCard({ account, onDisconnect }: SocialAccountCardProps) {
  const label = PROVIDER_LABELS[account.provider] ?? account.provider;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-noir-700 bg-noir-800/50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="font-body text-warm-50 text-sm font-semibold">
            {label}
          </p>
          <p className="font-body text-gray-400 text-xs">
            {account.providerUsername ?? 'Connected'}
            {account.followerCount != null && (
              <span className="ml-2 text-gray-500">
                {account.followerCount.toLocaleString()} followers
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {account.profileUrl && (
          <a
            href={account.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-amber-500 transition-colors text-xs"
          >
            View
          </a>
        )}
        <button
          onClick={onDisconnect}
          className="text-gray-500 hover:text-red-400 transition-colors text-xs"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
