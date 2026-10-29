import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { StatusLayout } from '../components/StatusLayout';
import { useT } from '../i18n/I18nProvider';

/** The screen a route shows when its code failed to load (a stale chunk after a deploy, or no connection). */
export function RouteLoadError() {
  const t = useT().layout.lazyError;
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-5 py-16">
      <StatusLayout role="alert" icon={RefreshCw} title={t.title} actions={
        <Button variant="primary" className="min-h-12 w-full rounded-full" onClick={() => window.location.reload()}>
          {t.reload}
        </Button>
      }>
        {t.body}
      </StatusLayout>
    </div>
  );
}

/**
 * Catches a failed lazy import (`Failed to fetch dynamically imported module`) or a render error under a
 * full-screen route, so the screen shows what happened and a Reload instead of staying blank.
 */
export class RouteErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route failed to load', error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
