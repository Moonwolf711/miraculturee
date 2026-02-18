const API_URL = import.meta.env.VITE_API_URL || '/api';

const PROVIDER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  spotify: {
    label: 'Spotify',
    color: 'bg-[#1DB954] hover:bg-[#1ed760]',
    icon: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  },
  soundcloud: {
    label: 'SoundCloud',
    color: 'bg-[#FF5500] hover:bg-[#ff6a1a]',
    icon: 'M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .091-.034.104-.094l.194-1.308-.194-1.332c-.013-.06-.047-.094-.104-.094m1.79-1.065c-.067 0-.12.042-.12.114l-.2 2.376.2 2.303c0 .07.053.113.12.113.065 0 .118-.043.118-.113l.227-2.303-.227-2.376c0-.072-.053-.114-.118-.114m.899-.348c-.074 0-.133.054-.14.131l-.179 2.737.179 2.648c.007.074.066.131.14.131.073 0 .132-.057.139-.131l.2-2.648-.2-2.737c-.007-.077-.066-.131-.139-.131m.898-.17c-.082 0-.148.062-.148.146l-.16 2.907.16 2.81c0 .082.066.148.148.148.08 0 .148-.066.148-.148l.18-2.81-.18-2.907c0-.084-.068-.147-.148-.147m1.05-.262c-.093 0-.168.07-.168.163l-.14 3.17.14 3.037c0 .09.075.162.168.162.09 0 .164-.072.164-.162l.156-3.037-.156-3.17c-.004-.094-.074-.163-.164-.163m.899-.24c-.1 0-.183.08-.183.18l-.12 3.41.12 3.28c0 .098.083.18.183.18.098 0 .18-.08.18-.18l.136-3.28-.136-3.41c0-.1-.082-.18-.18-.18m1.05-.32c-.107 0-.197.09-.197.198l-.105 3.722.105 3.45c0 .11.09.2.197.2.108 0 .197-.09.197-.2l.117-3.45-.117-3.722c0-.108-.09-.197-.197-.197m1.049-.32c-.117 0-.213.098-.213.215l-.09 4.04.09 3.593c0 .117.096.215.213.215.118 0 .213-.098.213-.215l.1-3.593-.1-4.04c0-.117-.095-.215-.213-.215m1.047-.08c-.123 0-.225.108-.225.232l-.073 4.119.073 3.624c0 .127.102.232.225.232.122 0 .225-.105.225-.232l.084-3.624-.084-4.119c0-.124-.103-.232-.225-.232m1.05-.112c-.134 0-.243.114-.243.248l-.06 4.233.06 3.616c0 .136.109.248.243.248.133 0 .24-.112.24-.248l.068-3.616-.068-4.233c0-.134-.107-.248-.24-.248m1.05-.06c-.142 0-.258.12-.258.264l-.045 4.293.045 3.58c0 .144.116.264.258.264.14 0 .255-.12.255-.264l.05-3.58-.05-4.293c0-.143-.115-.263-.255-.263m1.044 0c-.15 0-.272.127-.272.28l-.03 4.293.03 3.555c0 .153.122.28.272.28.148 0 .27-.127.27-.28l.032-3.555-.032-4.293c0-.153-.122-.28-.27-.28m1.054-.08c-.155 0-.283.135-.283.296l-.015 4.373.015 3.508c0 .16.128.296.283.296.155 0 .283-.136.283-.296l.016-3.508-.016-4.373c0-.16-.128-.296-.283-.296m1.505-.56c-.262 0-.475.213-.475.475v8.233c0 .265.213.475.475.475h5.463c1.82 0 3.3-1.48 3.3-3.3s-1.48-3.3-3.3-3.3c-.477 0-.928.1-1.342.286-.267-2.608-2.456-4.658-5.135-4.867-.128-.01-.245.1-.245.228v.77z',
  },
};

interface SocialConnectButtonProps {
  provider: 'spotify' | 'soundcloud';
  connected?: boolean;
  onDisconnect?: () => void;
}

export default function SocialConnectButton({ provider, connected, onDisconnect }: SocialConnectButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  const handleConnect = () => {
    // Navigate to backend OAuth initiate endpoint (needs auth cookie/header)
    // We pass the JWT in the URL as a fallback since this is a redirect flow
    const token = localStorage.getItem('accessToken');
    window.location.href = `${API_URL}/auth/${provider}/connect${token ? `?token=${token}` : ''}`;
  };

  if (connected) {
    return (
      <button
        onClick={onDisconnect}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border border-noir-700 bg-noir-800 text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-all duration-200"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d={config.icon} />
        </svg>
        <span className="font-body text-sm tracking-wide">Disconnect {config.label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${config.color}`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d={config.icon} />
      </svg>
      <span className="font-body text-sm tracking-wide">Connect {config.label}</span>
    </button>
  );
}
