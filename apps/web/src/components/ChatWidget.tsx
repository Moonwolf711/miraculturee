import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

// Web Speech API type declarations (not in default TS lib)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ---------------------------------------------------------------------------
// Navigation Route Map
// ---------------------------------------------------------------------------

interface NavRoute {
  path: string;
  name: string;
  keywords: string[];
  requiresAuth?: boolean;
  requiresRole?: string[];
  description: string;
}

const NAV_ROUTES: NavRoute[] = [
  {
    path: '/',
    name: 'Home',
    keywords: ['home', 'main', 'landing', 'start', 'homepage', 'front page', 'beginning'],
    description: 'The MiraCulture homepage.',
  },
  {
    path: '/events',
    name: 'Events',
    keywords: ['events', 'shows', 'concerts', 'gigs', 'browse', 'find', 'discover', 'upcoming', 'live', 'music', 'performances', 'listings'],
    description: 'Browse upcoming events and campaigns.',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    keywords: ['dashboard', 'my dashboard', 'overview', 'my page', 'fan dashboard', 'my stuff', 'my account', 'hub'],
    requiresAuth: true,
    description: 'Your personal fan dashboard.',
  },
  {
    path: '/account',
    name: 'Account Settings',
    keywords: ['account', 'settings', 'profile', 'preferences', 'edit profile', 'change password', 'password', 'security', '2fa', 'two factor', 'passkey', 'notifications', 'email settings'],
    requiresAuth: true,
    description: 'Manage your account, security, and preferences.',
  },
  {
    path: '/login',
    name: 'Login',
    keywords: ['login', 'log in', 'sign in', 'signin'],
    description: 'Sign in to your account.',
  },
  {
    path: '/register',
    name: 'Sign Up',
    keywords: ['register', 'sign up', 'signup', 'create account', 'join', 'new account'],
    description: 'Create a new MiraCulture account.',
  },
  {
    path: '/artist/register',
    name: 'Artist Registration',
    keywords: ['artist register', 'artist signup', 'become artist', 'artist join', 'list my music', 'add artist'],
    description: 'Register as an artist on MiraCulture.',
  },
  {
    path: '/artist/dashboard',
    name: 'Artist Dashboard',
    keywords: ['artist dashboard', 'my campaigns', 'artist panel', 'campaign management', 'artist home'],
    requiresAuth: true,
    description: 'Manage your artist campaigns and earnings.',
  },
  {
    path: '/artist/verify',
    name: 'Artist Verification',
    keywords: ['verify artist', 'artist verify', 'artist verification', 'connect stripe', 'artist setup'],
    requiresAuth: true,
    description: 'Verify your artist identity and connect payments.',
  },
  {
    path: '/artist/earnings',
    name: 'Artist Earnings',
    keywords: ['earnings', 'payouts', 'artist money', 'revenue', 'income', 'artist earnings'],
    requiresAuth: true,
    description: 'View your artist earnings and payouts.',
  },
  {
    path: '/agents',
    name: 'Agent Marketplace',
    keywords: ['agents', 'agent marketplace', 'find agent', 'booking agent', 'promoter'],
    description: 'Browse the agent marketplace.',
  },
  {
    path: '/agents/register',
    name: 'Agent Registration',
    keywords: ['agent register', 'become agent', 'agent signup'],
    requiresAuth: true,
    description: 'Register as a booking agent.',
  },
  {
    path: '/agents/dashboard',
    name: 'Agent Dashboard',
    keywords: ['agent dashboard', 'agent panel', 'agent home'],
    requiresAuth: true,
    description: 'Manage your agent campaigns.',
  },
  {
    path: '/manager/dashboard',
    name: 'Manager Dashboard',
    keywords: ['manager', 'manager dashboard', 'manage artists', 'manager panel'],
    requiresAuth: true,
    description: 'Manage your artists.',
  },
  {
    path: '/local-artists',
    name: 'Local Artists',
    keywords: ['local artists', 'local music', 'local bands', 'indie artists', 'local marketplace'],
    description: 'Discover local artists near you.',
  },
  {
    path: '/local-artists/register',
    name: 'Local Artist Registration',
    keywords: ['local artist register', 'local artist signup'],
    requiresAuth: true,
    description: 'Register as a local artist.',
  },
  {
    path: '/local-artists/dashboard',
    name: 'Local Artist Dashboard',
    keywords: ['local artist dashboard', 'local artist panel'],
    requiresAuth: true,
    description: 'Manage your local artist profile.',
  },
  {
    path: '/connect/dashboard',
    name: 'Connect Dashboard',
    keywords: ['connect', 'connect dashboard', 'storefront', 'stripe connect'],
    requiresAuth: true,
    description: 'Manage your Stripe Connect integration.',
  },
  {
    path: '/admin',
    name: 'Admin Panel',
    keywords: ['admin', 'admin panel', 'admin dashboard', 'administration', 'manage users'],
    requiresAuth: true,
    requiresRole: ['ADMIN', 'DEVELOPER'],
    description: 'Site administration panel.',
  },
  {
    path: '/forgot-password',
    name: 'Forgot Password',
    keywords: ['forgot password', 'reset password', 'lost password', 'cant login', 'password reset'],
    description: 'Reset your password.',
  },
  {
    path: '/privacy',
    name: 'Privacy Policy',
    keywords: ['privacy', 'privacy policy', 'data', 'gdpr'],
    description: 'Our privacy policy.',
  },
  {
    path: '/terms',
    name: 'Terms of Service',
    keywords: ['terms', 'terms of service', 'tos', 'legal', 'conditions'],
    description: 'Our terms of service.',
  },
];

// Navigation intent phrases — if the user's message starts with or contains these,
// it's a navigation request rather than a question
const NAV_INTENTS = [
  'go to', 'take me to', 'open', 'show me', 'navigate to', 'bring me to',
  'i want to see', 'i want to go to', 'where is', 'how do i get to',
  'can you take me to', 'lets go to', 'head to', 'visit', 'load',
  'switch to', 'bring up', 'pull up', 'get me to', 'redirect to',
  'i need', 'i want', 'find the', 'where can i find',
];

interface NavMatch {
  route: NavRoute;
  score: number;
}

function findNavMatch(input: string): NavMatch | null {
  const lower = input.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = lower.split(/\s+/);

  let bestMatch: NavMatch | null = null;

  for (const route of NAV_ROUTES) {
    let score = 0;

    for (const keyword of route.keywords) {
      const kwWords = keyword.split(/\s+/);

      // Full phrase match (highest value)
      if (lower.includes(keyword)) {
        score += kwWords.length * 4;
      } else {
        // Individual word matches
        for (const kw of kwWords) {
          for (const word of words) {
            if (word.length < 2) continue;
            if (kw === word) score += 3;
            else if (kw.includes(word) || word.includes(kw)) score += 1;
          }
        }
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { route, score };
    }
  }

  return bestMatch && bestMatch.score >= 3 ? bestMatch : null;
}

function hasNavIntent(input: string): boolean {
  const lower = input.toLowerCase();
  return NAV_INTENTS.some((phrase) => lower.includes(phrase));
}

function findMultipleMatches(input: string): NavMatch[] {
  const lower = input.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = lower.split(/\s+/);
  const matches: NavMatch[] = [];

  for (const route of NAV_ROUTES) {
    let score = 0;
    for (const keyword of route.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(/\s+/).length * 4;
      } else {
        for (const kw of keyword.split(/\s+/)) {
          for (const word of words) {
            if (word.length < 2) continue;
            if (kw === word) score += 3;
            else if (kw.includes(word) || word.includes(kw)) score += 1;
          }
        }
      }
    }
    if (score >= 2) matches.push({ route, score });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

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
  {
    keywords: ['what', 'miraculture', 'about', 'platform', 'purpose', 'mission'],
    question: 'What is MiraCulture?',
    answer:
      'MiraCulture is a fan-powered ticketing platform where fans fund affordable concert tickets through community donations. No scalpers, no bots — just real fans supporting real music. 100% of support goes directly to artists.',
    links: [{ label: 'How It Works', href: '/#how-it-works' }],
  },
  {
    keywords: ['raffle', 'enter', 'win', 'draw', 'lottery', 'chance', 'fair', 'rigged'],
    question: 'How do raffles work?',
    answer:
      'When a campaign reaches its goal, 10 tickets become available. If tickets sell out or time runs out before the goal, remaining funded tickets are raffled to fans who signed up. Every raffle uses a cryptographic commitment scheme (SHA-256 + Fisher-Yates + Seedrandom) so results are provably fair — you can verify any draw yourself.',
    links: [{ label: 'Browse Events', href: '/events' }],
  },
  {
    keywords: ['ticket', 'buy', 'purchase', 'price', 'cost', 'how much', 'affordable', 'cheap'],
    question: 'How much do tickets cost?',
    answer:
      'Campaign tickets are priced between $5–$10 each, making live music accessible to everyone. When a campaign reaches its goal, 10 tickets unlock at this affordable price. No hidden fees, no scalper markups.',
    links: [{ label: 'Find Events', href: '/events' }],
  },
  {
    keywords: ['support', 'donate', 'donation', 'artist', 'money', 'where', 'goes', 'fund'],
    question: 'How does supporting an artist work?',
    answer:
      '100% of your support goes directly to the artist. When you donate to a campaign, your contribution helps unlock affordable tickets for the community. If the show sells out and there\'s surplus, the extra goes to the artist as a bonus on top of their performance fee.',
    links: [{ label: 'Support Artists', href: '/events' }],
  },
  {
    keywords: ['campaign', 'goal', 'how', 'work', 'flow', 'phase', 'unlock'],
    question: 'How do campaigns work?',
    answer:
      'Artists launch campaigns tied to upcoming shows. Fans donate to reach the ticket goal (10 × ticket price). Once the goal is hit, 10 affordable tickets unlock for local fans. Surplus donations either buy more tickets (if available) or go directly to the artist as a bonus.',
  },
  {
    keywords: ['impact', 'score', 'points', 'fan', 'level', 'tier', 'rank'],
    question: 'What is the Fan Impact Score?',
    answer:
      'Your Fan Impact Score tracks how much you\'ve contributed to the MiraCulture community. You earn points for supporting artists, entering raffles, winning tickets, and purchasing tickets. There are 5 tiers: Opening Act, Regular, Superfan, VIP, and Legend.',
    links: [{ label: 'My Dashboard', href: '/dashboard' }],
  },
  {
    keywords: ['bronze', 'silver', 'gold', 'platinum', 'artist', 'fan level', 'relationship'],
    question: 'What are artist fan levels?',
    answer:
      'As you interact with an artist (supporting, buying tickets, entering raffles), you build a relationship. Levels go from Bronze (1 interaction) → Silver (3+) → Gold (5+) → Platinum (10+). Check your artist relationships on your dashboard.',
    links: [{ label: 'My Dashboard', href: '/dashboard' }],
  },
  {
    keywords: ['location', 'geo', 'local', 'nearby', 'area', 'vpn', 'verify'],
    question: 'Why do I need to be local?',
    answer:
      'MiraCulture is built for real local fans. When campaign tickets unlock, geolocation verification ensures only fans within ~100km of the venue can purchase. VPN detection prevents location spoofing. This keeps tickets in the hands of genuine fans who will actually attend.',
  },
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
  {
    keywords: ['artist', 'join', 'register', 'musician', 'band', 'perform', 'list', 'onboard'],
    question: 'How do artists join MiraCulture?',
    answer:
      'Artists can register at the "For Artists" page. After signing up, you\'ll verify your identity and connect your Stripe account to receive payments directly. Once verified, you can create campaigns for your upcoming shows.',
    links: [{ label: 'Artist Registration', href: '/artist/register' }],
  },
  {
    keywords: ['security', 'safe', 'secure', 'password', 'two factor', '2fa', 'passkey', 'totp'],
    question: 'Is MiraCulture secure?',
    answer:
      'Yes. We use industry-standard security: encrypted passwords, two-factor authentication (TOTP or passkeys), hCaptcha bot protection, and cryptographically verifiable raffle draws. You can enable 2FA in your Account Settings.',
    links: [{ label: 'Account Settings', href: '/account' }],
  },
  {
    keywords: ['payment', 'stripe', 'pay', 'card', 'apple pay', 'google pay', 'refund'],
    question: 'How are payments handled?',
    answer:
      'All payments are processed securely through Stripe. We support credit/debit cards, Apple Pay, and Google Pay. Artist payouts go directly to their connected Stripe accounts — MiraCulture never holds artist funds.',
  },
  {
    keywords: ['contact', 'help', 'support', 'email', 'reach', 'problem', 'issue', 'bug'],
    question: 'How do I get help?',
    answer:
      'For account issues or questions, email us at support@mira-culture.com. For artists needing onboarding help, visit the For Artists page. We\'re a small team building something meaningful — we read every message.',
    links: [{ label: 'For Artists', href: '/artist/verify' }],
  },
  {
    keywords: ['scalp', 'bot', 'resell', 'resale', 'fraud', 'fake'],
    question: 'How does MiraCulture prevent scalping?',
    answer:
      'Every layer is designed anti-scalper: hCaptcha blocks bots, geolocation ensures local fans only, VPN detection prevents spoofing, cryptographic raffles are provably fair, and ticket prices are locked at $5–$10. Scalpers have no economic incentive here.',
  },
];

function findBestFaqMatch(input: string): FaqEntry | null {
  const words = input.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  let bestEntry: FaqEntry | null = null;
  let bestScore = 0;

  for (const entry of FAQ_DATA) {
    let score = 0;
    for (const keyword of entry.keywords) {
      for (const word of words) {
        if (word.length < 2) continue;
        if (keyword === word) score += 3;
        else if (keyword.includes(word) || word.includes(keyword)) score += 1;
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
// Chat message types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  links?: { label: string; href: string }[];
  navButtons?: { label: string; path: string }[];
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Quick suggestions
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS = [
  'Take me to events',
  'How do raffles work?',
  'Open my dashboard',
  'Show me account settings',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ChatWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && !hasInteracted) {
      setHasInteracted(true);
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          text: "Hey! I'm the MiraCulture assistant. Ask me anything, or tell me where you want to go — I'll take you there.",
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, hasInteracted]);

  // Voice-to-text via Web Speech API
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sendRef = useRef<(text?: string) => void>(() => {});

  const supportsVoice = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleVoice = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);

      // Auto-send when speech is final
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          sendRef.current(transcript);
          setListening(false);
        }, 300);
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  const doNavigate = useCallback(
    (path: string) => {
      if (location.pathname !== path) {
        navigate(path);
      }
    },
    [navigate, location.pathname],
  );

  const handleNavButton = useCallback(
    (path: string, name: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `nav-${Date.now()}`,
          role: 'bot',
          text: `Taking you to ${name}...`,
          timestamp: new Date(),
        },
      ]);
      setTimeout(() => doNavigate(path), 400);
    },
    [doNavigate],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      // 1. Check for navigation intent
      const isNavIntent = hasNavIntent(msg);
      const navMatch = findNavMatch(msg);

      if (navMatch && (isNavIntent || navMatch.score >= 6)) {
        const route = navMatch.route;

        // Check auth requirements
        if (route.requiresAuth && !user) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `b-${Date.now()}`,
                role: 'bot',
                text: `You need to be logged in to access ${route.name}. Let me take you to the login page.`,
                navButtons: [
                  { label: 'Log In', path: '/login' },
                  { label: 'Sign Up', path: '/register' },
                ],
                timestamp: new Date(),
              },
            ]);
          }, 300);
          return;
        }

        // Check role requirements
        if (route.requiresRole && user && !route.requiresRole.includes(user.role)) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `b-${Date.now()}`,
                role: 'bot',
                text: `Sorry, ${route.name} requires ${route.requiresRole!.join(' or ')} access. Your current role is ${user.role}.`,
                timestamp: new Date(),
              },
            ]);
          }, 300);
          return;
        }

        // Already on that page?
        if (location.pathname === route.path) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `b-${Date.now()}`,
                role: 'bot',
                text: `You're already on ${route.name}! Is there something specific you're looking for?`,
                timestamp: new Date(),
              },
            ]);
          }, 300);
          return;
        }

        // Navigate!
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: `Taking you to ${route.name}...`,
              timestamp: new Date(),
            },
          ]);
          setTimeout(() => doNavigate(route.path), 500);
        }, 300);
        return;
      }

      // 2. If nav intent was detected but no strong match, show suggestions
      if (isNavIntent) {
        const multiMatches = findMultipleMatches(msg);
        if (multiMatches.length > 0) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `b-${Date.now()}`,
                role: 'bot',
                text: "I found a few pages that might be what you're looking for:",
                navButtons: multiMatches.map((m) => ({
                  label: m.route.name,
                  path: m.route.path,
                })),
                timestamp: new Date(),
              },
            ]);
          }, 300);
          return;
        }

        // No matches at all for nav intent
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: "I'm not sure which page you mean. Here are some popular spots:",
              navButtons: [
                { label: 'Events', path: '/events' },
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Account Settings', path: '/account' },
                { label: 'Home', path: '/' },
              ],
              timestamp: new Date(),
            },
          ]);
        }, 300);
        return;
      }

      // 3. Try FAQ match
      const faqMatch = findBestFaqMatch(msg);
      if (faqMatch) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: faqMatch.answer,
              links: faqMatch.links,
              timestamp: new Date(),
            },
          ]);
        }, 300);
        return;
      }

      // 4. Check if there's a weak nav match (user might be trying to navigate without explicit intent)
      const weakNavMatch = findNavMatch(msg);
      if (weakNavMatch) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: `Were you looking for the ${weakNavMatch.route.name} page? ${weakNavMatch.route.description}`,
              navButtons: [{ label: `Go to ${weakNavMatch.route.name}`, path: weakNavMatch.route.path }],
              timestamp: new Date(),
            },
          ]);
        }, 300);
        return;
      }

      // 5. Fallback — try API
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/chat/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        });

        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: data.answer,
              timestamp: new Date(),
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bot',
              text: "I'm not sure about that one. Try asking about tickets, raffles, campaigns, or tell me where you'd like to go!",
              navButtons: [
                { label: 'Events', path: '/events' },
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Home', path: '/' },
              ],
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            role: 'bot',
            text: "Sorry, I'm having trouble connecting. You can still navigate using the buttons below, or email support@mira-culture.com.",
            navButtons: [
              { label: 'Events', path: '/events' },
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Home', path: '/' },
            ],
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, user, location.pathname, doNavigate],
  );

  // Keep sendRef current so voice callback can call latest handleSend
  sendRef.current = handleSend;

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
        <div className="fixed bottom-24 right-5 z-50 w-[340px] sm:w-[380px] max-h-[calc(100vh-120px)] rounded-2xl border border-noir-700/60 bg-noir-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-noir-700/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-500 text-sm font-bold">M</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-200">MiraCulture Guide</p>
              <p className="text-xs text-gray-500">Ask anything or say where to go</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
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

                  {/* Navigation buttons */}
                  {m.navButtons && m.navButtons.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.navButtons.map((btn) => (
                        <button
                          key={btn.path}
                          onClick={() => handleNavButton(btn.path, btn.label)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 hover:text-amber-300 border border-amber-500/20 transition-colors duration-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                            <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* FAQ links */}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.links.map((l) => (
                        <button
                          key={l.href}
                          onClick={() => handleNavButton(l.href, l.label)}
                          className="inline-block text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                        >
                          {l.label} &rarr;
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-noir-800/80 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />

            {/* Quick suggestions — only show on welcome */}
            {messages.length === 1 && messages[0].role === 'bot' && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-gray-500 mb-1">Try saying:</p>
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
                placeholder={listening ? 'Listening...' : 'Ask or say where to go...'}
                className={`flex-1 bg-noir-800/60 border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-colors ${
                  listening
                    ? 'border-red-500/60 focus:border-red-500/80'
                    : 'border-noir-700/40 focus:border-amber-500/40'
                }`}
              />
              {supportsVoice && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    listening
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
                      : 'bg-noir-800/60 text-gray-400 hover:text-amber-400 hover:bg-noir-700/60'
                  }`}
                  aria-label={listening ? 'Stop listening' : 'Voice input'}
                  title={listening ? 'Tap to stop' : 'Tap to speak'}
                >
                  {listening ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || loading}
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
