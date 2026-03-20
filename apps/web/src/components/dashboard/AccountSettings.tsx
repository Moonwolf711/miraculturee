import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const clearMessages = () => { setSuccess(''); setError(''); };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const changes: Record<string, string> = {};
    if (name !== user?.name) changes.name = name;
    if (email !== user?.email) changes.email = email;

    if (Object.keys(changes).length === 0) {
      setError('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await api.put('/user/profile', changes);
      await refreshUser();
      setSuccess(
        changes.email
          ? 'Profile updated. Please check your new email for a verification link.'
          : 'Profile updated successfully.',
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/user/password', { currentPassword, newPassword });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Profile Section */}
      <form onSubmit={handleSaveProfile} className="bg-noir-900 border border-noir-700 rounded-xl p-6">
        <h3 className="font-display text-sm tracking-wider text-amber-500 uppercase mb-4">Profile</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
            />
            {email !== user?.email && (
              <p className="text-amber-500/80 text-xs mt-1.5">
                Changing your email will require re-verification.
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Password Section */}
      <form onSubmit={handleChangePassword} className="bg-noir-900 border border-noir-700 rounded-xl p-6">
        <h3 className="font-display text-sm tracking-wider text-amber-500 uppercase mb-4">Change Password</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
