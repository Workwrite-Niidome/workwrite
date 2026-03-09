'use client';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '← →', description: '前話 / 次話' },
  { key: 'F', description: '没入モード' },
  { key: 'S', description: '設定パネル' },
  { key: 'C', description: 'コメント' },
  { key: 'A', description: 'AIコンパニオン' },
  { key: 'Esc', description: 'パネルを閉じる' },
  { key: '?', description: 'このヘルプを表示' },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-xs w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-4">キーボードショートカット</h3>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
