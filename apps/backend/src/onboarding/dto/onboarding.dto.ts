import { IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OnboardingAnswerDto {
  @ApiProperty({ example: 'preferred_mood', description: 'Question ID' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 'relaxed', description: 'Selected option' })
  @IsString()
  answer: string;

  @ApiProperty({ example: 3, description: 'Weight 1-5' })
  @IsInt()
  @Min(1)
  @Max(5)
  weight: number;
}

export class SubmitOnboardingDto {
  @ApiProperty({ type: [OnboardingAnswerDto], description: '5 diagnosis answers' })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => OnboardingAnswerDto)
  answers: OnboardingAnswerDto[];
}

// Master diagnosis questions returned to frontend
export const ONBOARDING_QUESTIONS = [
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
