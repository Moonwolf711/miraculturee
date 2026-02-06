import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Fan-Powered Ticket Redistribution
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Fans worldwide buy tickets to support artists. Local fans win those tickets
            through fair raffles for just $5. Everyone wins.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/events"
              className="px-6 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100"
            >
              Browse Events
            </Link>
            <Link
              to="/register"
              className="px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold mb-2">Fans Support Artists</h3>
            <p className="text-gray-600 text-sm">
              Fans worldwide purchase tickets at face value to support their favorite artists,
              knowing they won't attend the show.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold mb-2">Local Fans Enter Raffle</h3>
            <p className="text-gray-600 text-sm">
              Fans near the venue enter a fair raffle for just $5. Our geo-verification ensures
              only local fans can participate.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold mb-2">Fair Cryptographic Draw</h3>
            <p className="text-gray-600 text-sm">
              Winners are selected using a cryptographically fair algorithm. Win a ticket
              and enjoy the show!
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
