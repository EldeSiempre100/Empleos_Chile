import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error("UI rendering error", error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="full-screen-state" role="alert">
        <div className="state-card">
          <AlertTriangle size={24} />
          <h1>No se pudo mostrar esta sección</h1>
          <p>Recarga la vista para reintentar.</p>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      </main>
    );
  }
}
