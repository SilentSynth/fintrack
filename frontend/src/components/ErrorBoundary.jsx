import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
          <div className="mx-auto max-w-2xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-rose-200">Application error</p>
            <h1 className="mt-3 text-3xl font-semibold">The dashboard hit an unexpected rendering error.</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              The page can be refreshed once the underlying issue is fixed. The rest of the app remains isolated from this failure.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
