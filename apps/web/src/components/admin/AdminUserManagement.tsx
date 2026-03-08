const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  city: string | null;
  emailVerified: boolean;
  createdAt: string;
  _count: { supportTickets: number; raffleEntries: number; notifications: number };
}

interface UsersResponse {
  users: UserItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminUserManagementProps {
  users: UsersResponse;
  search: string;
  roleFilter: string;
  page: number;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

export default function AdminUserManagement({
  users,
  search,
  roleFilter,
  page,
  onSearchChange,
  onRoleFilterChange,
  onPageChange,
  onSearchSubmit,
}: AdminUserManagementProps) {
  return (
    <>
      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={onSearchSubmit} className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </form>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="">All Roles</option>
          <option value="FAN">Fan</option>
          <option value="ARTIST">Artist</option>
          <option value="ADMIN">Admin</option>
          <option value="DEVELOPER">Developer</option>
        </select>
      </div>

      {/* User Count */}
      <p className="text-gray-500 text-xs mb-4 uppercase tracking-wider">
        {users.total.toLocaleString()} users total &middot; page {users.page} of {users.totalPages}
      </p>

      {/* Mobile User Cards */}
      <div className="space-y-2 md:hidden">
        {users.users.map((u) => (
          <div key={u.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-warm-50 font-medium text-sm truncate mr-2">{u.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : u.role === 'DEVELOPER' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : u.role === 'ARTIST' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-noir-700 text-gray-400 border border-noir-600'
              }`}>{u.role}</span>
            </div>
            <p className="text-gray-400 text-xs truncate">{u.email}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
              <span>{u.city || 'No city'}</span>
              <span>{u.emailVerified ? <span className="text-green-400">Verified</span> : 'Unverified'}</span>
              <span>{formatDate(u.createdAt)}</span>
            </div>
            {(u._count.supportTickets > 0 || u._count.raffleEntries > 0) && (
              <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                {u._count.supportTickets > 0 && <span>{u._count.supportTickets} support</span>}
                {u._count.raffleEntries > 0 && <span>{u._count.raffleEntries} raffle</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Users Table */}
      <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-center px-4 py-3">Verified</th>
              <th className="text-center px-4 py-3">Supports</th>
              <th className="text-center px-4 py-3">Raffles</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.users.map((u) => (
              <tr key={u.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                <td className="px-4 py-3 text-warm-50 whitespace-nowrap">{u.name}</td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : u.role === 'ARTIST' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-noir-700 text-gray-400 border border-noir-600'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{u.city || '\u2014'}</td>
                <td className="px-4 py-3 text-center">
                  {u.emailVerified
                    ? <span className="text-green-400 text-xs">Yes</span>
                    : <span className="text-gray-600 text-xs">No</span>
                  }
                </td>
                <td className="px-4 py-3 text-center text-gray-400">{u._count.supportTickets}</td>
                <td className="px-4 py-3 text-center text-gray-400">{u._count.raffleEntries}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {users.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
          >
            Prev
          </button>
          <span className="text-gray-500 text-sm px-3">{page} / {users.totalPages}</span>
          <button
            onClick={() => onPageChange(Math.min(users.totalPages, page + 1))}
            disabled={page >= users.totalPages}
            className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
