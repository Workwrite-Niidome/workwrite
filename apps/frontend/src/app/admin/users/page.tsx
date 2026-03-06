'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type AdminUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';

const ROLES = ['READER', 'AUTHOR', 'EDITOR', 'ADMIN'] as const;
const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers({ page, limit: PAGE_SIZE, search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleRoleChange(userId: string, role: string) {
    if (!confirm(`Change role to ${role}?`)) return;
    try {
      await api.updateUserRole(userId, role);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleBanToggle(user: AdminUser) {
    const action = user.isBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} ${user.name}?`)) return;
    try {
      await api.banUser(user.id, !user.isBanned);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">User Management</h2>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Works</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.displayName || user.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString('ja-JP')}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="h-8 rounded border border-border bg-transparent px-2 text-xs"
                        aria-label={`Role for ${user.name}`}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user._count.works}</td>
                    <td className="px-4 py-3">
                      {user.isBanned ? (
                        <span className="text-xs text-destructive font-medium">Banned</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleBanToggle(user)}
                      >
                        {user.isBanned ? (
                          <><ShieldCheck className="h-3.5 w-3.5" /> Unban</>
                        ) : (
                          <><ShieldAlert className="h-3.5 w-3.5" /> Ban</>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">{total} users total</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
