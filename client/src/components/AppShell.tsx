import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive,
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  Database,
  LogOut,
  Menu,
  Search,
  Settings2,
  UsersRound,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { User } from "../../../drizzle/schema";

type AppShellProps = { user: User; children: React.ReactNode };

const primaryNavigation = [
  {
    href: "/empleos",
    label: "Empleos",
    icon: BriefcaseBusiness,
    match: ["/", "/empleos"],
  },
  {
    href: "/guardados",
    label: "Guardados",
    icon: Bookmark,
    match: ["/guardados"],
  },
  {
    href: "/busquedas",
    label: "Mis búsquedas",
    icon: Search,
    match: ["/busquedas"],
  },
  {
    href: "/personas",
    label: "Perfiles",
    icon: UsersRound,
    match: ["/personas"],
  },
];

export default function AppShell({ user, children }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.assign("/login");
    },
  });
  const initials = (user.name || user.email || "EC")
    .trim()
    .split(/[\s@]+/)
    .slice(0, 2)
    .map(piece => piece[0]?.toUpperCase())
    .join("");
  const isActive = (match: string[]) =>
    match.some(item =>
      item === "/"
        ? location === "/" || location === "/empleos"
        : location === item || location.startsWith(`${item}/`)
    );
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setMobileOpen(false);
    if (location === "/empleos")
      window.dispatchEvent(
        new CustomEvent("employments:search", { detail: searchText.trim() })
      );
    else setLocation(`/empleos?q=${encodeURIComponent(searchText.trim())}`);
  };
  const isExplorer = location === "/" || location === "/empleos";

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link
            href="/empleos"
            className="brand"
            aria-label="Empleos Chile, buscar ofertas"
          >
            <span className="brand-mark" aria-hidden="true">
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
          </Link>
          <form
            className={`global-search ${isExplorer ? "is-hidden" : ""}`}
            role="search"
            onSubmit={submitSearch}
          >
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Buscar cargo o empresa"
              placeholder="Cargo, empresa o habilidad"
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <nav className="desktop-navigation" aria-label="Navegación principal">
            {primaryNavigation.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActive(match) ? "active" : ""}`}
                aria-current={isActive(match) ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="account-menu">
            <details className="account-details">
              <summary aria-label="Abrir menú de cuenta">
                <span className="avatar">{initials || "EC"}</span>
                <span className="account-label">Mi cuenta</span>
                <ChevronDown size={14} />
              </summary>
              <div className="account-popover">
                <div className="account-identity">
                  <strong>{user.name || "Cuenta personal"}</strong>
                  <span>{user.email || "Sesión privada"}</span>
                  <small>
                    {user.role === "admin"
                      ? "Acceso de administración"
                      : "Cuenta autorizada"}
                  </small>
                </div>
                <Link href="/configuracion" className="account-action">
                  <Settings2 size={15} /> Configuración
                </Link>
                {user.role === "admin" && (
                  <>
                    <div className="account-menu-heading">Administración</div>
                    <Link href="/administracion/ofertas" className="account-action">
                      <Archive size={15} /> Gestionar ofertas
                    </Link>
                    <Link href="/administracion/fuentes" className="account-action">
                      <Database size={15} /> Fuentes de empleo
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className="account-action"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  <LogOut size={15} /> Cerrar sesión
                </button>
              </div>
            </details>
          </div>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(open => !open)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div
          className="mobile-navigation-backdrop"
          onClick={() => setMobileOpen(false)}
        >
          <nav
            className="mobile-navigation"
            aria-label="Navegación móvil"
            onClick={event => event.stopPropagation()}
          >
            {primaryNavigation.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`nav-link ${isActive(match) ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
            {user.role === "admin" && (
              <>
                <div className="mobile-nav-label">Administración</div>
                <Link
                  href="/administracion/ofertas"
                  onClick={() => setMobileOpen(false)}
                  className="nav-link"
                >
                  <Archive size={18} />
                  <span>Gestionar ofertas</span>
                </Link>
                <Link
                  href="/administracion/fuentes"
                  onClick={() => setMobileOpen(false)}
                  className="nav-link"
                >
                  <Database size={18} />
                  <span>Fuentes de empleo</span>
                </Link>
              </>
            )}
            <Link
              href="/configuracion"
              onClick={() => setMobileOpen(false)}
              className="nav-link"
            >
              <Settings2 size={18} />
              <span>Configuración</span>
            </Link>
            <button
              className="nav-link"
              type="button"
              onClick={() => logout.mutate()}
            >
              <LogOut size={18} />
              <span>Cerrar sesión</span>
            </button>
          </nav>
        </div>
      )}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <span>Empleos Chile</span>
        <span>Ofertas con origen visible · Chile</span>
      </footer>
    </div>
  );
}
