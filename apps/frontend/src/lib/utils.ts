import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CHARS_PER_MINUTE = 500;

export function estimateReadingTime(charCount: number): string {
  const minutes = Math.max(1, Math.round(charCount / CHARS_PER_MINUTE));
  return `約${minutes}分`;
}
