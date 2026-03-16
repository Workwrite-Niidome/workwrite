'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Stamp {
  id: string;
  name: string;
  emoji: string;
  category: string;
}

interface StampPickerProps {
  selectedStampId?: string;
  onSelect: (stampId: string | undefined) => void;
}

export function StampPicker({ selectedStampId, onSelect }: StampPickerProps) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getStamps()
      .then((res: any) => {
        const data = res.data || res;
        setStamps(data.stamps || []);
        setCategories(data.categories || {});
      })
      .catch(() => {});
  }, []);

  const grouped = stamps.reduce<Record<string, Stamp[]>>((acc, stamp) => {
    if (!acc[stamp.category]) acc[stamp.category] = [];
    acc[stamp.category].push(stamp);
    return acc;
  }, {});

  if (stamps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">スタンプ（任意）</p>
      {Object.entries(grouped).map(([cat, catStamps]) => (
        <div key={cat}>
          <p className="text-[10px] text-muted-foreground mb-1">{categories[cat] || cat}</p>
          <div className="flex flex-wrap gap-1">
            {catStamps.map((stamp) => (
              <button
                key={stamp.id}
                type="button"
                onClick={() => onSelect(selectedStampId === stamp.id ? undefined : stamp.id)}
                className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-colors ${
                  selectedStampId === stamp.id
                    ? 'bg-primary/20 ring-2 ring-primary'
                    : 'hover:bg-muted'
                }`}
                title={stamp.name}
              >
                {stamp.emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
