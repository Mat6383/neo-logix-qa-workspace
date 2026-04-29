import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error">
          <AlertCircle size={48} color="#EF4444" />
          <h2>Une erreur inattendue est survenue</h2>
          <p>{this.state.error?.message || 'Erreur inconnue'}</p>
          <button
            className="btn-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
