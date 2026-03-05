'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const formattedAnswers = QUESTIONS.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || q.options[0].value,
        weight: 3,
      }));
      await api.submitOnboarding(formattedAnswers);
      router.push('/import-history');
    } catch {
      router.push('/');
    }
  }

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);

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
                  'w-full p-4 rounded-lg border text-left transition-all',
                  answers[currentQuestion.id] === option.value
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

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
