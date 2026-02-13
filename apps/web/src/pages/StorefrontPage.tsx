import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

interface ProductPrice {
  id: string;
  unitAmount: number;
  currency: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  defaultPrice: ProductPrice | null;
}

export default function StorefrontPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await api.get<{ products: Product[] }>(
        `/connect/storefront/${accountId}/products`,
      );
      setProducts(res.products);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleBuy = async (product: Product) => {
    if (!accountId || !product.defaultPrice) return;
    setBuyingId(product.id);
    try {
      const res = await api.post<{ url: string }>(
        `/connect/storefront/${accountId}/checkout`,
        {
          priceId: product.defaultPrice.id,
          quantity: 1,
        },
      );
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout.');
      setBuyingId(null);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="h-8 w-48 bg-noir-800 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-noir-800 rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-2">
          STOREFRONT
        </h1>
        <p className="text-gray-400 text-sm font-body mb-8">
          Browse and purchase products from this creator.
        </p>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-300 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Empty state */}
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-noir-800 border border-noir-700 rounded-xl">
            <div className="w-14 h-14 rounded-full border-2 border-noir-700 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO PRODUCTS YET
            </h3>
            <p className="text-gray-400 text-sm font-body">
              This creator hasn't added any products yet.
            </p>
          </div>
        )}

        {/* Product Grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-noir-800 border border-noir-700 rounded-xl overflow-hidden hover:border-amber-500/30 transition-colors"
              >
                {/* Product Image */}
                {product.images.length > 0 ? (
                  <div className="aspect-video bg-noir-900">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-noir-900 flex items-center justify-center">
                    <svg className="w-10 h-10 text-noir-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </div>
                )}

                {/* Product Info */}
                <div className="p-5">
                  <h3 className="text-warm-50 font-medium text-lg mb-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-gray-400 text-sm font-body mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-display text-xl text-amber-400">
                      {product.defaultPrice
                        ? formatPrice(product.defaultPrice.unitAmount, product.defaultPrice.currency)
                        : 'N/A'}
                    </span>
                    <button
                      onClick={() => handleBuy(product)}
                      disabled={buyingId === product.id || !product.defaultPrice}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-noir-700 disabled:text-gray-500 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
                    >
                      {buyingId === product.id ? 'Redirecting...' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
