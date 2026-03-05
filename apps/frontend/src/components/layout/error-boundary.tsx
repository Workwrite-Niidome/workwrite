'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
          <h2 className="text-xl font-semibold">問題が発生しました</h2>
          <p className="text-muted-foreground max-w-md">
            予期せぬエラーが発生しました。ページを再読み込みしてください。
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: undefined })}>
            再試行
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
