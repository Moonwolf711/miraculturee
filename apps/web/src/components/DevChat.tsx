import { useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; status: string }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'miraculture_dev_conversations';

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 50))); // keep max 50
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] uppercase tracking-wider bg-noir-700 text-gray-400 hover:text-amber-400 hover:bg-noir-600 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function renderMarkdown(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    // Fenced code block
    if (part.startsWith('```')) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      const lang = match?.[1] || '';
      const code = match ? match[2].trimEnd() : part.slice(3, -3).trimEnd();
      return (
        <div key={i} className="relative group my-3">
          {lang && (
            <div className="text-[10px] uppercase tracking-wider text-gray-500 bg-noir-950 border border-noir-700 border-b-0 rounded-t-lg px-3 py-1.5 font-mono">
              {lang}
            </div>
          )}
          <pre className={`bg-noir-950 border border-noir-700 ${lang ? 'rounded-b-lg' : 'rounded-lg'} p-3 overflow-x-auto text-[13px] leading-relaxed`}>
            <code className="text-amber-300/90">{code}</code>
          </pre>
          <CopyButton text={code} />
        </div>
      );
    }

    // Inline formatting
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part.split('\n').map((line, li) => {
          // Headings
          const h3 = line.match(/^### (.+)/);
          if (h3) return <div key={li} className="font-semibold text-warm-50 mt-3 mb-1">{renderInline(h3[1])}</div>;
          const h2 = line.match(/^## (.+)/);
          if (h2) return <div key={li} className="font-semibold text-warm-50 text-[15px] mt-3 mb-1">{renderInline(h2[1])}</div>;

          // Bullet list
          if (line.match(/^[-*] /)) {
            return <div key={li} className="pl-3 flex gap-1.5"><span className="text-amber-500 shrink-0">-</span><span>{renderInline(line.slice(2))}</span></div>;
          }
          // Numbered list
          const num = line.match(/^(\d+)\. /);
          if (num) {
            return <div key={li} className="pl-3 flex gap-1.5"><span className="text-amber-500 shrink-0">{num[1]}.</span><span>{renderInline(line.slice(num[0].length))}</span></div>;
          }

          // Regular line
          if (line === '') return <br key={li} />;
          return <span key={li}>{renderInline(line)}{'\n'}</span>;
        })}
      </span>
    );
  });
}

function renderInline(text: string) {
  // Handle bold, italic, inline code
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={i} className="bg-noir-700/50 text-amber-300 px-1.5 py-0.5 rounded text-[13px] font-mono">{p.slice(1, -1)}</code>;
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-semibold text-warm-50">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return <span key={i}>{p}</span>;
  });
}

// ---------------------------------------------------------------------------
// Tool call indicator
// ---------------------------------------------------------------------------

function ToolCallBadge({ name, status }: { name: string; status: string }) {
  const label = name.replace(/_/g, ' ');
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noir-800/50 border border-noir-700/50 text-xs text-gray-400 my-1">
      {status === 'running' ? (
        <svg className="w-3 h-3 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : status === 'done' ? (
        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DevChat() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Persist conversation on message changes
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === activeId ? { ...c, messages } : c));
      saveConversations(updated);
      return updated;
    });
  }, [messages, activeId]);

  // Create a new conversation
  const newConversation = useCallback(() => {
    const id = generateId();
    const convo: Conversation = { id, title: 'New Chat', messages: [], createdAt: Date.now() };
    setConversations((prev) => {
      const updated = [convo, ...prev];
      saveConversations(updated);
      return updated;
    });
    setActiveId(id);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  // Load a conversation
  const loadConversation = useCallback((id: string) => {
    const convo = conversations.find((c) => c.id === id);
    if (convo) {
      setActiveId(id);
      setMessages(convo.messages);
      setSidebarOpen(false);
    }
  }, [conversations]);

  // Delete a conversation
  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated);
      return updated;
    });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }, [activeId]);

  // Send a message
  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    // Auto-create conversation if none active
    let currentId = activeId;
    if (!currentId) {
      const id = generateId();
      const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
      const convo: Conversation = { id, title, messages: [], createdAt: Date.now() };
      setConversations((prev) => {
        const updated = [convo, ...prev];
        saveConversations(updated);
        return updated;
      });
      currentId = id;
      setActiveId(id);
    } else if (messages.length === 0) {
      // Update title from first message
      const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === currentId ? { ...c, title } : c));
        saveConversations(updated);
        return updated;
      });
    }

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '', toolCalls: [] }]);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.error || response.status}` };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
                return updated;
              });
            }
            if (parsed.tool_call) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                const existing = last.toolCalls || [];
                const idx = existing.findIndex((t) => t.name === parsed.tool_call.name);
                const newCalls = idx >= 0
                  ? existing.map((t, i) => (i === idx ? parsed.tool_call : t))
                  : [...existing, parsed.tool_call];
                updated[updated.length - 1] = { ...last, toolCalls: newCalls };
                return updated;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: `Error: ${parsed.error}` };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-amber-500 text-noir-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all flex items-center justify-center"
        title="Dev Chat"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex md:inset-auto md:bottom-6 md:right-6 md:w-[520px] md:h-[680px] md:max-h-[calc(100vh-48px)] md:rounded-xl md:shadow-2xl md:shadow-black/50 overflow-hidden border border-noir-700 bg-noir-900">
      {/* Sidebar */}
      <div className={`absolute inset-y-0 left-0 z-10 w-64 bg-noir-950 border-r border-noir-700 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-noir-800">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Conversations</span>
          <button onClick={() => { newConversation(); }} className="text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors">
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-6">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-noir-800/50 transition-colors ${c.id === activeId ? 'bg-noir-800' : 'hover:bg-noir-900'}`}
                onClick={() => loadConversation(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${c.id === activeId ? 'text-warm-50' : 'text-gray-400'}`}>{c.title}</p>
                  <p className="text-[10px] text-gray-600">{c.messages.length} messages</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && <div className="absolute inset-0 z-[5] bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-noir-700 shrink-0 bg-noir-900">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-noir-800 transition-colors text-gray-400 hover:text-gray-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-display text-sm tracking-wider text-warm-50">DEV CHAT</span>
            <span className="text-[10px] text-gray-600 tracking-wider ml-1">Sonnet 4</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={newConversation}
              className="px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-amber-400 transition-colors"
              title="New conversation"
            >
              New
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-noir-800 transition-colors text-gray-400 hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <p className="text-warm-50 font-display text-sm tracking-wider mb-1">MiraCulture Dev Assistant</p>
              <p className="text-gray-600 text-xs max-w-[280px] mx-auto leading-relaxed">
                Ask about the codebase, query live data, request features, or get code snippets. I can access your database.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['How many users do we have?', 'Show active campaigns', 'Build a feature'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 rounded-lg border border-noir-700 text-gray-400 text-xs hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500/10 text-warm-50 border border-amber-500/20'
                  : 'bg-noir-800 text-gray-300 border border-noir-700'
              }`}>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2">
                    {msg.toolCalls.map((tc, j) => <ToolCallBadge key={j} name={tc.name} status={tc.status} />)}
                  </div>
                )}
                {msg.role === 'assistant'
                  ? (msg.content ? renderMarkdown(msg.content) : (streaming && i === messages.length - 1 ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : null))
                  : msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-noir-700 shrink-0 bg-noir-900">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to build or ask about your data..."
              rows={1}
              className="flex-1 bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none max-h-28"
              style={{ minHeight: '42px' }}
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="px-3.5 py-2.5 rounded-lg bg-amber-500 text-noir-950 font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-30 shrink-0 self-end"
            >
              {streaming ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
