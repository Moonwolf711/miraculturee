import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function SecuritySettings() {
  const { user, refreshUser } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled ?? false);
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [passkeys, setPasskeys] = useState<{ id: string; friendlyName: string; createdAt: string }[]>([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codesSaved, setCodesSaved] = useState(false);

  useEffect(() => {
    api.get<{ totpEnabled: boolean }>('/auth/2fa/status').then((r) => setTotpEnabled(r.totpEnabled)).catch(() => {});
    api.get<{ id: string; friendlyName: string; createdAt: string }[]>('/auth/passkeys').then(setPasskeys).catch(() => {});
  }, []);

  const handleSetup2FA = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await api.post<{ qrCodeDataUrl: string; backupCodes: string[] }>('/auth/2fa/setup', {});
      setSetupData(data);
      setCodesSaved(false);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleEnable2FA = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/2fa/enable', { code: verifyCode });
      setTotpEnabled(true);
      setSetupData(null);
      setVerifyCode('');
      setSuccess('Two-factor authentication enabled!');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDisable2FA = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code: disableCode });
      setTotpEnabled(false);
      setShowDisable(false);
      setDisableCode('');
      setSuccess('Two-factor authentication disabled.');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRegisterPasskey = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const options = await api.post<any>('/auth/passkeys/register/options', {});
      const regResponse = await startRegistration({ optionsJSON: options });
      await api.post('/auth/passkeys/register/verify', { friendlyName: passkeyName || 'My Passkey', ...regResponse });
      setPasskeyName('');
      const updated = await api.get<{ id: string; friendlyName: string; createdAt: string }[]>('/auth/passkeys');
      setPasskeys(updated);
      setSuccess('Passkey registered!');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await api.delete(`/auth/passkeys/${id}`);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      refreshUser();
    } catch (err: any) { setError(err.message); }
  };

  const copyBackupCodes = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCodesSaved(true);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">{success}</div>
      )}

      <div className="bg-noir-900 border border-noir-800 rounded-xl p-6">
        <h3 className="text-warm-50 font-semibold text-lg mb-1">Two-Factor Authentication</h3>
        <p className="text-gray-500 text-sm mb-4">Add an extra layer of security with an authenticator app.</p>

        {setupData ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
            <div className="flex justify-center">
              <img src={setupData.qrCodeDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Backup codes (save these now!):</p>
              <div className="grid grid-cols-2 gap-2 bg-noir-800 rounded-lg p-4">
                {setupData.backupCodes.map((code, i) => (
                  <code key={i} className="text-amber-400 text-sm font-mono">{code}</code>
                ))}
              </div>
              <button onClick={copyBackupCodes} className="mt-2 text-xs text-gray-500 hover:text-amber-400 transition-colors">
                {codesSaved ? 'Copied!' : 'Copy all codes'}
              </button>
            </div>
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Enter code to verify</label>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code"
                value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000" maxLength={6}
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center text-xl tracking-[0.3em] font-mono"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleEnable2FA} disabled={loading || verifyCode.length !== 6} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors">
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
              <button onClick={() => { setSetupData(null); setVerifyCode(''); }} className="px-4 py-2.5 bg-noir-800 text-gray-400 rounded-lg hover:text-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : totpEnabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 text-sm font-medium">Enabled</span>
            </div>
            {showDisable ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">Enter your current 2FA code to disable:</p>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="000000" maxLength={6} className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center text-xl tracking-[0.3em] font-mono" />
                <div className="flex gap-3">
                  <button onClick={handleDisable2FA} disabled={loading || disableCode.length !== 6} className="flex-1 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                    {loading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                  <button onClick={() => { setShowDisable(false); setDisableCode(''); }} className="px-4 py-2.5 bg-noir-800 text-gray-400 rounded-lg hover:text-gray-200 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDisable(true)} className="text-sm text-gray-500 hover:text-red-400 transition-colors">Disable two-factor authentication</button>
            )}
          </div>
        ) : (
          <button onClick={handleSetup2FA} disabled={loading} className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {loading ? 'Setting up...' : 'Set Up 2FA'}
          </button>
        )}
      </div>

      <div className="bg-noir-900 border border-noir-800 rounded-xl p-6">
        <h3 className="text-warm-50 font-semibold text-lg mb-1">Passkeys</h3>
        <p className="text-gray-500 text-sm mb-4">Sign in with your fingerprint, face, or security key instead of a password.</p>

        {passkeys.length > 0 && (
          <div className="space-y-2 mb-4">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between bg-noir-800 rounded-lg p-3">
                <div>
                  <p className="text-gray-200 text-sm font-medium">{pk.friendlyName}</p>
                  <p className="text-gray-500 text-xs">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDeletePasskey(pk.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Passkey name</label>
            <input type="text" value={passkeyName} onChange={(e) => setPasskeyName(e.target.value)} placeholder="e.g. MacBook Touch ID" className="w-full px-4 py-2.5 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm placeholder-gray-600" />
          </div>
          <button onClick={handleRegisterPasskey} disabled={loading} className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm whitespace-nowrap">
            {loading ? 'Registering...' : 'Add Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}
