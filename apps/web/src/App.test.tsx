/* ------------------------------------------------------------------
   Tests for App-level navigation behavior (ScrollToTop).
   Forward navigations reset scroll; hash links and history
   back/forward (POP, incl. initial render) are left to the browser.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { renderWithRouter } from './test/utils.js';
import { ScrollToTop } from './App.js';

function NavHarness() {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/events')}>go-events</button>
      <button onClick={() => navigate('/#how-it-works')}>go-hash</button>
      <button onClick={() => navigate(-1)}>go-back</button>
    </div>
  );
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear();
  });

  it('does not scroll on initial render (POP)', () => {
    renderWithRouter(
      <>
        <ScrollToTop />
        <NavHarness />
      </>,
    );
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to top instantly on forward navigation', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <ScrollToTop />
        <NavHarness />
      </>,
    );

    await user.click(screen.getByText('go-events'));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  });

  it('does not force scroll-to-top when navigating to a hash anchor', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <ScrollToTop />
        <NavHarness />
      </>,
    );

    await user.click(screen.getByText('go-hash'));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not force scroll-to-top on back navigation (POP)', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <ScrollToTop />
        <NavHarness />
      </>,
      { initialEntries: ['/', '/events'], initialIndex: 1 },
    );

    await user.click(screen.getByText('go-back'));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
