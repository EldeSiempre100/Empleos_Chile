import { lazy, Suspense } from "react";
import { Route, Switch, Redirect } from "wouter";
import { RefreshCw } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginScreen from "./components/LoginScreen";
import AppShell from "./components/AppShell";
import { trpc } from "@/lib/trpc";
import NotFound from "./pages/NotFound";

const JobsPage = lazy(() => import("./pages/JobsPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const SavedPage = lazy(() => import("./pages/SavedPage"));
const SearchesPage = lazy(() => import("./pages/SearchesPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const CandidateDetailPage = lazy(() => import("./pages/CandidateDetailPage"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const OfferAdminPage = lazy(() => import("./pages/OfferAdminPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function AppRouter() {
  const auth = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  if (auth.isLoading)
    return (
      <div className="full-screen-state">
        <span className="loading-spinner" />
        <span>Verificando la sesión…</span>
      </div>
    );
  if (auth.error)
    return (
      <div className="full-screen-state">
        <div className="state-card">
          <div className="state-icon state-icon-muted">
            <RefreshCw size={20} />
          </div>
          <h1>No se pudo comprobar la sesión</h1>
          <p>Revisa tu conexión e inténtalo otra vez.</p>
          <button
            className="button button-secondary"
            onClick={() => auth.refetch()}
          >
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      </div>
    );
  const user = auth.data;
  if (!user) return <LoginScreen />;

  const requireAdmin = (page: React.ReactNode) =>
    user.role === "admin" ? (
      page
    ) : (
      <section className="page-wrap">
        <div className="state-card">
          <h1>Acceso administrativo restringido</h1>
          <p>
            Esta cuenta no tiene permisos para importar o modificar ofertas.
          </p>
        </div>
      </section>
    );
  return (
    <AppShell user={user}>
      <Suspense
        fallback={
          <div className="full-screen-state">
            <span className="loading-spinner" />
            <span>Abriendo sección…</span>
          </div>
        }
      >
        <Switch>
          <Route path="/">
            <Redirect to="/empleos" />
          </Route>
          <Route path="/login">
            <Redirect to="/empleos" />
          </Route>
          <Route path="/empleos">
            <JobsPage />
          </Route>
          <Route path="/empleos/:id">
            <JobDetailPage />
          </Route>
          <Route path="/guardados">
            <SavedPage />
          </Route>
          <Route path="/busquedas">
            <SearchesPage />
          </Route>
          <Route path="/personas/nuevo">
            <PeoplePage mode="create" />
          </Route>
          <Route path="/personas/:id/coincidencias">
            <MatchesPage />
          </Route>
          <Route path="/personas/:id">
            <CandidateDetailPage />
          </Route>
          <Route path="/personas">
            <PeoplePage mode="list" />
          </Route>
          <Route path="/administracion/ofertas">
            {requireAdmin(<OfferAdminPage />)}
          </Route>
          <Route path="/administracion/fuentes">
            {requireAdmin(<SourcesPage />)}
          </Route>
          <Route path="/configuracion">
            <SettingsPage user={user} />
          </Route>
          <Route path="/404">
            <NotFound />
          </Route>
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <AppRouter />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
