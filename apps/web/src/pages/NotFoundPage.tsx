import { Link } from 'react-router-dom';
import SEO from '../components/SEO.js';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
      <SEO title="Page Not Found" description="The page you are looking for does not exist." noindex />
      <div className="text-center max-w-md">
        {/* Large 404 */}
        <p className="font-display text-8xl tracking-wider text-amber-500/20 mb-2 select-none">
          404
        </p>

        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-3">
          PAGE NOT FOUND
        </h1>
        <p className="font-body text-gray-400 text-sm mb-8 leading-relaxed">
          The page you are looking for doesn't exist or may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm tracking-wide uppercase"
          >
            Go Home
          </Link>
          <Link
            to="/events"
            className="px-6 py-2.5 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600 font-medium rounded-lg transition-colors text-sm"
          >
            Browse Events
          </Link>
        </div>
      </div>
    </div>
  );
}
