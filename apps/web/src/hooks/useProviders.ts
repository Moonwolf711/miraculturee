import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

interface Providers {
  google: boolean;
  facebook: boolean;
  apple: boolean;
  microsoft: boolean;
  tidal: boolean;
}

const defaultProviders: Providers = { google: false, facebook: false, apple: false, microsoft: false, tidal: false };

let cachedProviders: Providers | null = null;

export function useProviders() {
  const [providers, setProviders] = useState<Providers>(cachedProviders ?? defaultProviders);

  useEffect(() => {
    if (cachedProviders) return;
    api.get<Providers>('/auth/providers')
      .then((data) => {
        cachedProviders = data;
        setProviders(data);
      })
      .catch(() => {});
  }, []);

  const hasSocial = providers.google || providers.facebook || providers.apple || providers.microsoft;
  return { providers, hasSocial };
}
