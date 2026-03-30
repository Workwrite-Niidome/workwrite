'use client';

import { useState, useEffect } from 'react';
import type { WorldState, PerspectiveMode } from '../types';

interface ExperienceHeaderProps {
  state: WorldState;
  onPerspectiveChange: (mode: PerspectiveMode) => void;
}

const PERSPECTIVE_LABELS: Record<PerspectiveMode, string> = {
  protagonist: '主人公',
  character: '自分',
  omniscient: '俯瞰',
};

const TIME_LABELS: Record<string, string> = {
  dawn: '明け方',
  morning: '朝',
  afternoon: '午後',
  evening: '夕方',
  night: '夜',
  late_night: '深夜',
};

/**
 * ExperienceHeader — ミニマルヘッダー
 *
 * 場所名、時間帯、視点切替のみ。マウスが上部に来たら表示。
 * 操作中は自動で消える。没入を邪魔しない。
 */
export function ExperienceHeader({ state, onPerspectiveChange }: ExperienceHeaderProps) {
  const [visible, setVisible] = useState(true);
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);

  // Auto-hide after 3 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  // Show on mouse move to top
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 50) {
        setVisible(true);
      }
    };
    const handleTouch = () => setVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground/70">
            {state.locationName}
          </span>
          <span className="text-xs text-muted-foreground/40">
            {TIME_LABELS[state.timeOfDay] || state.timeOfDay}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setPerspectiveOpen(!perspectiveOpen)}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            {PERSPECTIVE_LABELS[state.perspective]}
          </button>

          {perspectiveOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[100px]">
              {(Object.entries(PERSPECTIVE_LABELS) as [PerspectiveMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    onPerspectiveChange(mode);
                    setPerspectiveOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    state.perspective === mode
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
