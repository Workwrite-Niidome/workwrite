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

export function ExperienceHeader({ state, onPerspectiveChange }: ExperienceHeaderProps) {
  const [visible, setVisible] = useState(true);
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 50) setVisible(true);
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
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="flex items-center justify-center gap-4 px-6 py-3 bg-[#0a0a0f]/90 backdrop-blur-sm">
        <span className="text-[11px] text-[#6a6a70] tracking-wider">
          {state.locationName}
        </span>
        <span className="text-[11px] text-[#3a3a45]">|</span>
        <span className="text-[11px] text-[#55555f]">
          {TIME_LABELS[state.timeOfDay] || state.timeOfDay}
        </span>
        <span className="text-[11px] text-[#3a3a45]">|</span>

        <div className="relative">
          <button
            onClick={() => setPerspectiveOpen(!perspectiveOpen)}
            className="text-[11px] text-[#55555f] hover:text-[#8a8a95] transition-colors cursor-pointer"
          >
            {PERSPECTIVE_LABELS[state.perspective]}
          </button>

          {perspectiveOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-[#15151f] border border-[#2a2a35] rounded-lg shadow-xl py-1 min-w-[80px]">
              {(Object.entries(PERSPECTIVE_LABELS) as [PerspectiveMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    onPerspectiveChange(mode);
                    setPerspectiveOpen(false);
                  }}
                  className={`block w-full text-center px-4 py-1.5 text-[11px] transition-colors cursor-pointer ${
                    state.perspective === mode
                      ? 'text-[#d8d5d0]'
                      : 'text-[#55555f] hover:text-[#8a8a95]'
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
