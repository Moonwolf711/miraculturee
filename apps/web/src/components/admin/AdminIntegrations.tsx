import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api.js';

interface Platform {
  id: string;
  name: string;
  displayName: string;
  status: string;
  devPortalUrl: string | null;
  contactEmail: string | null;
  contactedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  _count: { contactLogs: number };
}

interface ContactLog {
  id: string;
  messageType: string;
  subject: string;
  body: string;
  sentAt: string;
}

interface PlatformDetail extends Omit<Platform, '_count'> {
  contactLogs: ContactLog[];
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  CONTACTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PENDING_APPROVAL: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  API_KEY_RECEIVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  ACTIVE: 'bg-green-500/15 text-green-300 border-green-500/30',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  SUSPENDED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  CONTACTED: 'Contacted',
  PENDING_APPROVAL: 'Pending Approval',
  API_KEY_RECEIVED: 'Key Received',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export default function AdminIntegrations() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contactModal, setContactModal] = useState<Platform | null>(null);
  const [messageType, setMessageType] = useState('initial_request');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ emailSent: boolean; copyableEmail?: { to: string; subject: string; body: string } } | null>(null);

  const fetchPlatforms = useCallback(() => {
    setLoading(true);
    api.get<{ platforms: Platform[] }>('/admin/integrations')
      .then((data) => setPlatforms(data.platforms))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]);

  const viewDetails = useCallback((platform: Platform) => {
    setDetailLoading(true);
    setSelectedPlatform(null);
    api.get<PlatformDetail>(`/admin/integrations/${platform.id}`)
      .then(setSelectedPlatform)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await api.put(`/admin/integrations/${id}`, { status });
    fetchPlatforms();
    if (selectedPlatform?.id === id) {
      viewDetails({ id } as Platform);
    }
  }, [fetchPlatforms, selectedPlatform, viewDetails]);

  const sendContact = useCallback(async () => {
    if (!contactModal) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await api.post<{ emailSent: boolean; copyableEmail?: { to: string; subject: string; body: string } }>(
        `/admin/integrations/${contactModal.id}/contact`,
        { messageType, customSubject: customSubject || undefined, customBody: customBody || undefined },
      );
      setSendResult(res);
      fetchPlatforms();
    } catch {
      setSendResult(null);
    } finally {
      setSending(false);
    }
  }, [contactModal, messageType, customSubject, customBody, fetchPlatforms]);

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading platforms...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-xl tracking-wider text-warm-50">PLATFORM INTEGRATIONS</h2>
          <p className="text-gray-500 text-sm mt-1">Manage API access with third-party ticketing platforms</p>
        </div>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {platforms.map((p) => (
          <div key={p.id} className="bg-noir-800 border border-noir-700 rounded-xl p-5 hover:border-noir-600 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-warm-50 font-semibold">{p.displayName}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${STATUS_COLORS[p.status] || STATUS_COLORS.NOT_STARTED}`}>
                {STATUS_LABELS[p.status] || p.status}
              </span>
            </div>

            {p.contactEmail && (
              <p className="text-gray-500 text-xs mb-1">{p.contactEmail}</p>
            )}
            {p.devPortalUrl && (
              <a href={p.devPortalUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400/70 hover:text-amber-400 text-xs">
                Developer Portal
              </a>
            )}
            {p.contactedAt && (
              <p className="text-gray-600 text-xs mt-1">Contacted: {new Date(p.contactedAt).toLocaleDateString()}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => viewDetails(p)}
                className="flex-1 px-3 py-1.5 bg-noir-700 hover:bg-noir-600 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Details
              </button>
              <button
                onClick={() => { setContactModal(p); setSendResult(null); setCustomSubject(''); setCustomBody(''); setMessageType('initial_request'); }}
                className="flex-1 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold transition-colors"
              >
                Contact
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {(selectedPlatform || detailLoading) && (
        <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 mb-8">
          {detailLoading ? (
            <div className="text-gray-500 py-4 text-center">Loading details...</div>
          ) : selectedPlatform && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-warm-50 font-semibold text-lg">{selectedPlatform.displayName} — Details</h3>
                <button onClick={() => setSelectedPlatform(null)} className="text-gray-500 hover:text-gray-300 text-sm">Close</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {(['NOT_STARTED', 'CONTACTED', 'PENDING_APPROVAL', 'API_KEY_RECEIVED', 'ACTIVE', 'REJECTED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selectedPlatform.id, s)}
                    className={`px-3 py-2 rounded-lg text-xs text-center transition-colors border ${
                      selectedPlatform.status === s
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-semibold'
                        : 'border-noir-600 bg-noir-700 text-gray-400 hover:border-noir-500'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {selectedPlatform.notes && (
                <div className="bg-noir-900 rounded-lg p-4 mb-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-gray-300 text-sm">{selectedPlatform.notes}</p>
                </div>
              )}

              {/* Contact History */}
              <h4 className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-3">Contact History ({selectedPlatform.contactLogs.length})</h4>
              {selectedPlatform.contactLogs.length === 0 ? (
                <p className="text-gray-600 text-sm">No contacts logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPlatform.contactLogs.map((log) => (
                    <div key={log.id} className="bg-noir-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-warm-50 text-sm font-medium">{log.subject}</span>
                        <span className="text-gray-600 text-xs">{new Date(log.sentAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-gray-500 text-xs">{log.messageType}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contact Modal */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setContactModal(null)}>
          <div className="bg-noir-900 border border-noir-800 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl tracking-wider text-warm-50">CONTACT {contactModal.displayName.toUpperCase()}</h2>
              <button onClick={() => setContactModal(null)} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {!sendResult ? (
              <>
                <div className="mb-4">
                  <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Message Template</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMessageType('initial_request')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors border ${messageType === 'initial_request' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-noir-700 bg-noir-800 text-gray-400'}`}
                    >
                      Initial Request
                    </button>
                    <button
                      onClick={() => setMessageType('follow_up')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors border ${messageType === 'follow_up' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-noir-700 bg-noir-800 text-gray-400'}`}
                    >
                      Follow-up
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-1">Custom Subject (optional)</label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-sm"
                    placeholder="Leave blank to use template"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-1">Custom Body (optional)</label>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={6}
                    className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-sm resize-none"
                    placeholder="Leave blank to use template"
                  />
                </div>

                {contactModal.contactEmail && (
                  <p className="text-gray-500 text-xs mb-4">Will send to: <span className="text-gray-300">{contactModal.contactEmail}</span></p>
                )}

                <button
                  onClick={sendContact}
                  disabled={sending}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {sending ? 'Sending...' : 'Send & Log Contact'}
                </button>
              </>
            ) : (
              <div>
                {sendResult.emailSent ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4 text-center">
                    <p className="text-green-400 font-medium">Email sent successfully!</p>
                    <p className="text-gray-400 text-sm mt-1">Message logged to contact history.</p>
                  </div>
                ) : sendResult.copyableEmail ? (
                  <div className="space-y-3">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                      <p className="text-amber-400 text-sm font-medium">Message logged. Copy the email below to send manually:</p>
                    </div>
                    <div className="bg-noir-800 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-gray-500 text-xs uppercase">To:</span>
                        <p className="text-gray-300 text-sm">{sendResult.copyableEmail.to}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase">Subject:</span>
                        <p className="text-gray-300 text-sm">{sendResult.copyableEmail.subject}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase">Body:</span>
                        <pre className="text-gray-300 text-xs mt-1 whitespace-pre-wrap font-body leading-relaxed">{sendResult.copyableEmail.body}</pre>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`Subject: ${sendResult.copyableEmail!.subject}\n\n${sendResult.copyableEmail!.body}`).catch(() => {}); }}
                        className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Copy Full Email
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                    <p className="text-red-400">Failed to send. Contact logged for reference.</p>
                  </div>
                )}
                <button
                  onClick={() => setContactModal(null)}
                  className="w-full mt-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors text-sm"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
