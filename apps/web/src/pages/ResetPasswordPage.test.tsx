/* ------------------------------------------------------------------
   Integration tests for ResetPasswordPage.
   Covers inline password policy + live confirm-match validation.
   ------------------------------------------------------------------ */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { renderWithProviders } from '../test/utils.js';
import ResetPasswordPage from './ResetPasswordPage.js';

const ROUTE = ['/reset-password?token=tok-123'];

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows an invalid-link state when the token is missing', () => {
    renderWithProviders(<ResetPasswordPage />, {
      routerProps: { initialEntries: ['/reset-password'] },
    });
    expect(screen.getByText('Invalid reset link.')).toBeInTheDocument();
  });

  it('shows the mismatch error inline at the confirm field, not the banner', async () => {
    const resetSpy = vi.fn();
    server.use(
      http.post('/api/auth/reset-password', () => {
        resetSpy();
        return HttpResponse.json({ accessToken: 'a', refreshToken: 'r' });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { routerProps: { initialEntries: ROUTE } });

    await user.type(screen.getByLabelText(/new password/i), 'first-password');
    await user.type(screen.getByLabelText(/confirm password/i), 'different-password');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    const confirmInput = screen.getByLabelText(/confirm password/i);
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
    expect(confirmInput).toHaveAttribute('aria-describedby', 'reset-confirm-error');
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it('clears the mismatch error live as the confirm value is corrected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { routerProps: { initialEntries: ROUTE } });

    await user.type(screen.getByLabelText(/new password/i), 'matching-pass');
    const confirmInput = screen.getByLabelText(/confirm password/i);
    await user.type(confirmInput, 'matching-');
    await user.tab();
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();

    await user.type(confirmInput, 'pass');
    await waitFor(() =>
      expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument(),
    );
  });

  it('enforces the password policy inline before submitting', async () => {
    const resetSpy = vi.fn();
    server.use(
      http.post('/api/auth/reset-password', () => {
        resetSpy();
        return HttpResponse.json({ accessToken: 'a', refreshToken: 'r' });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { routerProps: { initialEntries: ROUTE } });

    await user.type(screen.getByLabelText(/new password/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it('submits matching valid passwords and stores the returned tokens', async () => {
    server.use(
      http.post('/api/auth/reset-password', () =>
        HttpResponse.json({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { routerProps: { initialEntries: ROUTE } });

    await user.type(screen.getByLabelText(/new password/i), 'a-strong-password');
    await user.type(screen.getByLabelText(/confirm password/i), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBe('new-access');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    });
  });
});
