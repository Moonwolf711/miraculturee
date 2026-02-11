/* ------------------------------------------------------------------
   Custom render utilities for testing with all required providers.
   ------------------------------------------------------------------ */

import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../hooks/useAuth.js';

interface ProvidersProps {
  children: ReactNode;
  routerProps?: MemoryRouterProps;
}

/**
 * Wraps children in all application providers:
 * - MemoryRouter (for react-router)
 * - HelmetProvider (for react-helmet-async)
 * - AuthProvider (for useAuth context)
 */
function AllProviders({ children, routerProps }: ProvidersProps) {
  return (
    <HelmetProvider>
      <MemoryRouter {...routerProps}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Props to pass to MemoryRouter (e.g. initialEntries) */
  routerProps?: MemoryRouterProps;
}

/**
 * Custom render that wraps the component in all required providers.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {},
) {
  const { routerProps, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AllProviders routerProps={routerProps}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Render without AuthProvider — for testing components that don't need auth,
 * or when you want to provide your own auth mock.
 */
export function renderWithRouter(
  ui: React.ReactElement,
  routerProps?: MemoryRouterProps,
) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <HelmetProvider>
        <MemoryRouter {...routerProps}>{children}</MemoryRouter>
      </HelmetProvider>
    ),
  });
}

export { render };
