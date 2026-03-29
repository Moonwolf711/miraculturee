import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

interface OutreachStats {
  summary: {
    total: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    subscribers: number;
    openRate: number;
    clickRate: number;
  };
  recentOpens: {
    email: string;
    name: string | null;
    openedAt: string;
    clickedAt: string | null;
    opens: number;
    clicks: number;
    status: string;
  }[];
}

function StatCard({ label, value, sub, color = 'amber' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    amber: 'text-amber-500',
    green: 'text-emerald-400',
    blue: 'text-sky-400',
    red: 'text-red-400',
    gray: 'text-gray-400',
  };
  return (
    <div className="bg-noir-900 border border-noir-700 rounded-xl p-5 text-center">
      <p className={`text-3xl font-display ${colors[color] || colors.amber}`}>{value}</p>
      <p className="text-gray-400 text-xs uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function OutreachDashboardPage() {
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<OutreachStats>('/admin/dashboard/outreach-stats')
      .then(setStats)
      .catch(() => setError('Failed to load stats. Make sure you have admin access.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display tracking-wider text-warm-50 mb-4">Outreach Dashboard</h1>
          <p className="text-red-400">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const { summary, recentOpens } = stats;

  return (
    <div className="min-h-screen bg-noir-950 px-4 py-8 sm:py-12">
      <SEO title="Outreach Dashboard" noindex />

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-display tracking-wider text-warm-50 mb-2">Outreach Dashboard</h1>
        <p className="text-gray-500 text-sm mb-8">Email campaign analytics</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Sent" value={summary.total.toLocaleString()} color="gray" />
          <StatCard label="Delivered" value={summary.delivered.toLocaleString()} color="blue" />
          <StatCard label="Opened" value={summary.opened.toLocaleString()} sub={`${summary.openRate}% open rate`} color="green" />
          <StatCard label="Clicked" value={summary.clicked.toLocaleString()} sub={`${summary.clickRate}% click rate`} color="amber" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Bounced" value={summary.bounced} color="red" />
          <StatCard label="Opted In" value={summary.subscribers} sub="subscribed for updates" color="green" />
          <StatCard label="Conversion" value={summary.total > 0 ? `${Math.round((summary.subscribers / summary.total) * 100)}%` : '0%'} sub="sent → subscribed" color="amber" />
        </div>

        {/* Recent Opens */}
        <div className="bg-noir-900 border border-noir-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-noir-700">
            <h2 className="font-display text-sm tracking-wider text-amber-500 uppercase">Recent Opens</h2>
          </div>

          {recentOpens.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No opens tracked yet. Data will appear as recipients open emails.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-noir-800">
                    <th className="px-6 py-3">Recipient</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Opens</th>
                    <th className="px-6 py-3">Clicks</th>
                    <th className="px-6 py-3">Opened At</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOpens.map((r, i) => (
                    <tr key={i} className="border-b border-noir-800/50 hover:bg-noir-800/30 transition-colors">
                      <td className="px-6 py-3">
                        <p className="text-gray-200 font-medium">{r.name || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{r.email}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'clicked' ? 'bg-amber-500/15 text-amber-400' :
                          r.status === 'opened' ? 'bg-emerald-500/15 text-emerald-400' :
                          'bg-gray-500/15 text-gray-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-300">{r.opens}</td>
                      <td className="px-6 py-3 text-gray-300">{r.clicks}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {new Date(r.openedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
