import { useState } from 'react';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const EVENT_KEYWORDS = /festival|wonderland|cruise|lands$|edc|beyond|circus|cove \d|dreamstate|wasteland|iii points|arc music|nocturnal|escape|north coast|outside lands|circuit(mom|sun)|ultra|tomorrowland|coachella|bonnaroo|lollapalooza|burning man|day\s?\d|year\s?\d/i;
const isLikelyEvent = (name: string) => !name.includes(',') && EVENT_KEYWORDS.test(name);
const splitArtists = (name: string) => name.includes(',') ? name.split(',').map(n => n.trim()).filter(Boolean) : [name];

interface ArtistItem {
  id: string;
  stageName: string;
  genre: string | null;
  bio: string | null;
  isVerified: boolean;
  verificationStatus: string;
  isPlaceholder: boolean;
  spotifyArtistId: string | null;
  stripeAccountId: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; role: string; isBanned: boolean; emailVerified: boolean };
  _count: { socialAccounts: number; campaigns: number; events: number };
  activeCampaigns: number;
}

interface ArtistsResponse {
  artists: ArtistItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminArtistManagementProps {
  artists: ArtistsResponse;
  artistSearch: string;
  verificationFilter: string;
  artistPage: number;
  actionLoading: string | null;
  onArtistSearchChange: (value: string) => void;
  onVerificationFilterChange: (value: string) => void;
  onArtistPageChange: (page: number) => void;
  onArtistSearchSubmit: (e: React.FormEvent) => void;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onBan: (id: string, ban: boolean) => void;
  onEditSave: (id: string, form: { stageName: string; genre: string; bio: string }) => void;
  onEmailSend: (id: string, form: { subject: string; message: string }) => Promise<boolean>;
}

export default function AdminArtistManagement({
  artists,
  artistSearch,
  verificationFilter,
  artistPage,
  actionLoading,
  onArtistSearchChange,
  onVerificationFilterChange,
  onArtistPageChange,
  onArtistSearchSubmit,
  onVerify,
  onReject,
  onBan,
  onEditSave,
  onEmailSend,
}: AdminArtistManagementProps) {
  const [editingArtist, setEditingArtist] = useState<ArtistItem | null>(null);
  const [editForm, setEditForm] = useState({ stageName: '', genre: '', bio: '' });
  const [emailingArtist, setEmailingArtist] = useState<ArtistItem | null>(null);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleEditOpen = (a: ArtistItem) => {
    setEditingArtist(a);
    setEditForm({ stageName: a.stageName, genre: a.genre || '', bio: a.bio || '' });
  };

  const handleEditSave = () => {
    if (!editingArtist) return;
    onEditSave(editingArtist.id, editForm);
    setEditingArtist(null);
  };

  const handleEmailOpen = (a: ArtistItem) => {
    setEmailingArtist(a);
    setEmailForm({ subject: '', message: '' });
    setEmailSent(false);
  };

  const handleEmailSend = async () => {
    if (!emailingArtist || !emailForm.subject.trim() || !emailForm.message.trim()) return;
    setEmailSending(true);
    const success = await onEmailSend(emailingArtist.id, emailForm);
    setEmailSending(false);
    if (success) {
      setEmailSent(true);
      setTimeout(() => setEmailingArtist(null), 1500);
    }
  };

  return (
    <>
      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={onArtistSearchSubmit} className="flex-1">
          <input
            type="text"
            value={artistSearch}
            onChange={(e) => onArtistSearchChange(e.target.value)}
            placeholder="Search by stage name or email..."
            className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </form>
        <select
          value={verificationFilter}
          onChange={(e) => onVerificationFilterChange(e.target.value)}
          className="bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="">All Artists</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {/* Artist Count */}
      <p className="text-gray-500 text-xs mb-4 uppercase tracking-wider">
        {artists.total.toLocaleString()} artists total &middot; page {artists.page} of {artists.totalPages}
      </p>

      {/* Mobile Artist Cards */}
      <div className="space-y-2 md:hidden">
        {artists.artists.map((a) => (
          <div key={a.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex gap-1 shrink-0">
                {isLikelyEvent(a.stageName) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">Event</span>
                )}
                {a.isVerified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">Verified</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-noir-700 text-gray-400 border border-noir-600">Unverified</span>
                )}
                {a.user.isBanned && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Banned</span>
                )}
              </div>
            </div>
            {splitArtists(a.stageName).length > 1 ? (
              <div className="flex flex-wrap gap-1.5 my-2">
                {splitArtists(a.stageName).map((name, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-xs bg-noir-700 text-warm-50 border border-noir-600">{name}</span>
                ))}
              </div>
            ) : (
              <p className="text-warm-50 font-medium text-sm mt-1">{a.stageName}</p>
            )}
            <p className="text-gray-400 text-xs truncate mt-1">{a.user.email}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
              <span>{a.genre || 'No genre'}</span>
              <span>{a._count.socialAccounts} socials</span>
              <span>{a.activeCampaigns}/{a._count.campaigns} campaigns</span>
            </div>
            <div className="flex gap-2 mt-3">
              {a.isVerified ? (
                <button onClick={() => onReject(a.id)} disabled={actionLoading === a.id}
                  className="px-3 py-1.5 rounded-lg text-xs border border-gray-600 text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-30">Reject</button>
              ) : (
                <button onClick={() => onVerify(a.id)} disabled={actionLoading === a.id}
                  className="px-3 py-1.5 rounded-lg text-xs border border-green-600 text-green-400 hover:border-green-400 transition-colors disabled:opacity-30">Verify</button>
              )}
              <button onClick={() => handleEditOpen(a)} className="px-3 py-1.5 rounded-lg text-xs border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors">Edit</button>
              <button onClick={() => handleEmailOpen(a)} className="px-3 py-1.5 rounded-lg text-xs border border-cyan-600 text-cyan-400 hover:border-cyan-400 transition-colors">Email</button>
              {a.user.isBanned ? (
                <button onClick={() => onBan(a.id, false)} disabled={actionLoading === a.id}
                  className="px-3 py-1.5 rounded-lg text-xs border border-blue-600 text-blue-400 hover:border-blue-400 transition-colors disabled:opacity-30">Unban</button>
              ) : (
                <button onClick={() => onBan(a.id, true)} disabled={actionLoading === a.id}
                  className="px-3 py-1.5 rounded-lg text-xs border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Ban</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Artists Table */}
      <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-3">Stage Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Genre</th>
              <th className="text-center px-4 py-3">Socials</th>
              <th className="text-center px-4 py-3">Campaigns</th>
              <th className="text-center px-4 py-3">Events</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.artists.map((a) => (
              <tr key={a.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                <td className="px-4 py-3 text-warm-50 max-w-xs">
                  {splitArtists(a.stageName).length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {splitArtists(a.stageName).map((name, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-noir-700 text-warm-50 border border-noir-600">{name}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="whitespace-nowrap">{a.stageName}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">{a.user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {isLikelyEvent(a.stageName) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">Event</span>
                    )}
                    {a.isVerified ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">Verified</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-noir-700 text-gray-400 border border-noir-600">Unverified</span>
                    )}
                    {a.user.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Banned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{a.genre || '\u2014'}</td>
                <td className="px-4 py-3 text-center text-gray-400">{a._count.socialAccounts}</td>
                <td className="px-4 py-3 text-center text-gray-400">{a.activeCampaigns}/{a._count.campaigns}</td>
                <td className="px-4 py-3 text-center text-gray-400">{a._count.events}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    {a.isVerified ? (
                      <button onClick={() => onReject(a.id)} disabled={actionLoading === a.id}
                        className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-gray-600 text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-30">Reject</button>
                    ) : (
                      <button onClick={() => onVerify(a.id)} disabled={actionLoading === a.id}
                        className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-green-600 text-green-400 hover:border-green-400 transition-colors disabled:opacity-30">Verify</button>
                    )}
                    <button onClick={() => handleEditOpen(a)}
                      className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors">Edit</button>
                    <button onClick={() => handleEmailOpen(a)}
                      className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-cyan-600 text-cyan-400 hover:border-cyan-400 transition-colors">Email</button>
                    {a.user.isBanned ? (
                      <button onClick={() => onBan(a.id, false)} disabled={actionLoading === a.id}
                        className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-blue-600 text-blue-400 hover:border-blue-400 transition-colors disabled:opacity-30">Unban</button>
                    ) : (
                      <button onClick={() => onBan(a.id, true)} disabled={actionLoading === a.id}
                        className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Ban</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Artists Pagination */}
      {artists.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => onArtistPageChange(Math.max(1, artistPage - 1))}
            disabled={artistPage <= 1}
            className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
          >
            Prev
          </button>
          <span className="text-gray-500 text-sm px-3">{artistPage} / {artists.totalPages}</span>
          <button
            onClick={() => onArtistPageChange(Math.min(artists.totalPages, artistPage + 1))}
            disabled={artistPage >= artists.totalPages}
            className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Artist Modal */}
      {editingArtist && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setEditingArtist(null)}>
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg tracking-wider text-warm-50 mb-4">EDIT ARTIST</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Stage Name</label>
                <input
                  type="text"
                  value={editForm.stageName}
                  onChange={(e) => setEditForm((f) => ({ ...f, stageName: e.target.value }))}
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Genre</label>
                <input
                  type="text"
                  value={editForm.genre}
                  onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))}
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingArtist(null)}
                className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm hover:border-gray-500 transition-colors">Cancel</button>
              <button onClick={handleEditSave} disabled={actionLoading === editingArtist.id}
                className="px-4 py-2 rounded-lg bg-amber-500 text-noir-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Artist Modal */}
      {emailingArtist && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setEmailingArtist(null)}>
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg tracking-wider text-warm-50 mb-1">EMAIL ARTIST</h3>
            <p className="text-gray-400 text-xs mb-4">To: {emailingArtist.stageName} ({emailingArtist.user.email})</p>
            {emailSent ? (
              <div className="text-center py-8">
                <p className="text-green-400 text-lg font-medium">Email sent!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Email subject..."
                      className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Message</label>
                    <textarea
                      value={emailForm.message}
                      onChange={(e) => setEmailForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Write your message..."
                      rows={5}
                      className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setEmailingArtist(null)}
                    className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm hover:border-gray-500 transition-colors">Cancel</button>
                  <button onClick={handleEmailSend} disabled={emailSending || !emailForm.subject.trim() || !emailForm.message.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50">
                    {emailSending ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
