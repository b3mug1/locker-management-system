import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          background: '#f8fafc',
          color: '#1e293b'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '480px' }}>
            An unexpected error occurred while rendering this page.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#f1f5f9',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.85rem',
              color: '#ef4444',
              maxWidth: '600px',
              overflowX: 'auto',
              marginBottom: '1.5rem'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
