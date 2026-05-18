import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  componentStack: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    componentStack: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Auto-reload on stale chunk errors (happens after deploys)
    if (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.name === 'ChunkLoadError'
    ) {
      const countKey = 'chunk_reload_count';
      const timeKey = 'chunk_reload_time';
      const maxReloads = 3;
      const cooldownMs = 10_000;
      const reloadCount = parseInt(sessionStorage.getItem(countKey) ?? '0', 10);
      const lastReloadTime = parseInt(sessionStorage.getItem(timeKey) ?? '0', 10);
      const now = Date.now();
      if (reloadCount < maxReloads && now - lastReloadTime > cooldownMs) {
        sessionStorage.setItem(countKey, String(reloadCount + 1));
        sessionStorage.setItem(timeKey, String(now));
        window.location.reload();
        return;
      }
    }

    // Log error to error reporting service
    this.logErrorToService(error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      componentStack: errorInfo.componentStack || '',
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // In a real app, you would send this to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Example: Send to error reporting service
    // errorService.logError({
    //   error,
    //   errorInfo,
    //   componentStack: errorInfo.componentStack,
    //   timestamp: new Date().toISOString(),
    //   url: window.location.href,
    //   user: currentUser, // You would get this from your auth context
    // });
  }

  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      componentStack: '',
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheReload = () => {
    sessionStorage.removeItem('chunk_reload_count');
    sessionStorage.removeItem('chunk_reload_time');
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorDetails = `Error: ${error?.toString()}\n\nComponent Stack:\n${errorInfo?.componentStack}`;
    
    navigator.clipboard.writeText(errorDetails).then(
      () => alert('Error details copied to clipboard'),
      () => console.error('Failed to copy error details')
    );
  };

  public render() {
    const { hasError, error, errorInfo, componentStack } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback UI if provided
      if (fallback) {
        if (typeof fallback === 'function') {
          const FallbackComponent = fallback as (
            props: { error: Error | null; errorInfo: ErrorInfo | null; resetError: () => void }
          ) => ReactNode;
          return <FallbackComponent error={error} errorInfo={errorInfo} resetError={this.handleReset} />;
        }
        return fallback;
      }

      const isChunkError =
        error?.message.includes('Failed to fetch dynamically imported module') ||
        error?.message.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError';

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-muted/20 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>Something went wrong</CardTitle>
                  <CardDescription>
                    {isChunkError
                      ? 'A new version was deployed. Clear the cache and reload to continue.'
                      : 'An unexpected error occurred. Our team has been notified.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Error Details</h3>
                <div className="p-3 bg-muted/50 rounded-md text-sm font-mono text-destructive overflow-x-auto">
                  {error?.toString() || 'Unknown error'}
                </div>
              </div>

              {process.env.NODE_ENV === 'development' && componentStack && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Component Stack</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={this.handleCopyError}
                      className="text-xs"
                    >
                      Copy Details
                    </Button>
                  </div>
                  <pre className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground overflow-x-auto">
                    {componentStack}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                {isChunkError ? (
                  <Button onClick={this.handleClearCacheReload} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Clear Cache &amp; Reload
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={this.handleReset}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                    <Button onClick={this.handleReload}>Reload Page</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;