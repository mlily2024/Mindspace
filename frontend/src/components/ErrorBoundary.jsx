import React from 'react';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error('Error Boundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    // In production, you could send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={styles.container} role="alert">
          <div style={styles.content}>
            <div style={styles.icon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              We're sorry, but something unexpected happened. Please try again or contact support if the problem persists.
            </p>
            <div style={styles.actions}>
              <button
                onClick={this.handleRetry}
                style={styles.retryButton}
                onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                style={styles.homeButton}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--surface-hover, #f0f0f0)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Go to Dashboard
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Development Only)</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: 'var(--background, #f9fafb)',
    fontFamily: 'var(--font-family-body, system-ui, -apple-system, sans-serif)'
  },
  content: {
    textAlign: 'center',
    maxWidth: '500px',
    padding: '40px',
    backgroundColor: 'var(--surface, white)',
    borderRadius: 'var(--radius-xl, 16px)',
    boxShadow: 'var(--shadow-lg, 0 10px 40px rgba(0, 0, 0, 0.1))'
  },
  icon: {
    color: 'var(--warning-color, #f59e0b)',
    marginBottom: '20px'
  },
  title: {
    fontSize: 'var(--font-size-xl, 24px)',
    fontWeight: 600,
    color: 'var(--text-primary, #1f2937)',
    margin: '0 0 12px 0'
  },
  message: {
    fontSize: 'var(--font-size-base, 16px)',
    color: 'var(--text-secondary, #6b7280)',
    lineHeight: 1.6,
    margin: '0 0 24px 0'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  retryButton: {
    padding: '12px 24px',
    backgroundColor: 'var(--primary-color, #9B8AA5)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: 'var(--font-size-base, 16px)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  homeButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: 'var(--primary-color, #9B8AA5)',
    border: '2px solid var(--primary-color, #9B8AA5)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: 'var(--font-size-base, 16px)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  details: {
    marginTop: '24px',
    textAlign: 'left'
  },
  summary: {
    cursor: 'pointer',
    color: 'var(--text-secondary, #6b7280)',
    fontSize: 'var(--font-size-small, 14px)',
    marginBottom: '8px'
  },
  errorText: {
    backgroundColor: 'var(--error-light, #fef2f2)',
    color: 'var(--error-color, #dc2626)',
    padding: '12px',
    borderRadius: 'var(--radius-sm, 4px)',
    fontSize: '12px',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
};

/**
 * Higher-order component to wrap components with error boundary
 */
export const withErrorBoundary = (Component, fallback = null) => {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

export default ErrorBoundary;
