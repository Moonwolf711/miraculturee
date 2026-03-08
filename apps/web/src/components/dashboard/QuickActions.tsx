import { Link } from 'react-router-dom';
import type { Tab } from './types.js';

// --- Quick Action Icons (inline SVGs) ---

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

// --- Quick Action Button ---

function QuickAction({ to, icon, label, sublabel, onClick }: { to: string; icon: React.ReactNode; label: string; sublabel: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 py-4 px-3 bg-noir-900 border border-noir-800 rounded-xl hover:border-amber-500/30 hover:bg-noir-800 transition-all group"
      >
        <span className="text-amber-500 group-hover:text-amber-400 transition-colors">{icon}</span>
        <span className="text-warm-50 text-sm font-medium leading-tight">{label}</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">{sublabel}</span>
      </button>
    );
  }
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 py-4 px-3 bg-noir-900 border border-noir-800 rounded-xl hover:border-amber-500/30 hover:bg-noir-800 transition-all group"
    >
      <span className="text-amber-500 group-hover:text-amber-400 transition-colors">{icon}</span>
      <span className="text-warm-50 text-sm font-medium leading-tight">{label}</span>
      <span className="text-gray-500 text-[10px] uppercase tracking-wider">{sublabel}</span>
    </Link>
  );
}

// --- Exported Quick Actions Grid ---

interface QuickActionsProps {
  setTab: (tab: Tab) => void;
}

export default function QuickActions({ setTab }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <QuickAction to="/events" icon={<SearchIcon />} label="Find Events" sublabel="Near Me" />
      <QuickAction to="/events" icon={<HeartIcon />} label="Support" sublabel="Artists" />
      <QuickAction to="/events" icon={<DiceIcon />} label="Enter" sublabel="Raffles" />
      <QuickAction to="/dashboard?tab=tickets" icon={<TicketIcon />} label="My" sublabel="Tickets" onClick={() => setTab('tickets')} />
    </div>
  );
}

// --- Onboarding Checklist ---

export function OnboardingChecklist({ setTab }: { setTab: (tab: Tab) => void }) {
  return (
    <div className="bg-gradient-to-br from-noir-900 to-noir-950 border border-amber-500/20 rounded-xl p-6">
      <div className="text-center mb-5">
        <h2 className="text-warm-50 font-display text-xl tracking-wider mb-2">Welcome to MiraCulture</h2>
        <p className="text-gray-400 text-sm">Where fans power the show. Get started with your first action.</p>
      </div>
      <div className="space-y-2">
        <OnboardingStep number={1} title="Discover an event near you" description="Browse upcoming shows and find artists you love" to="/events" />
        <OnboardingStep number={2} title="Support your first campaign" description="Help fund tickets so fans who can't afford them get in" to="/events" />
        <OnboardingStep number={3} title="Enter a raffle" description="Win tickets through provably fair drawings" to="/events" />
        <button
          onClick={() => setTab('security')}
          className="w-full flex items-center gap-3 px-4 py-3 bg-noir-800/50 border border-noir-700 rounded-lg hover:border-amber-500/20 transition-colors text-left"
        >
          <span className="w-6 h-6 rounded-full bg-noir-700 flex items-center justify-center text-xs text-gray-500 font-semibold flex-shrink-0">4</span>
          <div>
            <p className="text-gray-300 text-sm font-medium">Secure your account</p>
            <p className="text-gray-600 text-xs">Set up 2FA or a passkey for extra protection</p>
          </div>
        </button>
      </div>
      <div className="mt-4 text-center">
        <p className="text-gray-600 text-xs">Join fans who have supported live music through MiraCulture</p>
      </div>
    </div>
  );
}

function OnboardingStep({ number, title, description, to }: { number: number; title: string; description: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 bg-noir-800/50 border border-noir-700 rounded-lg hover:border-amber-500/20 transition-colors">
      <span className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-xs text-amber-400 font-semibold flex-shrink-0">{number}</span>
      <div>
        <p className="text-gray-300 text-sm font-medium">{title}</p>
        <p className="text-gray-600 text-xs">{description}</p>
      </div>
      <svg className="w-4 h-4 text-gray-600 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
