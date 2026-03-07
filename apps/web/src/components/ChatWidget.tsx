import { useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// FAQ Knowledge Base
// ---------------------------------------------------------------------------

interface FaqEntry {
  keywords: string[];
  question: string;
  answer: string;
  links?: { label: string; href: string }[];
}

const FAQ_DATA: FaqEntry[] = [
  // -- General / What is MiraCulture --
  {
    keywords: ['what', 'miraculture', 'about', 'platform', 'purpose', 'mission'],
    question: 'What is MiraCulture?',
    answer:
      'MiraCulture is a fan-powered ticketing platform where fans fund affordable concert tickets through community donations. No scalpers, no bots — just real fans supporting real music. 100% of support goes directly to artists.',
    links: [{ label: 'How It Works', href: '/#how-it-works' }],
  },
  // -- Raffles --
  {
    keywords: ['raffle', 'enter', 'win', 'draw', 'lottery', 'chance', 'fair', 'rigged'],
    question: 'How do raffles work?',
    answer:
      'When a campaign reaches its goal, 10 tickets become available. If tickets sell out or time runs out before the goal, remaining funded tickets are raffled to fans who signed up. Every raffle uses a cryptographic commitment scheme (SHA-256 + Fisher-Yates + Seedrandom) so results are provably fair — you can verify any draw yourself.',
    links: [{ label: 'Browse Events', href: '/events' }],
  },
  // -- Tickets --
  {
    keywords: ['ticket', 'buy', 'purchase', 'price', 'cost', 'how much', 'affordable', 'cheap'],
    question: 'How much do tickets cost?',
    answer:
      'Campaign tickets are priced between $5–$10 each, making live music accessible to everyone. When a campaign reaches its goal, 10 tickets unlock at this affordable price. No hidden fees, no scalper markups.',
    links: [{ label: 'Find Events', href: '/events' }],
  },
  // -- Supporting artists --
  {
    keywords: ['support', 'donate', 'donation', 'artist', 'money', 'where', 'goes', 'fund'],
    question: 'How does supporting an artist work?',
    answer:
      '100% of your support goes directly to the artist. When you donate to a campaign, your contribution helps unlock affordable tickets for the community. If the show sells out and there\'s surplus, the extra goes to the artist as a bonus on top of their performance fee.',
    links: [{ label: 'Support Artists', href: '/events' }],
  },
  // -- Campaign flow --
  {
    keywords: ['campaign', 'goal', 'how', 'work', 'flow', 'phase', 'unlock'],
    question: 'How do campaigns work?',
    answer:
      'Artists launch campaigns tied to upcoming shows. Fans donate to reach the ticket goal (10 × ticket price). Once the goal is hit, 10 affordable tickets unlock for local fans. Surplus donations either buy more tickets (if available) or go directly to the artist as a bonus.',
  },
  // -- Fan Impact Score --
  {
    keywords: ['impact', 'score', 'points', 'fan', 'level', 'tier', 'rank'],
    question: 'What is the Fan Impact Score?',
    answer:
      'Your Fan Impact Score tracks how much you\'ve contributed to the MiraCulture community. You earn points for supporting artists, entering raffles, winning tickets, and purchasing tickets. There are 5 tiers: Opening Act, Regular, Superfan, VIP, and Legend.',
    links: [{ label: 'My Dashboard', href: '/dashboard' }],
  },
  // -- Artist levels --
  {
    keywords: ['bronze', 'silver', 'gold', 'platinum', 'artist', 'fan level', 'relationship'],
    question: 'What are artist fan levels?',
    answer:
      'As you interact with an artist (supporting, buying tickets, entering raffles), you build a relationship. Levels go from Bronze (1 interaction) → Silver (3+) → Gold (5+) → Platinum (10+). Check your artist relationships on your dashboard.',
    links: [{ label: 'My Dashboard', href: '/dashboard' }],
  },
  // -- Geolocation / local --
  {
    keywords: ['location', 'geo', 'local', 'nearby', 'area', 'vpn', 'verify'],
    question: 'Why do I need to be local?',
    answer:
      'MiraCulture is built for real local fans. When campaign tickets unlock, geolocation verification ensures only fans within ~100km of the venue can purchase. VPN detection prevents location spoofing. This keeps tickets in the hands of genuine fans who will actually attend.',
  },
  // -- Account / signup --
  {
    keywords: ['account', 'sign up', 'register', 'create', 'join', 'login', 'log in'],
    question: 'How do I create an account?',
    answer:
      'Click "Sign Up" in the top right, enter your email, create a password, and you\'re in. You can also sign in with Google, Facebook, Apple, or Microsoft. Once registered, explore events and start supporting artists!',
    links: [
      { label: 'Sign Up', href: '/register' },
      { label: 'Log In', href: '/login' },
    ],
  },
  // -- Artists: how to join --
  {
    keywords: ['artist', 'join', 'register', 'musician', 'band', 'perform', 'list', 'onboard'],
    question: 'How do artists join MiraCulture?',
    answer:
      'Artists can register at the "For Artists" page. After signing up, you\'ll verify your identity and connect your Stripe account to receive payments directly. Once verified, you can create campaigns for your upcoming shows.',
    links: [{ label: 'Artist Registration', href: '/artist/register' }],
  },
  // -- Security --
  {
    keywords: ['security', 'safe', 'secure', 'password', 'two factor', '2fa', 'passkey', 'totp'],
    question: 'Is MiraCulture secure?',
    answer:
      'Yes. We use industry-standard security: encrypted passwords, two-factor authentication (TOTP or passkeys), hCaptcha bot protection, and cryptographically verifiable raffle draws. You can enable 2FA in your Dashboard → Security tab.',
    links: [{ label: 'Security Settings', href: '/dashboard' }],
  },
  // -- Payments / Stripe --
  {
    keywords: ['payment', 'stripe', 'pay', 'card', 'apple pay', 'google pay', 'refund'],
    question: 'How are payments handled?',
    answer:
      'All payments are processed securely through Stripe. We support credit/debit cards, Apple Pay, and Google Pay. Artist payouts go directly to their connected Stripe accounts — MiraCulture never holds artist funds.',
  },
  // -- Contact / help --
  {
    keywords: ['contact', 'help', 'support', 'email', 'reach', 'problem', 'issue', 'bug'],
    question: 'How do I get help?',
    answer:
      'For account issues or questions, email us at support@mira-culture.com. For artists needing onboarding help, visit the For Artists page. We\'re a small team building something meaningful — we read every message.',
    links: [{ label: 'For Artists', href: '/artist/verify' }],
  },
  // -- Scalpers / bots --
  {
    keywords: ['scalp', 'bot', 'resell', 'resale', 'fraud', 'fake'],
    question: 'How does MiraCulture prevent scalping?',
    answer:
      'Every layer is designed anti-scalper: hCaptcha blocks bots, geolocation ensures local fans only, VPN detection prevents spoofing, cryptographic raffles are provably fair, and ticket prices are locked at $5–$10. Scalpers have no economic incentive here.',
  },
];

// ---------------------------------------------------------------------------
// Keyword matching engine
// ---------------------------------------------------------------------------

function findBestMatch(input: string): FaqEntry | null {
  const words = input.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  let bestEntry: FaqEntry | null = null;
  let bestScore = 0;

  for (const entry of FAQ_DATA) {
    let score = 0;
    for (const keyword of entry.keywords) {
      for (const word of words) {
        if (word.length < 2) continue;
        if (keyword === word) {
          score += 3;
        } else if (keyword.includes(word) || word.includes(keyword)) {
          score += 1;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore >= 2 ? bestEntry : null;
}

// ---------------------------------------------------------------------------
// Suggested quick questions
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS = [
  'How do raffles work?',
  'How much do tickets cost?',
  'What is the Fan Impact Score?',
  'How do artists join?',
];

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  links?: { label: string; href: string }[];
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Welcome message on first open
  useEffect(() => {
    if (open && !hasInteracted) {
      setHasInteracted(true);
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          text: "Hey! I'm the MiraCulture assistant. Ask me anything about how the platform works, tickets, raffles, or supporting artists.",
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, hasInteracted]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text || input).trim();
      if (!msg) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      // Find answer
      setTimeout(() => {
        const match = findBestMatch(msg);

        const botMsg: ChatMessage = match
          ? {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: match.answer,
              links: match.links,
              timestamp: new Date(),
            }
          : {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: "I'm not sure about that one. Try asking about tickets, raffles, campaigns, fan impact scores, or artist onboarding. You can also email support@mira-culture.com for help.",
              links: [{ label: 'Browse Events', href: '/events' }],
              timestamp: new Date(),
            };

        setMessages((prev) => [...prev, botMsg]);
      }, 400);
    },
    [input],
  );

  return (
    <>
      {/* Chat bubble button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-noir-700 hover:bg-noir-600 rotate-0'
            : 'bg-amber-500 hover:bg-amber-400 hover:scale-105'
        }`}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-300">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-noir-950">
            <path
              d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.27 2.94 5.74L4 20l4.26-1.94C9.44 18.66 10.68 19 12 19c5.52 0 10-3.58 10-8s-4.48-8-10-8z"
              fill="currentColor"
            />
            <circle cx="8" cy="10" r="1.2" fill="#1a1a1a" />
            <circle cx="12" cy="10" r="1.2" fill="#1a1a1a" />
            <circle cx="16" cy="10" r="1.2" fill="#1a1a1a" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[340px] sm:w-[380px] max-h-[500px] rounded-2xl border border-noir-700/60 bg-noir-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-noir-700/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-500 text-sm font-bold">M</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-200">MiraCulture Help</p>
              <p className="text-xs text-gray-500">Ask anything about the platform</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[340px]">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-amber-500/20 text-amber-100 rounded-br-sm'
                      : 'bg-noir-800/80 text-gray-300 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.links.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          className="inline-block text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                        >
                          {l.label} &rarr;
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />

            {/* Quick questions — only show when just the welcome message */}
            {messages.length === 1 && messages[0].role === 'bot' && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-gray-500 mb-1">Quick questions:</p>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-noir-700/50 text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-noir-700/40">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-noir-800/60 border border-noir-700/40 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-3 py-2 rounded-xl bg-amber-500 text-noir-950 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-in {
          animation: chatSlideIn 0.25s ease-out;
        }
        @keyframes chatSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
