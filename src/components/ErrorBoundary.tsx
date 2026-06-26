import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import {
  clearBrowserCachesAndWorkers,
  clearLocalAppStateAndReload,
  isLikelyChunkLoadError,
  reloadWithCacheBust,
  shouldRetryChunkLoad,
} from '@/lib/browserRecovery';

const isPreviewRuntime = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.startsWith('id-preview--') || host.includes('-preview--') || host.includes('lovable.app') || host.endsWith('.lovableproject.com');
};

interface Props {
  children: ReactNode;
  title?: string;
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

    // Erro clássico React + Google Translate / extensões: o DOM já foi mutado por terceiros.
    // Em vez de derrubar a tela, apenas resetamos o boundary — o patch em index.html já evita
    // que isso volte a acontecer na próxima renderização.
    const msg = error?.message || '';
    if (error?.name === 'NotFoundError' && /removeChild|insertBefore/i.test(msg)) {
      console.warn('[ErrorBoundary] Ignorando NotFoundError de DOM (mutação externa). Recuperando.');
      // Reseta no próximo tick para permitir o React terminar o ciclo atual.
      setTimeout(() => this.setState({ hasError: false, error: null }), 0);
      return;
    }

    if (!isPreviewRuntime() && isLikelyChunkLoadError(error) && shouldRetryChunkLoad()) {
      void clearBrowserCachesAndWorkers().finally(() => reloadWithCacheBust());
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    if (isPreviewRuntime()) {
      return;
    }
    void clearLocalAppStateAndReload();
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.title ?? 'Erro ao carregar esta área';
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f2b26] p-6 font-sans">
          <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <p className="text-sm text-white/60">
                O sistema encontrou um problema técnico nesta seção. Os detalhes foram enviados ao console.
              </p>
            </div>
            
            {this.state.error && (
              <div className="p-3 bg-black/30 rounded-lg border border-white/10 text-left overflow-auto max-h-32">
                <p className="text-[10px] font-mono text-red-300/80 break-words">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4" /> Recarregar sistema
              </button>
              {!isPreviewRuntime() && (
                <button
                  onClick={this.handleClearAndReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-medium transition-all border border-white/10"
                >
                  <Trash2 className="h-4 w-4" /> Limpar cache e tentar novamente
                </button>
              )}
            </div>
            
            <p className="text-[10px] text-white/30 pt-4">
              Ambiente: {import.meta.env.MODE} | Rota: {window.location.pathname}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
