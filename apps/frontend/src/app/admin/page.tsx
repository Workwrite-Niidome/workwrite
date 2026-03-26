'use client';

import { useState, useEffect } from 'react';
import { api, type AdminStats } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, MessageSquare, TrendingUp, CreditCard } from 'lucide-react';

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">Failed to load statistics.</p>;
  }

  return (
    <div>
      <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} sub={`+${stats.todayNewUsers} today`} />
        <StatCard label="Total Works" value={stats.totalWorks} icon={BookOpen} sub={`+${stats.todayNewWorks} today`} />
        <StatCard label="Reviews" value={stats.totalReviews} icon={MessageSquare} />
        <StatCard label="Comments" value={stats.totalComments} icon={MessageSquare} />
        <StatCard label="New Users Today" value={stats.todayNewUsers} icon={TrendingUp} />
        <StatCard label="New Works Today" value={stats.todayNewWorks} icon={TrendingUp} />
      </div>

      {stats.planCounts && (
        <>
          <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-4 mt-8">Plan Distribution</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Free" value={stats.planCounts.free} icon={Users} />
            <StatCard label="Standard" value={stats.planCounts.standard} icon={CreditCard} sub="¥2,980/月" />
            <StatCard label="Pro" value={stats.planCounts.pro} icon={CreditCard} sub="¥7,980/月" />
          </div>
        </>
      )}
    </div>
  );
}
