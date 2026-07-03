/* ------------------------------------------------------------------
   Tests for InfoTooltip — accessible guidance bubble.
   Covers hover, keyboard focus, Escape dismissal (WCAG 1.4.13),
   and tap-to-pin behavior for touch.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InfoTooltip from './Tooltip.js';

function renderTooltip() {
  return render(
    <InfoTooltip label="How Impact points work">
      <p>Support a show +20</p>
    </InfoTooltip>,
  );
}

describe('InfoTooltip', () => {
  it('renders a trigger button with the accessible label and no tooltip initially', () => {
    renderTooltip();
    expect(screen.getByRole('button', { name: 'How Impact points work' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on hover and hides on mouse leave', async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'How Impact points work' });

    await user.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Support a show +20');

    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on keyboard focus and links it via aria-describedby', async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'How Impact points work' });

    await user.tab();
    expect(trigger).toHaveFocus();
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('dismisses with Escape while focused (WCAG 1.4.13)', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('toggles (pins/unpins) on click for touch users', async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'How Impact points work' });

    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Second click unpins; hover/focus from the click sequence are cleared
    // via userEvent so the state updates are act-wrapped and deterministic
    await user.click(trigger);
    await user.unhover(trigger);
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
