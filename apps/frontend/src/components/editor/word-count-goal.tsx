'use client';

import { useState, useEffect } from 'react';

interface WordCountGoalProps {
  currentCount: number;
}

export function WordCountGoal({ currentCount }: WordCountGoalProps) {
  const [goal, setGoal] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('wordCountGoal');
    if (saved) setGoal(Number(saved));
  }, []);

  function handleSetGoal(value: number) {
    setGoal(value);
    localStorage.setItem('wordCountGoal', String(value));
    setEditing(false);
  }

  if (goal === 0) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        目標設定
      </button>
    );
  }

  const progress = Math.min((currentCount / goal) * 100, 100);
  const isComplete = currentCount >= goal;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          defaultValue={goal}
          className="w-16 h-5 text-xs border rounded px-1 bg-background"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSetGoal(Number((e.target as HTMLInputElement).value));
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={(e) => handleSetGoal(Number(e.target.value))}
          autoFocus
          min={0}
          step={100}
        />
        <span className="text-xs text-muted-foreground">字</span>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-muted-foreground'}`}>
        {currentCount.toLocaleString()}/{goal.toLocaleString()}
      </span>
    </button>
  );
}
