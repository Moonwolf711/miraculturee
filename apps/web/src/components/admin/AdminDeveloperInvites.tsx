import { useState } from 'react';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface DeveloperItem {
  id: string;
  email: string;
  name: string;
  permission: string;
  invitedBy: { name: string; email: string } | null;
  joinedAt: string;
}

interface DevInviteItem {
  id: string;
  email: string;
  permission: string;
  invitedBy: { name: string; email: string };
  expiresAt: string;
  createdAt: string;
}

interface AdminDeveloperInvitesProps {
  developers: DeveloperItem[];
  devInvites: DevInviteItem[];
  actionLoading: string | null;
  onInviteDev: (form: { email: string; permission: string }) => Promise<void>;
  onCancelInvite: (id: string) => void;
  onResendInvite: (id: string) => void;
  onRevokeDev: (id: string) => void;
}

export default function AdminDeveloperInvites({
  developers,
  devInvites,
  actionLoading,
  onInviteDev,
  onCancelInvite,
  onResendInvite,
  onRevokeDev,
}: AdminDeveloperInvitesProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', permission: 'LIMITED' });
  const [inviteSending, setInviteSending] = useState(false);

  const handleInviteDev = async () => {
    if (!inviteForm.email.trim()) return;
    setInviteSending(true);
    try {
      await onInviteDev(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', permission: 'LIMITED' });
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-500 text-xs uppercase tracking-wider">
          {developers.length} active developer{developers.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => { setShowInviteModal(true); setInviteForm({ email: '', permission: 'LIMITED' }); }}
          className="px-4 py-2 rounded-lg bg-amber-500 text-noir-950 text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          Invite Developer
        </button>
      </div>

      {/* Active Developers */}
      {developers.length > 0 && (
        <>
          <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">ACTIVE DEVELOPERS</h2>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden mb-6">
            {developers.map((d) => (
              <div key={d.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-warm-50 font-medium text-sm truncate mr-2">{d.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                    d.permission === 'FULL'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-noir-700 text-gray-400 border border-noir-600'
                  }`}>{d.permission}</span>
                </div>
                <p className="text-gray-400 text-xs truncate">{d.email}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                  <span>{d.invitedBy ? `By ${d.invitedBy.name}` : '\u2014'}</span>
                  <span>{formatDate(d.joinedAt)}</span>
                </div>
                <div className="mt-3">
                  <button onClick={() => onRevokeDev(d.id)} disabled={actionLoading === d.id}
                    className="px-3 py-1.5 rounded-lg text-xs border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Revoke</button>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Permission</th>
                  <th className="text-left px-4 py-3">Invited By</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {developers.map((d) => (
                  <tr key={d.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                    <td className="px-4 py-3 text-warm-50 whitespace-nowrap">{d.name}</td>
                    <td className="px-4 py-3 text-gray-400">{d.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                        d.permission === 'FULL'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-noir-700 text-gray-400 border border-noir-600'
                      }`}>{d.permission}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{d.invitedBy?.name ?? '\u2014'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(d.joinedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onRevokeDev(d.id)} disabled={actionLoading === d.id}
                        className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pending Invites */}
      {devInvites.length > 0 && (
        <>
          <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">PENDING INVITES</h2>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden mb-6">
            {devInvites.map((inv) => (
              <div key={inv.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-warm-50 font-medium text-sm truncate mr-2">{inv.email}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                    inv.permission === 'FULL'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-noir-700 text-gray-400 border border-noir-600'
                  }`}>{inv.permission}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                  <span>By {inv.invitedBy.name}</span>
                  <span>Expires {formatDate(inv.expiresAt)}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => onResendInvite(inv.id)} disabled={actionLoading === inv.id}
                    className="px-3 py-1.5 rounded-lg text-xs border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors disabled:opacity-30">Resend</button>
                  <button onClick={() => onCancelInvite(inv.id)} disabled={actionLoading === inv.id}
                    className="px-3 py-1.5 rounded-lg text-xs border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Cancel</button>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Permission</th>
                  <th className="text-left px-4 py-3">Invited By</th>
                  <th className="text-left px-4 py-3">Sent</th>
                  <th className="text-left px-4 py-3">Expires</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devInvites.map((inv) => (
                  <tr key={inv.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                    <td className="px-4 py-3 text-warm-50">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                        inv.permission === 'FULL'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-noir-700 text-gray-400 border border-noir-600'
                      }`}>{inv.permission}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{inv.invitedBy.name}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(inv.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => onResendInvite(inv.id)} disabled={actionLoading === inv.id}
                          className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors disabled:opacity-30">Resend</button>
                        <button onClick={() => onCancelInvite(inv.id)} disabled={actionLoading === inv.id}
                          className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {developers.length === 0 && devInvites.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No developers yet. Invite your first developer to get started.</p>
        </div>
      )}

      {/* Invite Developer Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg tracking-wider text-warm-50 mb-4">INVITE DEVELOPER</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="developer@example.com"
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Permission Level</label>
                <select
                  value={inviteForm.permission}
                  onChange={(e) => setInviteForm((f) => ({ ...f, permission: e.target.value }))}
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="LIMITED">Limited</option>
                  <option value="FULL">Full</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm hover:border-gray-500 transition-colors">Cancel</button>
              <button onClick={handleInviteDev} disabled={inviteSending || !inviteForm.email.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 text-noir-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50">
                {inviteSending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
