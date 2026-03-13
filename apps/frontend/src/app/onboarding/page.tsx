'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

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

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [aiProfile, setAiProfile] = useState<{ personalityType?: string; personality?: string; description?: string; recommendedGenres?: string[]; recommendedThemes?: string[]; readingStyle?: string; strengths?: string[] } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const router = useRouter();

  const currentQuestion = QUESTIONS[step];
  const totalSteps = QUESTIONS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  function selectAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    if (step < totalSteps - 1) {
      setTimeout(() => setStep(step + 1), 300);
    }
  }

  const pollAiProfile = useCallback(() => {
    setProfileLoading(true);
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getAiProfile();
        // Handle TransformInterceptor wrapping: { data: { aiProfile: {...} } }
        const unwrapped = (res as any)?.data ?? res;
        const profile = unwrapped?.aiProfile ?? unwrapped;
        if (profile && typeof profile === 'object' && Object.keys(profile).length > 0) {
          setAiProfile(profile);
          setProfileLoading(false);
          clearInterval(interval);
          return;
        }
      } catch {
        // ignore errors during polling
      }
      if (attempts >= maxAttempts) {
        setProfileLoading(false);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const formattedAnswers = QUESTIONS.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || q.options[0].value,
        weight: 3,
      }));
      await api.submitOnboarding(formattedAnswers);
      setShowProfile(true);
      pollAiProfile();
    } catch (err: any) {
      // 409 Conflict = already completed → show profile instead
      if (err?.status === 409) {
        setShowProfile(true);
        pollAiProfile();
        return;
      }
      setSubmitError(err?.message || '送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);

  if (showProfile) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>あなたの読書プロフィール</CardTitle>
            <CardDescription>
              AIがあなたの回答を分析しました
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-8 w-1/2 mx-auto mt-4" />
              </div>
            ) : aiProfile ? (
              <div className="space-y-6">
                {(aiProfile.personalityType || aiProfile.description || aiProfile.personality) && (
                  <div>
                    {aiProfile.personalityType && (
                      <h3 className="text-base font-medium mb-2">{aiProfile.personalityType}</h3>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {aiProfile.description || aiProfile.personality || ''}
                    </p>
                  </div>
                )}
                {aiProfile.strengths && aiProfile.strengths.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">あなたの強み</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {aiProfile.strengths.map((s) => (
                        <Badge key={s} variant="outline">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.recommendedGenres && aiProfile.recommendedGenres.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">おすすめジャンル</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {aiProfile.recommendedGenres.map((genre) => (
                        <Badge key={genre} variant="secondary">{genre}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.readingStyle && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">読書スタイル</h3>
                    <p className="text-sm text-muted-foreground">{aiProfile.readingStyle}</p>
                  </div>
                )}
                <div className="flex justify-center pt-4">
                  <Button onClick={() => router.push('/import-history')} size="lg">
                    読書を始める
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  プロフィールの生成に時間がかかっています
                </p>
                <Button onClick={() => router.push('/import-history')} size="lg">
                  読書を始める
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>あなたのことを教えてください</CardTitle>
          <CardDescription>
            {step + 1} / {totalSteps}
          </CardDescription>
          {/* Progress bar */}
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
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              戻る
            </Button>
            {step === totalSteps - 1 ? (
              <Button onClick={handleSubmit} disabled={!allAnswered || submitting}>
                {submitting ? '送信中...' : '診断結果を見る'}
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
