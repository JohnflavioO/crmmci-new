import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error.message, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      navigator.serviceWorker?.getRegistrations().then(regs =>
        regs.forEach(r => r.unregister())
      );
    } catch {
      // ignore
    }
    setTimeout(() => window.location.reload(), 300);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f2b26] p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Ocorreu um erro ao carregar o sistema</h1>
            <p className="text-sm text-white/60">
              Tente recarregar a página. Se o problema persistir, limpe os dados do navegador.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Recarregar sistema
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Limpar dados e tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
