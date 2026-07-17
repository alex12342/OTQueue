import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches JavaScript errors in its child component tree
 * and displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
                <p className="text-muted-foreground mt-2">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Refresh Page
              </button>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left text-xs text-muted-foreground bg-muted p-4 rounded overflow-auto max-h-48">
                  <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                  <pre className="whitespace-pre-wrap break-all">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
