const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface Analytics {
  users: {
    total: number;
    last30d: number;
    last7d: number;
    verified: number;
    byRole: { role: string; count: number }[];
  };
  events: { total: number; upcoming: number };
  support: { totalTickets: number; revenueCents: number; last30d: number };
  raffleEntries: number;
  directTickets: number;
  recentSignups: { id: string; email: string; name: string; role: string; createdAt: string }[];
}

interface AdminAnalyticsProps {
  analytics: Analytics;
}

export default function AdminAnalytics({ analytics }: AdminAnalyticsProps) {
  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Total Users', value: analytics.users.total, color: 'text-warm-50' },
          { label: 'Last 7 Days', value: analytics.users.last7d, color: 'text-green-400' },
          { label: 'Last 30 Days', value: analytics.users.last30d, color: 'text-warm-50' },
          { label: 'Verified', value: analytics.users.verified, color: 'text-warm-50' },
          { label: 'Total Events', value: analytics.events.total, color: 'text-warm-50' },
          { label: 'Upcoming', value: analytics.events.upcoming, color: 'text-amber-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-noir-800 border border-noir-700 rounded-xl p-3 sm:p-4">
            <div className={`font-display text-xl sm:text-2xl ${stat.color}`}>{stat.value.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Revenue', value: formatPrice(analytics.support.revenueCents), color: 'text-amber-400' },
          { label: 'Support Tickets', value: analytics.support.totalTickets, color: 'text-warm-50' },
          { label: 'Raffle Entries', value: analytics.raffleEntries, color: 'text-warm-50' },
          { label: 'Direct Tickets', value: analytics.directTickets, color: 'text-warm-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-noir-800 border border-noir-700 rounded-xl p-3 sm:p-4">
            <div className={`font-display text-xl sm:text-2xl ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Users by Role */}
      <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">USERS BY ROLE</h2>
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
        {analytics.users.byRole.map((r) => (
          <div key={r.role} className="bg-noir-800 border border-noir-700 rounded-xl px-3 py-2 sm:px-5 sm:py-3">
            <span className="font-display text-lg sm:text-xl text-warm-50">{r.count.toLocaleString()}</span>
            <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider ml-2">{r.role}</span>
          </div>
        ))}
      </div>

      {/* Recent Signups -- cards on mobile, table on md+ */}
      <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">RECENT SIGNUPS</h2>
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {analytics.recentSignups.map((u) => (
          <div key={u.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-warm-50 font-medium text-sm truncate mr-2">{u.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400'
                  : u.role === 'DEVELOPER' ? 'bg-cyan-500/10 text-cyan-400'
                    : 'bg-noir-700 text-gray-400'
              }`}>{u.role}</span>
            </div>
            <p className="text-gray-400 text-xs truncate">{u.email}</p>
            <p className="text-gray-500 text-[10px] mt-1">{formatDate(u.createdAt)}</p>
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {analytics.recentSignups.map((u) => (
              <tr key={u.id} className="border-b border-noir-700/50 last:border-0">
                <td className="px-4 py-3 text-warm-50">{u.name}</td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400'
                  : u.role === 'DEVELOPER' ? 'bg-cyan-500/10 text-cyan-400'
                    : 'bg-noir-700 text-gray-400'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
