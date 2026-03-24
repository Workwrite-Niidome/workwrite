'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageCircle, BookOpen, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type AllConversationItem } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

export default function CharacterTalksPage() {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<AllConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.getAllCharacterTalkConversations()
      .then((res) => {
        const data = (res as any).data || [];
        setConversations(Array.isArray(data) ? data : []);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center space-y-4">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="text-base font-medium">ログインが必要です</p>
          <p className="text-sm text-muted-foreground mt-1">キャラクタートークの履歴を見るにはログインしてください。</p>
        </div>
        <Link href="/login">
          <Button>ログイン</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold">キャラクタートーク</h1>
          <p className="text-xs text-muted-foreground">登場人物との会話履歴</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">まだ会話がありません</p>
          <Link href="/discover/characters">
            <Button variant="outline" size="sm" className="gap-1">
              キャラクターを探す
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={
                conv.mode === 'character' && conv.characterId
                  ? `/works/${conv.workId}/character-talk?characterId=${conv.characterId}`
                  : `/works/${conv.workId}/character-talk`
              }
              className="block border border-border rounded-lg p-4 hover:bg-muted/50 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {conv.mode === 'character' && conv.characterName ? (
                    <span className="text-sm font-bold">{conv.characterName[0]}</span>
                  ) : (
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Character name + work title */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {conv.mode === 'character' ? (conv.characterName || 'キャラクター') : 'コンパニオン'}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {conv.messageCount}通
                    </Badge>
                  </div>

                  {/* Work title */}
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    {conv.workTitle || '不明な作品'}
                  </p>

                  {/* Last message preview */}
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conv.lastMessage.role === 'user' ? 'あなた: ' : ''}
                      {conv.lastMessage.content}
                    </p>
                  )}

                  {/* Read progress + time */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {conv.readProgress && conv.readProgress.totalCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {conv.readProgress.readCount}話まで読了（全{conv.readProgress.totalCount}話）
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
