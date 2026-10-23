import { useState } from "react";
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";

export default function LoginScreen() {
  const [error, setError] = useState("");
  const signIn = () => {
    try {
      setError("");
      startLogin();
    } catch {
      setError(
        "No se pudo iniciar el acceso. Revisa la configuración de autenticación de la aplicación."
      );
    }
  };
  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark brand-mark-light" aria-hidden="true">
            <svg viewBox="0 0 36 36">
              <path
                d="M8 26V13.5h5.3V26H8Zm7.35 0V8.5h5.3V26h-5.3ZM22.7 26V16.7H28V26h-5.3Z"
                fill="currentColor"
              />
              <path
                d="m8 10.4 8-4.2 6.4 5.1 6-3.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="brand-name">
            empleos<span>chile</span>
          </span>
        </div>
        <div className="login-copy">
          <span className="eyebrow eyebrow-light">ACCESO PRIVADO</span>
          <h1>
            Una búsqueda laboral.
            <br />
            <em>Más clara, más tuya.</em>
          </h1>
          <p>
            Explora ofertas almacenadas, organiza oportunidades y compara cada
            perfil con requisitos publicados.
          </p>
        </div>
        <div className="login-story-note">
          <span className="login-line" />
          <span>Acceso restringido a cuentas autorizadas</span>
        </div>
        <div className="login-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-icon">
            <LockKeyhole size={19} />
          </div>
          <span className="eyebrow">EMPLEOS CHILE</span>
          <h2>Ingresar a tu espacio</h2>
          <p className="muted">
            Usa tu cuenta autorizada para acceder a ofertas guardadas y perfiles
            privados.
          </p>
          <button
            type="button"
            className="button button-primary login-button"
            onClick={signIn}
          >
            Continuar con tu cuenta <ArrowUpRight size={16} />
          </button>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <span>
              Los perfiles y CV solo se consultan dentro de una sesión
              autenticada.
            </span>
          </div>
          <div className="login-policy">
            No hay registro público. El acceso se administra mediante la
            identidad habilitada para este espacio.
          </div>
        </div>
      </section>
    </main>
  );
}
