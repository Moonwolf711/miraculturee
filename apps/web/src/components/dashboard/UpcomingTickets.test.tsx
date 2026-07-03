/* ------------------------------------------------------------------
   Tests for the shared dashboard EmptyState.
   Verifies message/hint/CTA rendering and backward compatibility
   with the original (message-only) call signature.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils.js';
import { EmptyState } from './UpcomingTickets.js';

describe('EmptyState', () => {
  it('renders message, hint, and a CTA link', () => {
    renderWithProviders(
      <EmptyState
        message="No raffle entries yet."
        hint="Enter for $5 on any event page."
        ctaText="Find a Raffle"
        ctaLink="/events"
      />,
    );
    expect(screen.getByText('No raffle entries yet.')).toBeInTheDocument();
    expect(screen.getByText('Enter for $5 on any event page.')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Find a Raffle' });
    expect(cta).toHaveAttribute('href', '/events');
  });

  it('supports the original message-only signature (no hint, no CTA)', () => {
    renderWithProviders(<EmptyState message="No transactions yet." />);
    expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an optional icon container marked decorative', () => {
    const { container } = renderWithProviders(
      <EmptyState message="Empty." icon={<svg data-testid="empty-icon" />} />,
    );
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    const iconWrap = container.querySelector('[aria-hidden="true"]');
    expect(iconWrap).not.toBeNull();
  });
});
