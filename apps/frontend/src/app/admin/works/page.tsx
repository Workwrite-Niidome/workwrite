'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, type AdminWork } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

const STATUSES = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED'] as const;
const PAGE_SIZE = 20;

export default function AdminWorksPage() {
  const [works, setWorks] = useState<AdminWork[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminWorks({ page, limit: PAGE_SIZE, status: statusFilter || undefined });
      setWorks(res.data);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchWorks(); }, [fetchWorks]);

  const [pendingStatus, setPendingStatus] = useState<{ workId: string; status: string } | null>(null);

  async function handleStatusChange() {
    if (!pendingStatus) return;
    try {
      await api.updateWorkStatus(pendingStatus.workId, pendingStatus.status);
      fetchWorks();
    } catch {}
    setPendingStatus(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">Work Management</h2>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Author</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Episodes</th>
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
              ) : works.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No works found</td>
                </tr>
              ) : (
                works.map((work) => (
                  <tr key={work.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/works/${work.id}`} className="hover:underline font-medium flex items-center gap-1">
                        {work.title}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      <p className="text-xs text-muted-foreground">{new Date(work.createdAt).toLocaleDateString('ja-JP')}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{work.author.displayName || work.author.name}</td>
                    <td className="px-4 py-3">
                      <select
                        value={work.status}
                        onChange={(e) => setPendingStatus({ workId: work.id, status: e.target.value })}
                        className="h-8 rounded border border-border bg-transparent px-2 text-xs"
                        aria-label={`Status for ${work.title}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {work.qualityScore ? Math.round(work.qualityScore.overall) : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{work._count.episodes}</td>
                    <td className="px-4 py-3">
                      <Link href={`/works/${work.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">{total} works total</p>
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

      <ConfirmDialog
        open={!!pendingStatus}
        onOpenChange={(v) => { if (!v) setPendingStatus(null); }}
        title="ステータス変更"
        message={`ステータスを ${pendingStatus?.status} に変更しますか？`}
        confirmLabel="変更する"
        onConfirm={handleStatusChange}
      />
    </div>
  );
}
