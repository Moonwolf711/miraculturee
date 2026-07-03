/* ------------------------------------------------------------------
   Integration tests for RegisterPage.
   Covers inline field validation, submit gating, and loading state.
   ------------------------------------------------------------------ */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../test/mocks/server.js';
import { renderWithProviders } from '../test/utils.js';
import RegisterPage from './RegisterPage.js';

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('blocks submit and shows inline errors for every empty field', async () => {
    const registerSpy = vi.fn();
    server.use(
      http.post('/api/auth/register', () => {
        registerSpy();
        return HttpResponse.json({ accessToken: 'a', refreshToken: 'r' });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('shows email format copy on blur with a malformed address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.tab(); // blur

    expect(
      await screen.findByText('Enter a valid email address, like you@example.com.'),
    ).toBeInTheDocument();
  });

  it('shows password length copy on blur and marks the field invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'short');
    await user.tab();

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'register-password-error');
  });

  it('clears the inline error once the field becomes valid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'short');
    await user.tab();
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();

    await user.type(passwordInput, '-but-now-long-enough');
    await waitFor(() =>
      expect(screen.queryByText('Password must be at least 8 characters.')).not.toBeInTheDocument(),
    );
  });

  it('submits valid input and shows the loading spinner state', async () => {
    const registerSpy = vi.fn();
    server.use(
      http.post('/api/auth/register', async () => {
        registerSpy();
        await delay(150);
        return HttpResponse.json({ accessToken: 'a', refreshToken: 'r' });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    await user.type(screen.getByLabelText(/name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // While the request is in flight the button is busy + disabled
    const busyButton = await screen.findByRole('button', { name: /creating account/i });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(registerSpy).toHaveBeenCalledTimes(1));
  });

  it('surfaces a friendly message when the network is unreachable', async () => {
    server.use(http.post('/api/auth/register', () => HttpResponse.error()));

    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { routerProps: { initialEntries: ['/register'] } });

    await user.type(screen.getByLabelText(/name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText('Unable to reach the server. Check your connection and try again.'),
    ).toBeInTheDocument();
  });
});
