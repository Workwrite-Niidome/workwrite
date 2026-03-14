'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Loading } from '@/components/layout/loading';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const QUESTIONS = [
  {
    id: 'current_mood',
    question: '今の気分は？',
    options: [
      { value: 'energetic', label: '元気いっぱい' },
      { value: 'tired', label: '疲れている' },
      { value: 'calm', label: '穏やか' },
      { value: 'restless', label: 'そわそわ' },
      { value: 'neutral', label: 'ふつう' },
    ],
  },
  {
    id: 'reading_goal',
    question: '読書に何を求める？',
    options: [
      { value: 'escape', label: '現実を忘れたい' },
      { value: 'growth', label: '自分を成長させたい' },
      { value: 'emotion', label: '感動したい' },
      { value: 'knowledge', label: '知識を得たい' },
      { value: 'fun', label: '純粋に楽しみたい' },
    ],
  },
  {
    id: 'preferred_pace',
    question: 'どんなペースの作品が好き？',
    options: [
      { value: 'fast', label: 'テンポが速い' },
      { value: 'slow', label: 'じっくり' },
      { value: 'variable', label: '緩急がある' },
      { value: 'any', label: 'こだわらない' },
    ],
  },
  {
    id: 'emotional_preference',
    question: 'どんな感情を味わいたい？',
    options: [
      { value: 'joy', label: '喜び・幸福' },
      { value: 'thrill', label: 'スリル・興奮' },
      { value: 'sadness', label: '切なさ・感動' },
      { value: 'wonder', label: '驚き・発見' },
      { value: 'comfort', label: '安心・癒し' },
    ],
  },
  {
    id: 'reading_frequency',
    question: 'どのくらい読書する？',
    options: [
      { value: 'daily', label: 'ほぼ毎日' },
      { value: 'weekly', label: '週に数回' },
      { value: 'monthly', label: '月に数回' },
      { value: 'rarely', label: 'たまに' },
      { value: 'returning', label: '久しぶりに読みたい' },
    ],
  },
];

type AiProfile = {
  personalityType?: string;
  personality?: string;
  description?: string;
  recommendedGenres?: string[];
  readingStyle?: string;
  strengths?: string[];
};

export default function ReadingProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<AiProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Retake state
  const [showRetake, setShowRetake] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState<AiProfile | null>(null);
  const [newProfileLoading, setNewProfileLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.getAiProfile()
      .then((res) => {
        const unwrapped = (res as any)?.data ?? res;
        const profile = unwrapped?.aiProfile ?? unwrapped;
        if (profile && typeof profile === 'object' && Object.keys(profile).length > 0) {
          setCurrentProfile(profile);
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user]);

  const pollAiProfile = useCallback(() => {
    setNewProfileLoading(true);
    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getAiProfile();
        const unwrapped = (res as any)?.data ?? res;
        const profile = unwrapped?.aiProfile ?? unwrapped;
        if (profile && typeof profile === 'object' && Object.keys(profile).length > 0) {
          // Check if it's the new profile (aiProfile was cleared on retake)
          if (profile.personalityType || profile.description) {
            setNewProfile(profile);
            setCurrentProfile(profile);
            setNewProfileLoading(false);
            clearInterval(interval);
            return;
          }
        }
      } catch {
        // ignore
      }
      if (attempts >= maxAttempts) {
        setNewProfileLoading(false);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || profileLoading) return <Loading />;
  if (!user) {
    router.push('/login');
    return null;
  }

  const currentQuestion = QUESTIONS[step];
  const totalSteps = QUESTIONS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const allAnswered = QUESTIONS.every((q) => answers[q.id]);

  function selectAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    if (step < totalSteps - 1) {
      setTimeout(() => setStep(step + 1), 300);
    }
  }

  async function handleRetakeSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const formattedAnswers = QUESTIONS.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || q.options[0].value,
        weight: 3,
      }));
      await api.retakeOnboarding(formattedAnswers);
      setShowRetake(false);
      setShowNewProfile(true);
      pollAiProfile();
    } catch (err: any) {
      if (err?.message?.includes('クレジットが不足')) {
        setSubmitError('クレジットが不足しています。プランをアップグレードするか、クレジットを購入してください。');
      } else {
        setSubmitError(err?.message || '再診断に失敗しました。もう一度お試しください。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Profile display component
  function ProfileDisplay({ profile, loading }: { profile: AiProfile | null; loading: boolean }) {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-8 w-1/2 mx-auto mt-4" />
        </div>
      );
    }
    if (!profile) {
      return <p className="text-sm text-muted-foreground">プロフィールの生成に時間がかかっています。しばらくしてからページを再読み込みしてください。</p>;
    }
    return (
      <div className="space-y-5">
        {(profile.personalityType || profile.description || profile.personality) && (
          <div>
            {profile.personalityType && (
              <h3 className="text-base font-medium mb-2">{profile.personalityType}</h3>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {profile.description || profile.personality || ''}
            </p>
          </div>
        )}
        {profile.strengths && profile.strengths.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">あなたの強み</h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.strengths.map((s) => (
                <Badge key={s} variant="outline">{s}</Badge>
              ))}
            </div>
          </div>
        )}
        {profile.recommendedGenres && profile.recommendedGenres.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">おすすめジャンル</h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.recommendedGenres.map((genre) => (
                <Badge key={genre} variant="secondary">{genre}</Badge>
              ))}
            </div>
          </div>
        )}
        {profile.readingStyle && (
          <div>
            <h3 className="text-sm font-medium mb-2">読書スタイル</h3>
            <p className="text-sm text-muted-foreground">{profile.readingStyle}</p>
          </div>
        )}
      </div>
    );
  }

  // New profile result view
  if (showNewProfile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>新しい読書プロフィール</CardTitle>
            <CardDescription>AIがあなたの回答を再分析しました</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDisplay profile={newProfile} loading={newProfileLoading} />
            <div className="flex justify-center pt-6">
              <Button onClick={() => { setShowNewProfile(false); setNewProfile(null); }}>
                設定に戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Retake questionnaire view
  if (showRetake) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>読書傾向の再診断</CardTitle>
            <CardDescription>
              {step + 1} / {totalSteps}
              <span className="ml-2 text-xs text-muted-foreground">(1cr消費)</span>
            </CardDescription>
            <div className="w-full bg-muted rounded-full h-2 mt-3">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-medium text-center mb-6">{currentQuestion.question}</h3>
            <div className="grid gap-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => selectAnswer(option.value)}
                  className={cn(
                    'w-full p-4 rounded-lg border text-left transition-all min-h-[44px]',
                    answers[currentQuestion.id] === option.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {submitError && (
              <div className="mt-4 p-3 text-sm rounded-md bg-destructive/10 text-destructive">
                {submitError}
              </div>
            )}
            <div className="flex justify-between mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === 0) {
                    setShowRetake(false);
                    setAnswers({});
                    setStep(0);
                    setSubmitError('');
                  } else {
                    setStep(step - 1);
                  }
                }}
              >
                {step === 0 ? 'キャンセル' : '戻る'}
              </Button>
              {step === totalSteps - 1 ? (
                <Button onClick={handleRetakeSubmit} disabled={!allAnswered || submitting}>
                  {submitting ? '送信中...' : '再診断する（1cr）'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setStep(step + 1)}
                  disabled={!answers[currentQuestion.id]}
                >
                  次へ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: show current profile
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            設定に戻る
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">あなたの読書プロフィール</CardTitle>
          <CardDescription>
            オンボーディング時の診断結果です
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentProfile ? (
            <ProfileDisplay profile={currentProfile} loading={false} />
          ) : (
            <p className="text-sm text-muted-foreground">まだ診断が完了していません。</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">読書傾向を再診断する</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  気分や好みの変化に合わせて更新できます（1cr消費）
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setShowRetake(true);
                  setAnswers({});
                  setStep(0);
                  setSubmitError('');
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                再診断
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
