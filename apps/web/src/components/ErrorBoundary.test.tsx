/* ------------------------------------------------------------------
   Integration tests for ErrorBoundary component.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../test/utils.js';
import ErrorBoundary, { PageErrorFallback } from './ErrorBoundary.js';

/* Component that deliberately throws */
function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

/* Suppress console.error from ErrorBoundary — expected in these tests */
const originalConsoleError = console.error;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    renderWithRouter(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('catches render errors and shows default fallback', () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('SOMETHING WENT WRONG')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
  });

  it('shows label in default fallback when provided', () => {
    renderWithRouter(
      <ErrorBoundary label="Payment">
        <ThrowingComponent message="Stripe error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Payment — SOMETHING WENT WRONG')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    renderWithRouter(
      <ErrorBoundary
        fallback={({ error }) => <div data-testid="custom">Custom: {error.message}</div>}
      >
        <ThrowingComponent message="Custom error" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.getByText('Custom: Custom error')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalThrow() {
      if (shouldThrow) throw new Error('Temporary error');
      return <div>Recovered</div>;
    }

    renderWithRouter(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('SOMETHING WENT WRONG')).toBeInTheDocument();

    // Fix the error before retry
    shouldThrow = false;
    await user.click(screen.getByText('Try Again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn();

    renderWithRouter(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent message="Callback test" />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Callback test' }),
      expect.anything(),
    );
  });
});

describe('PageErrorFallback', () => {
  it('renders error message and Try Again button', () => {
    const reset = vi.fn();
    renderWithRouter(
      <PageErrorFallback error={new Error('Page crash')} reset={reset} />,
    );

    expect(screen.getByText('SOMETHING WENT WRONG')).toBeInTheDocument();
    expect(screen.getByText('Page crash')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('calls reset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    renderWithRouter(
      <PageErrorFallback error={new Error('test')} reset={reset} />,
    );

    await user.click(screen.getByText('Try Again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
