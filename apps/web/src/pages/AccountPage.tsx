import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

// Atlaskit components
import Avatar from '@atlaskit/avatar';
import Button from '@atlaskit/button/new';
import Form, { Field, FormHeader, FormSection, FormFooter, ErrorMessage, HelperMessage } from '@atlaskit/form';
import Textfield from '@atlaskit/textfield';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import Toggle from '@atlaskit/toggle';
import SectionMessage from '@atlaskit/section-message';
import Lozenge from '@atlaskit/lozenge';
import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';
import { Box, Stack, Inline, Text } from '@atlaskit/primitives';
import { setGlobalTheme } from '@atlaskit/tokens';

interface Passkey {
  id: string;
  friendlyName: string;
  createdAt: string;
}

interface TwoFASetup {
  qrCodeDataUrl: string;
  backupCodes: string[];
}

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (values: { name: string; email: string }) => {
    const changes: Record<string, string> = {};
    if (values.name !== user?.name) changes.name = values.name;
    if (values.email !== user?.email) changes.email = values.email;

    if (Object.keys(changes).length === 0) {
      setMessage({ type: 'error', text: 'No changes to save.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.put('/user/profile', changes);
      await refreshUser();
      setMessage({
        type: 'success',
        text: changes.email
          ? 'Profile updated. Check your new email for a verification link.'
          : 'Profile updated successfully.',
      });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ak-noir-form">
      {message && (
        <div className="mb-4">
          <SectionMessage appearance={message.type === 'success' ? 'success' : 'error'}>
            <p>{message.text}</p>
          </SectionMessage>
        </div>
      )}

      <Form onSubmit={handleSubmit}>
        {({ formProps, submitting }) => (
          <form {...formProps}>
            <FormHeader title="Personal Information" description="Manage your name and email address." />

            <FormSection>
              <Field name="name" label="Display name" isRequired defaultValue={user?.name || ''}>
                {({ fieldProps }) => (
                  <Textfield {...fieldProps} placeholder="Your display name" />
                )}
              </Field>

              <Field
                name="email"
                label="Email address"
                isRequired
                defaultValue={user?.email || ''}
                validate={(value) => {
                  if (!value) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                  return undefined;
                }}
              >
                {({ fieldProps, error }) => (
                  <>
                    <Textfield {...fieldProps} type="email" placeholder="you@example.com" />
                    {error && <ErrorMessage>{error}</ErrorMessage>}
                    <HelperMessage>
                      Changing your email requires re-verification.
                    </HelperMessage>
                  </>
                )}
              </Field>
            </FormSection>

            <FormFooter>
              <Button appearance="primary" type="submit" isLoading={submitting || saving}>
                Save changes
              </Button>
            </FormFooter>
          </form>
        )}
      </Form>
    </div>
  );
}

function SecurityTab() {
  const { refreshUser } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setupData, setSetupData] = useState<TwoFASetup | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ totpEnabled: boolean }>('/auth/2fa/status').catch(() => ({ totpEnabled: false })),
      api.get<Passkey[]>('/auth/passkeys').catch(() => []),
    ]).then(([status, keys]) => {
      setTotpEnabled(status.totpEnabled);
      setPasskeys(keys);
      setLoading(false);
    });
  }, []);

  const handleSetup2FA = async () => {
    setMessage(null);
    setActionLoading(true);
    try {
      const data = await api.post<TwoFASetup>('/auth/2fa/setup', {});
      setSetupData(data);
      setCodesSaved(false);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Setup failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnable2FA = async (values: { code: string }) => {
    setMessage(null);
    setActionLoading(true);
    try {
      await api.post('/auth/2fa/enable', { code: values.code });
      setTotpEnabled(true);
      setSetupData(null);
      setMessage({ type: 'success', text: 'Two-factor authentication enabled!' });
      refreshUser();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Verification failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable2FA = async (values: { code: string }) => {
    setMessage(null);
    setActionLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code: values.code });
      setTotpEnabled(false);
      setShowDisable(false);
      setMessage({ type: 'success', text: 'Two-factor authentication disabled.' });
      refreshUser();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to disable' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterPasskey = async (values: { name: string }) => {
    setMessage(null);
    setActionLoading(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const options = await api.post<Record<string, unknown>>('/auth/passkeys/register/options', {});
      const regResponse = await startRegistration({
        optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      await api.post('/auth/passkeys/register/verify', {
        friendlyName: values.name || 'My Passkey',
        ...regResponse,
      });
      const updated = await api.get<Passkey[]>('/auth/passkeys');
      setPasskeys(updated);
      setMessage({ type: 'success', text: 'Passkey registered!' });
      refreshUser();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await api.delete(`/auth/passkeys/${id}`);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      refreshUser();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <div className="ak-noir-form space-y-6">
      {message && (
        <SectionMessage appearance={message.type === 'success' ? 'success' : 'error'}>
          <p>{message.text}</p>
        </SectionMessage>
      )}

      {/* Two-Factor Authentication */}
      <div className="bg-noir-900/50 border border-noir-700 rounded-xl p-6">
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.050">
            <Heading size="small">Two-Factor Authentication</Heading>
            <Text color="color.text.subtlest">
              Add an extra layer of security with an authenticator app.
            </Text>
          </Stack>
          {totpEnabled && (
            <Lozenge appearance="success" isBold>Enabled</Lozenge>
          )}
        </Inline>

        <div className="mt-4">
          {setupData ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div className="flex justify-center">
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="TOTP QR Code"
                  className="w-48 h-48 rounded-lg bg-white p-2"
                />
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-2 font-medium">Backup codes (save these now!):</p>
                <div className="grid grid-cols-2 gap-2 bg-noir-800 rounded-lg p-4">
                  {setupData.backupCodes.map((code, i) => (
                    <code key={i} className="text-amber-400 text-sm font-mono">{code}</code>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
                    setCodesSaved(true);
                  }}
                  className="mt-2 text-xs text-gray-500 hover:text-amber-400 transition-colors"
                >
                  {codesSaved ? 'Copied!' : 'Copy all codes'}
                </button>
              </div>

              <Form onSubmit={handleEnable2FA}>
                {({ formProps }) => (
                  <form {...formProps}>
                    <Field
                      name="code"
                      label="Enter code to verify"
                      isRequired
                      validate={(v) => (!v || v.length !== 6 ? 'Enter a 6-digit code' : undefined)}
                    >
                      {({ fieldProps, error }) => (
                        <>
                          <Textfield
                            {...fieldProps}
                            placeholder="000000"
                            maxLength={6}
                            autoComplete="one-time-code"
                            elemAfterInput={
                              error ? undefined : undefined
                            }
                          />
                          {error && <ErrorMessage>{error}</ErrorMessage>}
                        </>
                      )}
                    </Field>
                    <div className="flex gap-3 mt-3">
                      <Button appearance="primary" type="submit" isLoading={actionLoading}>
                        Enable 2FA
                      </Button>
                      <Button appearance="subtle" onClick={() => { setSetupData(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Form>
            </div>
          ) : totpEnabled ? (
            showDisable ? (
              <Form onSubmit={handleDisable2FA}>
                {({ formProps }) => (
                  <form {...formProps}>
                    <p className="text-gray-400 text-sm mb-3">Enter your current 2FA code to disable:</p>
                    <Field
                      name="code"
                      label="Verification code"
                      isRequired
                      validate={(v) => (!v || v.length !== 6 ? 'Enter a 6-digit code' : undefined)}
                    >
                      {({ fieldProps, error }) => (
                        <>
                          <Textfield {...fieldProps} placeholder="000000" maxLength={6} autoComplete="one-time-code" />
                          {error && <ErrorMessage>{error}</ErrorMessage>}
                        </>
                      )}
                    </Field>
                    <div className="flex gap-3 mt-3">
                      <Button appearance="danger" type="submit" isLoading={actionLoading}>
                        Disable 2FA
                      </Button>
                      <Button appearance="subtle" onClick={() => setShowDisable(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Form>
            ) : (
              <Button appearance="subtle" onClick={() => setShowDisable(true)}>
                Disable two-factor authentication
              </Button>
            )
          ) : (
            <Button appearance="primary" onClick={handleSetup2FA} isLoading={actionLoading}>
              Set Up 2FA
            </Button>
          )}
        </div>
      </div>

      {/* Passkeys */}
      <div className="bg-noir-900/50 border border-noir-700 rounded-xl p-6">
        <Stack space="space.050">
          <Heading size="small">Passkeys</Heading>
          <Text color="color.text.subtlest">
            Sign in with your fingerprint, face, or security key.
          </Text>
        </Stack>

        {passkeys.length > 0 && (
          <div className="space-y-2 mt-4 mb-4">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between bg-noir-800 rounded-lg p-3">
                <div>
                  <p className="text-gray-200 text-sm font-medium">{pk.friendlyName}</p>
                  <p className="text-gray-500 text-xs">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                </div>
                <Button appearance="subtle" onClick={() => handleDeletePasskey(pk.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Form onSubmit={handleRegisterPasskey}>
            {({ formProps }) => (
              <form {...formProps}>
                <Inline space="space.200" alignBlock="end">
                  <div className="flex-1">
                    <Field name="name" label="Passkey name" defaultValue="">
                      {({ fieldProps }) => (
                        <Textfield {...fieldProps} placeholder="e.g. MacBook Touch ID" />
                      )}
                    </Field>
                  </div>
                  <Button appearance="primary" type="submit" isLoading={actionLoading}>
                    Add Passkey
                  </Button>
                </Inline>
              </form>
            )}
          </Form>
        </div>
      </div>

      {/* Password */}
      <div className="bg-noir-900/50 border border-noir-700 rounded-xl p-6">
        <Stack space="space.050">
          <Heading size="small">Change Password</Heading>
          <Text color="color.text.subtlest">
            Update your password to keep your account secure.
          </Text>
        </Stack>

        <div className="mt-4">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.put('/user/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setMessage({ type: 'success', text: 'Password updated successfully.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {message && (
        <div className="mb-4">
          <SectionMessage appearance={message.type === 'success' ? 'success' : 'error'}>
            <p>{message.text}</p>
          </SectionMessage>
        </div>
      )}
      <Form onSubmit={handleSubmit}>
        {({ formProps, submitting }) => (
          <form {...formProps}>
            <Field name="currentPassword" label="Current password" isRequired defaultValue="">
              {({ fieldProps }) => (
                <Textfield {...fieldProps} type="password" autoComplete="current-password" />
              )}
            </Field>
            <Field
              name="newPassword"
              label="New password"
              isRequired
              defaultValue=""
              validate={(v) => (v && v.length < 8 ? 'At least 8 characters' : undefined)}
            >
              {({ fieldProps, error }) => (
                <>
                  <Textfield {...fieldProps} type="password" autoComplete="new-password" />
                  {error && <ErrorMessage>{error}</ErrorMessage>}
                </>
              )}
            </Field>
            <Field name="confirmPassword" label="Confirm new password" isRequired defaultValue="">
              {({ fieldProps }) => (
                <Textfield {...fieldProps} type="password" autoComplete="new-password" />
              )}
            </Field>
            <FormFooter>
              <Button appearance="primary" type="submit" isLoading={submitting || saving}>
                Update Password
              </Button>
            </FormFooter>
          </form>
        )}
      </Form>
    </>
  );
}

function PreferencesTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [raffleAlerts, setRaffleAlerts] = useState(true);
  const [artistUpdates, setArtistUpdates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get<{
      emailNotifications: boolean;
      raffleAlerts: boolean;
      artistUpdates: boolean;
    }>('/user/preferences')
      .then((prefs) => {
        setEmailNotifications(prefs.emailNotifications);
        setRaffleAlerts(prefs.raffleAlerts);
        setArtistUpdates(prefs.artistUpdates);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/user/preferences', {
        emailNotifications,
        raffleAlerts,
        artistUpdates,
      });
      setMessage({ type: 'success', text: 'Preferences saved.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ak-noir-form space-y-6">
      {message && (
        <SectionMessage appearance={message.type === 'success' ? 'success' : 'error'}>
          <p>{message.text}</p>
        </SectionMessage>
      )}

      <div className="bg-noir-900/50 border border-noir-700 rounded-xl p-6">
        <Stack space="space.050">
          <Heading size="small">Notifications</Heading>
          <Text color="color.text.subtlest">
            Choose what updates you want to receive.
          </Text>
        </Stack>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-gray-200 text-sm font-medium">Email Notifications</p>
              <p className="text-gray-500 text-xs">Receive email updates about your account activity.</p>
            </div>
            <Toggle
              id="email-notifications"
              isChecked={emailNotifications}
              onChange={() => setEmailNotifications(!emailNotifications)}
            />
          </div>

          <div className="border-t border-noir-700" />

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-gray-200 text-sm font-medium">Raffle Alerts</p>
              <p className="text-gray-500 text-xs">Get notified when raffles open, close, or when you win.</p>
            </div>
            <Toggle
              id="raffle-alerts"
              isChecked={raffleAlerts}
              onChange={() => setRaffleAlerts(!raffleAlerts)}
            />
          </div>

          <div className="border-t border-noir-700" />

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-gray-200 text-sm font-medium">Artist Updates</p>
              <p className="text-gray-500 text-xs">Hear from artists you've supported with new shows and campaigns.</p>
            </div>
            <Toggle
              id="artist-updates"
              isChecked={artistUpdates}
              onChange={() => setArtistUpdates(!artistUpdates)}
            />
          </div>
        </div>

        <div className="mt-6">
          <Button appearance="primary" onClick={handleSave} isLoading={saving}>
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, { label: string; appearance: 'default' | 'success' | 'inprogress' | 'moved' | 'new' }> = {
  USER: { label: 'Fan', appearance: 'default' },
  ARTIST: { label: 'Artist', appearance: 'success' },
  AGENT: { label: 'Agent', appearance: 'inprogress' },
  DEVELOPER: { label: 'Developer', appearance: 'moved' },
  ADMIN: { label: 'Admin', appearance: 'new' },
};

export default function AccountPage() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState(0);

  // Activate Atlaskit dark theme on mount
  useEffect(() => {
    setGlobalTheme({ colorMode: 'dark' });
  }, []);

  const handleTabChange = useCallback((index: number) => {
    setSelected(index);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  if (!user) return null;

  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.USER;

  return (
    <div className="min-h-screen bg-noir-950 ak-noir-override">
      <SEO title="Account Settings" description="Manage your MiraCulture account settings, security, and preferences." noindex />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Profile Header */}
        <div className="bg-noir-900 border border-noir-700 rounded-xl p-6 mb-8">
          <Inline space="space.200" alignBlock="center">
            <Avatar
              name={user.name}
              size="xlarge"
              appearance="circle"
            />
            <Stack space="space.050">
              <h1 className="text-2xl font-display tracking-wide text-warm-50">
                {user.name}
              </h1>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <Inline space="space.100">
                <Lozenge appearance={roleInfo.appearance} isBold>
                  {roleInfo.label}
                </Lozenge>
                {user.emailVerified ? (
                  <Lozenge appearance="success">Verified</Lozenge>
                ) : (
                  <Lozenge appearance="moved">Unverified</Lozenge>
                )}
                {user.totpEnabled && (
                  <Lozenge appearance="inprogress">2FA</Lozenge>
                )}
                {user.passkeyCount > 0 && (
                  <Lozenge appearance="default">
                    {user.passkeyCount} Passkey{user.passkeyCount !== 1 ? 's' : ''}
                  </Lozenge>
                )}
              </Inline>
            </Stack>
          </Inline>
        </div>

        {/* Tabs */}
        <div className="bg-noir-900 border border-noir-700 rounded-xl overflow-hidden">
          <Tabs id="account-tabs" onChange={handleTabChange} selected={selected}>
            <TabList>
              <Tab>Profile</Tab>
              <Tab>Security</Tab>
              <Tab>Preferences</Tab>
            </TabList>
            <TabPanel>
              <div className="p-6">
                <ProfileTab />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="p-6">
                <SecurityTab />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="p-6">
                <PreferencesTab />
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
