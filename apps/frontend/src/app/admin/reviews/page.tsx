'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, type AdminReview } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const PAGE_SIZE = 20;

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReviews({ page, limit: PAGE_SIZE });
      setReviews(res.data);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteReviewId) return;
    try {
      await api.deleteReviewAsAdmin(deleteReviewId);
      fetchReviews();
    } catch {}
    setDeleteReviewId(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">Review Management</h2>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Content</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Author</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Work</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No reviews found</td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="line-clamp-2 text-sm">{review.content}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {review.user.displayName || review.user.name}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/works/${review.work.id}`} className="text-sm hover:underline text-muted-foreground">
                        {review.work.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(review.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:text-destructive gap-1"
                        onClick={() => setDeleteReviewId(review.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
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
          <p className="text-xs text-muted-foreground">{total} reviews total</p>
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
        open={!!deleteReviewId}
        onOpenChange={(v) => { if (!v) setDeleteReviewId(null); }}
        title="レビュー削除"
        message="このレビューを削除しますか？この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
