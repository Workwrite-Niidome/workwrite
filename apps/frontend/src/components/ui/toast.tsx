'use client';

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right-full border',
        toast.type === 'success' && 'bg-background text-foreground border-green-500/30',
        toast.type === 'error' && 'bg-background text-foreground border-destructive/30',
        toast.type === 'info' && 'bg-background text-foreground border-border',
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
