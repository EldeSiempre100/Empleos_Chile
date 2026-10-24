import { ArrowLeft, Home, SearchX } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <main className="full-screen-state">
      <section className="state-card" role="status">
        <SearchX size={30} aria-hidden="true" />
        <span className="eyebrow">EMPLEOS CHILE · 404</span>
        <h1>Esta página no está disponible</h1>
        <p>La dirección solicitada no existe o el contenido cambió de ubicación.</p>
        <div className="row-actions">
          <button className="button button-secondary" type="button" onClick={() => window.history.back()}>
            <ArrowLeft size={16} /> Volver
          </button>
          <button className="button button-primary" type="button" onClick={() => navigate("/empleos")}>
            <Home size={16} /> Explorar empleos
          </button>
        </div>
      </section>
    </main>
  );
}
