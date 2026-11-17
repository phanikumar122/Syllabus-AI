import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "[ErrorBoundary] Workspace render failed:",
      error.name,
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <section className="surface-card" role="alert">
            <h1>Something went wrong</h1>
            <p>
              An unexpected error interrupted the workspace. Your saved browser
              data has been kept. Reload to retry; error details are available
              in the browser console.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="button button-primary"
            >
              Reload workspace
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
