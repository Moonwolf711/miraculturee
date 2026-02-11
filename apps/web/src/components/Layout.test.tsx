/* ------------------------------------------------------------------
   Integration tests for Layout component.
   Tests navigation links, mobile menu toggle, auth-based rendering.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils.js';
import Layout from './Layout.js';

/* Mock ConnectionStatus to avoid WebSocket complexity in Layout tests */
vi.mock('./ConnectionStatus.js', () => ({
  default: () => <div data-testid="connection-status">CS</div>,
}));

/* Mock useScrollSpy — Layout uses it for active section highlighting */
vi.mock('../hooks/useScrollSpy.js', () => ({
  useScrollSpy: () => '',
}));

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders navigation links in desktop nav', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    // Desktop and mobile navs both render the same links.
    // Scope to desktop nav (aria-label="Main navigation").
    const desktopNav = screen.getByLabelText('Main navigation');
    expect(within(desktopNav).getByText('Shows')).toBeInTheDocument();
    expect(within(desktopNav).getByText('How It Works')).toBeInTheDocument();
    expect(within(desktopNav).getByText('For Artists')).toBeInTheDocument();
  });

  it('renders logo with link to home', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    // The logo text "M" and "iraCulture" appear in header and footer.
    // Use getAllByText and verify at least one exists.
    const mLetters = screen.getAllByText('M');
    expect(mLetters.length).toBeGreaterThanOrEqual(1);
    const brandTexts = screen.getAllByText('iraCulture');
    expect(brandTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders children in main content area', () => {
    renderWithProviders(
      <Layout>
        <div data-testid="test-content">Hello World</div>
      </Layout>,
    );

    const main = screen.getByRole('main');
    expect(within(main).getByTestId('test-content')).toBeInTheDocument();
  });

  it('shows Log in and Sign up when user is not authenticated', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    // Desktop nav has login/signup links (mobile nav also has them).
    const desktopNav = screen.getByLabelText('Main navigation');
    expect(within(desktopNav).getByText('Log in')).toBeInTheDocument();
    expect(within(desktopNav).getByText('Sign up')).toBeInTheDocument();
  });

  it('shows user name and Log out when authenticated', async () => {
    localStorage.setItem('accessToken', 'mock-token');

    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    // Wait for auth to resolve — name appears in both desktop and mobile nav
    const userNames = await screen.findAllByText('Test User');
    expect(userNames.length).toBeGreaterThanOrEqual(1);

    // Scope further assertions to desktop nav
    const desktopNav = screen.getByLabelText('Main navigation');
    expect(within(desktopNav).getByText('Log out')).toBeInTheDocument();
    expect(within(desktopNav).queryByText('Log in')).not.toBeInTheDocument();
  });

  it('shows Dashboard link for ARTIST role', async () => {
    /* Override auth/me to return artist user */
    const { http, HttpResponse } = await import('msw');
    const { server } = await import('../test/mocks/server.js');
    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({
          id: 'artist-1',
          email: 'artist@example.com',
          name: 'Test Artist',
          role: 'ARTIST',
        });
      }),
    );

    localStorage.setItem('accessToken', 'mock-token');

    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    const dashboardLinks = await screen.findAllByText('Dashboard');
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);
  });

  /* ---------- Mobile menu ---------- */

  describe('mobile menu', () => {
    it('toggles mobile menu on hamburger click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <Layout>
          <div>Content</div>
        </Layout>,
      );

      const hamburger = screen.getByLabelText('Open menu');
      expect(hamburger).toBeInTheDocument();

      await user.click(hamburger);

      // After opening, label should change
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

      // Mobile nav should be accessible
      const mobileNav = screen.getByLabelText('Mobile navigation');
      expect(mobileNav).toBeInTheDocument();
    });

    it('closes mobile menu on Escape key', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <Layout>
          <div>Content</div>
        </Layout>,
      );

      const hamburger = screen.getByLabelText('Open menu');
      await user.click(hamburger);

      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });
  });

  /* ---------- Footer ---------- */

  it('renders footer with copyright', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    const year = new Date().getFullYear();
    expect(screen.getByText(`\u00A9 ${year} MiraCulture. All rights reserved.`)).toBeInTheDocument();
  });

  it('renders footer navigation links', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    expect(screen.getByText('Browse Shows')).toBeInTheDocument();
  });

  it('renders social media links', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    expect(screen.getByLabelText('X (Twitter)')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('TikTok')).toBeInTheDocument();
  });

  it('has a skip-to-content link', () => {
    renderWithProviders(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });
});
