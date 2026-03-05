'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { api } from '@/lib/api';

interface HistoryItem {
  title: string;
  author: string;
}

export default function ImportHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([{ title: '', author: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function addItem() {
    setItems([...items, { title: '', author: '' }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof HistoryItem, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit() {
    const validItems = items.filter((item) => item.title.trim());
    if (validItems.length === 0) {
      router.push('/');
      return;
    }
    setSubmitting(true);
    try {
      await api.importReadingHistory(validItems);
      router.push('/');
    } catch {
      router.push('/');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>読書履歴をインポート</CardTitle>
          <CardDescription>
            過去に読んだ作品を登録すると、おすすめの精度が上がります（任意）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="作品タイトル"
                  value={item.title}
                  onChange={(e) => updateItem(index, 'title', e.target.value)}
                />
                <Input
                  placeholder="著者名（任意）"
                  value={item.author}
                  onChange={(e) => updateItem(index, 'author', e.target.value)}
                />
              </div>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> 作品を追加
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
            {submitting ? '登録中...' : '登録してはじめる'}
          </Button>
          <Button variant="ghost" onClick={() => router.push('/')} className="w-full">
            スキップ
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
