import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  declare props: Readonly<Props>;
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-50">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Algo salió mal</h1>
          <p className="text-slate-600 mb-6">Estamos trabajando para solucionarlo. Por favor, intenta recargar la página.</p>
          <button
            className="px-6 py-3 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-600 transition-all"
            onClick={() => window.location.reload()}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

