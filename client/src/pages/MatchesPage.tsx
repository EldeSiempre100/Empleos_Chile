import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  MapPin,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "wouter";
import type { JobFilters, Modality } from "@shared/domain";
import { trpc } from "@/lib/trpc";
import {
  formatJobDate,
  modalityLabel,
  salaryLabel,
} from "@/components/JobCard";

export default function MatchesPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [mode, setMode] = useState<"broad" | "strict">("broad");
  const [modalities, setModalities] = useState<Modality[]>([]);
  const candidate = trpc.candidates.detail.useQuery({ id });
  const filters: JobFilters = {
    modalities: modalities.length ? modalities : undefined,
    includeUnknownModality: false,
    page: 1,
    pageSize: 30,
    sort: "recent",
    includeUndisclosedSalary: true,
  };
  const result = trpc.candidates.matches.useQuery(
    { id, filters },
    { enabled: Boolean(id), retry: false }
  );
  const items = useMemo(
    () =>
      (result.data?.items ?? []).filter(
        item => mode === "broad" || item.explanation.isEligible
      ),
    [result.data?.items, mode]
  );
  const toggle = (value: Modality) =>
    setModalities(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <Link href={`/personas/${id}`} className="back-link">
            <ArrowLeft size={13} /> Volver al perfil
          </Link>
          <span className="eyebrow">RECOMENDACIÓN EXPLICABLE</span>
          <h1>Coincidencias laborales</h1>
          <p>
            {candidate.data
              ? `Perfil: ${candidate.data.displayName}`
              : "Compatibilidad candidato × oferta"}{" "}
            · cálculo local determinista
          </p>
        </div>
      </div>
      <div className="match-method-note">
        <Sparkles size={15} />
        <div>
          <strong>
            Score basado en datos declarados y requisitos publicados
          </strong>
          <p>
            Funciones/cargos 25 · competencias 25 · experiencia/seniority 15 ·
            formación/requisitos 10 · ubicación/modalidad 15 · condiciones 10.
            No se usan servicios de IA ni se completan credenciales que el
            perfil no tenga.
          </p>
        </div>
      </div>
      <section className="match-controls surface">
        <div className="match-mode-control">
          <SlidersHorizontal size={15} />
          <span>Modo de búsqueda</span>
          <button
            className={mode === "broad" ? "active" : ""}
            type="button"
            onClick={() => setMode("broad")}
          >
            Amplio
          </button>
          <button
            className={mode === "strict" ? "active" : ""}
            type="button"
            onClick={() => setMode("strict")}
          >
            Estricto · elegibles
          </button>
        </div>
        <div className="match-modalities">
          <span>Modalidades:</span>
          {(
            [
              { value: "presencial", label: "Presencial" },
              { value: "hibrida", label: "Híbrida" },
              { value: "remota", label: "Remota" },
            ] as const
          ).map(item => (
            <label key={item.value}>
              <input
                type="checkbox"
                checked={modalities.includes(item.value)}
                onChange={() => toggle(item.value)}
              />
              {item.label}
            </label>
          ))}
          <span className="muted">Desconocida excluida</span>
        </div>
      </section>
      {result.isLoading ? (
        <div className="surface empty-state">
          <span className="loading-spinner" />
          <p>Calculando compatibilidad…</p>
        </div>
      ) : result.error ? (
        <div className="surface empty-state">
          <h2>No se pudo calcular compatibilidad</h2>
          <p>
            El perfil puede requerir consentimiento vigente y hay que verificar
            la conexión.
          </p>
          <button
            className="button button-secondary"
            onClick={() => result.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : result.data?.total === 0 ? (
        <div className="surface empty-state">
          <div className="empty-icon">
            <CircleHelp size={19} />
          </div>
          <h2>No hay ofertas compatibles almacenadas</h2>
          <p>
            Se comparan solo ofertas disponibles en Chile, con las modalidades y
            criterios actuales del perfil.
          </p>
          <Link href="/empleos" className="button button-primary">
            Explorar ofertas
          </Link>
        </div>
      ) : (
        <>
          <div className="match-results-summary">
            <span>
              <strong>
                {mode === "strict" ? items.length : result.data?.total}
              </strong>{" "}
              {mode === "strict"
                ? "vacantes elegibles con datos suficientes"
                : "coincidencias evaluadas"}
            </span>
            <span>Pesos configurables en Administración → Configuración</span>
          </div>
          <div className="match-result-list">
            {items.map(({ job, explanation }, index) => (
              <article className="match-card" key={`${job.id}-${index}`}>
                <div className="match-card-head">
                  <div
                    className={`match-score ${explanation.eligibilityStatus === "not_eligible" ? "ineligible" : explanation.eligibilityStatus === "insufficient" ? "pending" : ""}`}
                  >
                    {explanation.score}
                    <small>/100</small>
                  </div>
                  <div className="match-title-wrap">
                    <div className="match-status-line">
                      {explanation.eligibilityStatus === "eligible" ? (
                        <span className="match-eligible">
                          <CheckCircle2 size={12} /> Sin requisito excluyente
                          detectado y datos suficientes
                        </span>
                      ) : explanation.eligibilityStatus === "insufficient" ? (
                        <span className="match-pending">
                          <CircleHelp size={12} /> Revisión pendiente: datos
                          insuficientes para decidir elegibilidad
                        </span>
                      ) : (
                        <span className="match-ineligible">
                          <AlertTriangle size={12} /> No elegible según datos
                          declarados
                        </span>
                      )}
                    </div>
                    <h2>{job.title}</h2>
                    <p>
                      {job.companyConfidential
                        ? "Empresa confidencial"
                        : job.companyName}{" "}
                      ·{" "}
                      {[job.communeName, job.regionName]
                        .filter(Boolean)
                        .join(", ") || "Ubicación no informada"}
                    </p>
                  </div>
                  <Link
                    className="button button-secondary button-small"
                    href={`/empleos/${job.id}?return=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  >
                    Ver oferta
                  </Link>
                </div>
                <div className="match-chips">
                  <span className="pill pill-teal">
                    {modalityLabel(job.modality)}
                  </span>
                  <span className="pill">{salaryLabel(job)}</span>
                  <span className="pill">
                    Publicada: {formatJobDate(job.publishedAt)}
                  </span>
                </div>
                <div className="match-explain">
                  {explanation.factors.map(factor => (
                    <div className="match-factor" key={factor.key}>
                      <span>{factor.label}</span>
                      <div
                        className="match-bar"
                        role="meter"
                        aria-valuenow={factor.score}
                        aria-valuemin={0}
                        aria-valuemax={factor.weight}
                      >
                        <span
                          style={{
                            width: `${factor.weight ? Math.min(100, Math.round((factor.score / factor.weight) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                      <strong>
                        {factor.score}/{factor.weight}
                      </strong>
                    </div>
                  ))}
                </div>
                {explanation.strengths.length > 0 && (
                  <div className="match-explain-list">
                    {explanation.strengths.slice(0, 5).map((text: string) => (
                      <span className="pill pill-teal" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                )}
                {explanation.gaps.length > 0 && (
                  <div className="match-explain-list">
                    {explanation.gaps.map((text: string) => (
                      <span className="pill pill-gold" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                )}
                {explanation.insufficient.length > 0 && (
                  <div className="match-insufficient">
                    <CircleHelp size={13} />
                    <span>
                      Datos insuficientes:{" "}
                      {explanation.insufficient.join(" · ")}
                    </span>
                  </div>
                )}
                {explanation.exclusions.length > 0 && (
                  <div className="match-exclusions">
                    <AlertTriangle size={13} />
                    <span>
                      Exclusiones: {explanation.exclusions.join(" · ")}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="match-footer-note">
            <MapPin size={13} />
            Los criterios de ubicación, modalidad y renta se evalúan sin
            convertir bases bruto/líquido. Revisa la ficha original antes de
            postular por fuera de esta aplicación.
          </div>
        </>
      )}
    </div>
  );
}
