import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  MapPin,
  NotebookPen,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import JobCard, {
  formatJobDate,
  modalityLabel,
  salaryLabel,
} from "@/components/JobCard";

export default function JobDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const query = new URLSearchParams(window.location.search);
  const returnPathValue = query.get("return");
  const returnPath =
    returnPathValue?.startsWith("/") && !returnPathValue.startsWith("//")
      ? returnPathValue
      : "/empleos";
  const detail = trpc.jobs.detail.useQuery({ id });
  const saved = trpc.saved.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const job = detail.data;
  const save = trpc.saved.toggle.useMutation({
    onSuccess: async result => {
      toast.success(
        result.saved ? "Oferta guardada" : "Oferta quitada de guardados"
      );
      await utils.jobs.detail.invalidate({ id });
      await utils.saved.list.invalidate();
    },
  });
  const updateNote = trpc.saved.note.useMutation({
    onSuccess: () => {
      toast.success("Nota guardada");
      utils.jobs.detail.invalidate({ id });
      utils.saved.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const similar = trpc.jobs.list.useQuery(
    {
      q: "",
      categories: job?.category ? [job.category] : undefined,
      regions: job?.regionCode ? [job.regionCode] : undefined,
      modalities: job?.modality ? [job.modality] : ["presencial"],
      includeUnknownModality: false,
      pageSize: 4,
      page: 1,
      sort: "recent",
    },
    { enabled: Boolean(job) }
  );
  useEffect(() => {
    setNote(job?.note ?? "");
  }, [job?.id, job?.note]);
  const currentSaved = Boolean(
    job?.saved || saved.data?.some(item => item.id === id)
  );
  const closeDatePassed = job?.expiresAt
    ? new Date(job.expiresAt).getTime() < Date.now()
    : false;
  const sourceLabels: Record<string, string> = {
    manual: "Carga manual",
    bne: "BNE",
    trabajando_cl: "Trabajando.cl",
    chiletrabajos: "ChileTrabajos",
    laborum_cl: "Laborum Chile",
    computrabajo_cl: "Computrabajo Chile",
    empleos_publicos: "Empleos Públicos",
    getonbrd_cl: "Get on Board",
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    smartrecruiters: "SmartRecruiters",
    workable: "Workable",
    recruitee: "Recruitee",
    other_ats: "Otro ATS",
    corporate: "Página corporativa",
    other: "Otra fuente manual",
  };
  const sourceOccurrences = job?.sourceOccurrences ?? [];
  const sourceCodes = [
    ...new Set([
      ...(job?.sourceCodes ?? []),
      ...sourceOccurrences.map(item => item.sourceCode),
    ]),
  ];
  const sourceText =
    sourceCodes.map(code => sourceLabels[code] ?? code).join(", ") ||
    "Fuente no informada";
  const locationText =
    [job?.communeName, job?.regionName].filter(Boolean).join(", ") ||
    job?.locationRaw ||
    job?.officeLocation ||
    job?.cityRaw ||
    "Lugar de trabajo no informado";
  const sourceUrls = [
    ...new Set([
      ...(job?.allSourceUrls ?? []),
      ...sourceOccurrences.flatMap(item =>
        item.originalUrl ? [item.originalUrl] : []
      ),
      ...(job?.canonicalUrl ? [job.canonicalUrl] : []),
    ]),
  ];
  const evidenceEntries = Object.entries(job?.sourceEvidence ?? {}).filter(
    ([, evidence]) => evidence && typeof evidence === "object"
  );
  const statusLabel =
    job?.verificationStatus === "vigente"
      ? "Vigente"
      : job?.verificationStatus === "vencido"
        ? "Vencida"
        : job?.verificationStatus === "archivado"
          ? "Archivada"
          : "Por verificar";
  const similarItems = useMemo(
    () => (similar.data?.items ?? []).filter(item => item.id !== id),
    [similar.data?.items, id]
  );
  if (detail.isLoading)
    return (
      <div className="page-wrap">
        <div className="empty-state">
          <span className="loading-spinner" />
          <p>Cargando ficha…</p>
        </div>
      </div>
    );
  if (detail.error || !job)
    return (
      <div className="page-wrap">
        <div className="page-heading">
          <button
            className="button button-quiet"
            type="button"
            onClick={() => setLocation(returnPath)}
          >
            <ArrowLeft size={15} /> Volver a resultados
          </button>
        </div>
        <div className="surface empty-state">
          <div className="empty-icon">
            <FileText size={20} />
          </div>
          <h2>La ficha no está disponible</h2>
          <p>
            La oferta pudo archivarse o retirarse. Vuelve a explorar las
            vacantes almacenadas.
          </p>
          <Link className="button button-primary" href={returnPath}>
            <ArrowLeft size={14} /> Volver a resultados
          </Link>
        </div>
      </div>
    );

  const textSection = (
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode
  ) => (
    <section className="job-detail-section">
      <h2>
        {icon}
        {title}
      </h2>
      {content}
    </section>
  );
  return (
    <div className="page-wrap">
      <div className="detail-page-top">
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setLocation(returnPath)}
        >
          <ArrowLeft size={15} /> Volver a resultados
        </button>
        <span className="detail-source-label">
          <ShieldCheck size={14} /> Registro local · {statusLabel}
        </span>
      </div>
      {closeDatePassed && (
        <div className="detail-warning">
          <CalendarClock size={15} />
          <span>
            La fecha de cierre informada ya pasó. Confirma la vigencia en la
            fuente original antes de actuar.
          </span>
        </div>
      )}
      <div className="job-full-layout">
        <article className="job-full-main surface">
          <div className="full-title-row">
            <div>
              <span className="eyebrow">OFERTA LABORAL · CHILE</span>
              <h1>{job.title}</h1>
              <div className="full-company">
                {job.companyConfidential
                  ? "Empresa confidencial"
                  : job.companyName}
              </div>
            </div>
            <button
              type="button"
              className={`button ${currentSaved ? "button-saved" : "button-secondary"}`}
              aria-pressed={currentSaved}
              disabled={save.isPending}
              onClick={() => save.mutate({ jobId: id })}
            >
              <Bookmark
                size={15}
                fill={currentSaved ? "currentColor" : "none"}
              />
              {currentSaved ? "Guardada" : "Guardar"}
            </button>
          </div>
          <div className="full-meta-grid">
            <div className="full-meta-item">
              <MapPin size={16} />
              <div>
                <small>Ubicación</small>
                <strong>{locationText}</strong>
                {job.officeLocation && job.officeLocation !== locationText && (
                  <small>Oficina: {job.officeLocation}</small>
                )}
              </div>
            </div>
            <div className="full-meta-item">
              <Clock3 size={16} />
              <div>
                <small>Modalidad</small>
                <strong>{modalityLabel(job.modality)}</strong>
              </div>
            </div>
            <div className="full-meta-item">
              <CircleDollarSign size={16} />
              <div>
                <small>Remuneración publicada</small>
                <strong>{salaryLabel(job)}</strong>
                <small>
                  {job.salaryBasis === "gross"
                    ? "Bruto"
                    : job.salaryBasis === "net"
                      ? "Líquido"
                      : "Base no informada"}
                  {job.salaryCurrency
                    ? ` · ${job.salaryCurrency}`
                    : job.salaryMinCLP != null || job.salaryMaxCLP != null
                      ? " · CLP"
                      : ""}
                  {job.salaryPeriod && job.salaryPeriod !== "unknown"
                    ? ` · ${job.salaryPeriod}`
                    : ""}
                </small>
              </div>
            </div>
            <div className="full-meta-item">
              <CalendarClock size={16} />
              <div>
                <small>Publicada</small>
                <strong>{formatJobDate(job.publishedAt)}</strong>
              </div>
            </div>
          </div>
          {textSection(
            "Descripción",
            <FileText size={15} />,
            <p className="prose-copy">
              {job.description?.trim() ||
                "Descripción no informada por la fuente."}
            </p>
          )}
          {textSection(
            "Responsabilidades",
            <CheckCircle2 size={15} />,
            job.responsibilities?.length ? (
              <ul className="prose-list">
                {job.responsibilities.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="prose-copy muted">Funciones no informadas.</p>
            )
          )}
          {textSection(
            "Requisitos",
            <CheckCircle2 size={15} />,
            job.requirements?.length ? (
              <ul className="prose-list">
                {job.requirements.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="prose-copy muted">Requisitos no informados.</p>
            )
          )}
          {job.mandatoryRequirements?.length
            ? textSection(
                "Requisitos excluyentes declarados",
                <ShieldCheck size={15} />,
                <ul className="prose-list">
                  {job.mandatoryRequirements.map(
                    (item: string, index: number) => (
                      <li key={index}>{item}</li>
                    )
                  )}
                </ul>
              )
            : null}
          {textSection(
            "Experiencia y formación",
            <BriefcaseBusiness size={15} />,
            <div className="detail-facts">
              <div>
                <small>Experiencia mínima</small>
                <strong>
                  {job.experienceMinYears == null
                    ? "No informada"
                    : `${job.experienceMinYears} año${job.experienceMinYears === 1 ? "" : "s"}`}
                </strong>
                {job.experienceRaw && <small>Fuente: {job.experienceRaw}</small>}
              </div>
              <div>
                <small>Formación</small>
                <strong>{job.educationLevel || "No informada"}</strong>
                {job.degreeNames?.length ? (
                  <small>{job.degreeNames.join(" · ")}</small>
                ) : null}
              </div>
              <div>
                <small>Nivel / seniority</small>
                <strong>{job.seniority || "No informado"}</strong>
              </div>
            </div>
          )}
          {textSection(
            "Jornada y contrato",
            <Clock3 size={15} />,
            <div className="detail-facts">
              <div>
                <small>Jornada</small>
                <strong>{job.schedule || "No informada"}</strong>
                {job.scheduleType && <small>{job.scheduleType}</small>}
              </div>
              <div>
                <small>Contrato</small>
                <strong>{job.contractType || job.employmentType || "No informado"}</strong>
              </div>
              {job.shift && (
                <div>
                  <small>Turno</small>
                  <strong>{job.shift}</strong>
                </div>
              )}
              {job.hoursPerWeek != null && (
                <div>
                  <small>Horas semanales</small>
                  <strong>{job.hoursPerWeek}</strong>
                </div>
              )}
              {job.vacancyCount != null && (
                <div>
                  <small>Vacantes</small>
                  <strong>{job.vacancyCount}</strong>
                </div>
              )}
              {job.practiceType && (
                <div>
                  <small>Práctica</small>
                  <strong>{job.practiceType}</strong>
                </div>
              )}
              {job.workplaceType && job.workplaceType !== "unknown" && (
                <div>
                  <small>Tipo de lugar</small>
                  <strong>
                    {job.workplaceType === "on_site"
                      ? "Presencial"
                      : job.workplaceType === "hybrid"
                        ? "Híbrido"
                        : "Remoto"}
                  </strong>
                </div>
              )}
            </div>
          )}
          {job.salaryComponents?.length &&
          job.salaryVisibility !== "reserved" &&
          job.salaryVisibility !== "not_disclosed"
            ? textSection(
                "Componentes de remuneración",
                <CircleDollarSign size={15} />,
                <ul className="prose-list">
                  {job.salaryComponents.map((component, index) => (
                    <li key={`${component.label}-${index}`}>
                      <strong>{component.label}</strong>
                      {component.amount != null
                        ? ` · ${component.currency ? `${component.currency} ` : ""}${component.amount}`
                        : ""}
                      {component.period ? ` · ${component.period}` : ""}
                      {component.basis === "gross"
                        ? " · bruto"
                        : component.basis === "net"
                          ? " · líquido"
                          : ""}
                    </li>
                  ))}
                </ul>
              )
            : null}
          {(job.applicationMethod ||
            job.requiredDocuments?.length ||
            job.recruitmentStages?.length) &&
            textSection(
              "Postulación y proceso",
              <FileText size={15} />,
              <div className="detail-facts">
                {job.applicationMethod && (
                  <div>
                    <small>Método informado</small>
                    <strong>{job.applicationMethod}</strong>
                  </div>
                )}
                {job.requiredDocuments?.length ? (
                  <div>
                    <small>Documentos requeridos</small>
                    <ul className="prose-list">
                      {job.requiredDocuments.map((document, index) => (
                        <li key={`${document}-${index}`}>{document}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {job.recruitmentStages?.length ? (
                  <div>
                    <small>Etapas informadas</small>
                    <ul className="prose-list">
                      {job.recruitmentStages.map((stage, index) => (
                        <li key={`${stage}-${index}`}>{stage}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          {textSection(
            "Beneficios",
            <Tag size={15} />,
            job.benefits?.length ? (
              <ul className="prose-list">
                {job.benefits.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="prose-copy muted">Beneficios no informados.</p>
            )
          )}
          {textSection(
            "Fuente y verificación",
            <ShieldCheck size={15} />,
            <div className="source-details">
              <div>
                <small>Fuente registrada</small>
                <strong>{sourceText}</strong>
              </div>
              <div>
                <small>Primera consulta</small>
                <strong>{formatJobDate(job.firstSeenAt)}</strong>
              </div>
              <div>
                <small>Última verificación</small>
                <strong>{formatJobDate(job.lastVerifiedAt)}</strong>
              </div>
              {job.expiresAt && (
                <div>
                  <small>Fecha de cierre informada</small>
                  <strong>{formatJobDate(job.expiresAt)}</strong>
                </div>
              )}
              {job.sourceObservedAt && (
                <div>
                  <small>Fecha de observación en la fuente</small>
                  <strong>{formatJobDate(job.sourceObservedAt)}</strong>
                </div>
              )}
              <div>
                <small>Estado</small>
                <strong>{statusLabel}</strong>
              </div>
              {job.originalTitle && job.originalTitle !== job.title && (
                <div>
                  <small>Título en la fuente</small>
                  <strong>{job.originalTitle}</strong>
                </div>
              )}
              {job.companySector && (
                <div>
                  <small>Sector de la empresa</small>
                  <strong>{job.companySector}</strong>
                </div>
              )}
              {job.department && (
                <div>
                  <small>Departamento</small>
                  <strong>{job.department}</strong>
                </div>
              )}
              {job.team && (
                <div>
                  <small>Equipo</small>
                  <strong>{job.team}</strong>
                </div>
              )}
              {job.occupationCodeCiuo && (
                <div>
                  <small>Código ocupacional CIUO</small>
                  <strong>{job.occupationCodeCiuo}</strong>
                </div>
              )}
              {job.companyBoardId && (
                <div>
                  <small>Board ATS registrado</small>
                  <strong>{job.companyBoardId}</strong>
                </div>
              )}
            </div>
          )}
          {sourceOccurrences.length > 0 &&
            textSection(
              "Ocurrencias de la oferta por fuente",
              <FileText size={15} />,
              <div className="source-details">
                {sourceOccurrences.map((occurrence, index) => (
                  <div key={`${occurrence.sourceCode}-${occurrence.sourceExternalId ?? index}`}>
                    <small>
                      {sourceLabels[occurrence.sourceCode] ?? occurrence.sourceCode}
                      {occurrence.sourceExternalId
                        ? ` · ID ${occurrence.sourceExternalId}`
                        : ""}
                    </small>
                    <strong>
                      Observada {formatJobDate(occurrence.capturedAt)}
                      {occurrence.sourceObservedAt
                        ? ` · fecha fuente ${formatJobDate(occurrence.sourceObservedAt)}`
                        : ""}
                    </strong>
                    {occurrence.provenance && (
                      <small>Procedencia: {occurrence.provenance}</small>
                    )}
                    {occurrence.originalUrl && (
                      <a
                        href={occurrence.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir URL de esta ocurrencia
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          {evidenceEntries.length > 0 && (
            <details className="job-detail-section">
              <summary>Evidencia conservada por campo</summary>
              <div className="source-details">
                {evidenceEntries.slice(0, 40).map(([field, evidence]) => (
                  <div key={field}>
                    <small>{field} · {evidence.level}</small>
                    {evidence.raw && <strong>{evidence.raw}</strong>}
                    {evidence.sourceCode && <small>Fuente: {evidence.sourceCode}</small>}
                    {evidence.observedAt && (
                      <small>Observado: {formatJobDate(evidence.observedAt)}</small>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
          {job.canonicalUrl ? (
            <a
              className="button button-primary original-link"
              href={job.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir la oferta en su fuente original <ArrowUpRight size={15} />
            </a>
          ) : (
            <div className="detail-warning muted-warning">
              <FileText size={15} />
              <span>
                No se registró un enlace original verificable para esta oferta.
              </span>
            </div>
          )}
          {job.applicationUrl && job.applicationUrl !== job.canonicalUrl && (
            <a
              className="button button-secondary original-link"
              href={job.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar a postulación en el sitio original <ArrowUpRight size={15} />
            </a>
          )}
          {sourceUrls.length > 1 && (
            <div className="additional-source-links">
              <strong>Otros enlaces registrados</strong>
              {sourceUrls
                .filter(url => url !== job.canonicalUrl)
                .map(url => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    {url}
                  </a>
                ))}
            </div>
          )}
        </article>
        <aside className="job-full-aside">
          <section className="surface private-note-card">
            <h2>
              <NotebookPen size={15} /> Nota privada
            </h2>
            <p>Visible solo en tu cuenta. No se envía a la empresa.</p>
            <textarea
              aria-label="Nota privada sobre esta oferta"
              value={note}
              onChange={event => setNote(event.target.value)}
              maxLength={5000}
              placeholder="Anota seguimiento, preguntas o referencias…"
            />
            <div className="note-actions">
              <small>{note.length}/5000</small>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={updateNote.isPending}
                onClick={() => updateNote.mutate({ jobId: id, note })}
              >
                Guardar nota
              </button>
            </div>
          </section>
          <section className="surface source-trust-card">
            <h2>
              <ShieldCheck size={15} /> Datos del registro
            </h2>
            <div>
              <span>País</span>
              <strong>Chile</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{statusLabel}</strong>
            </div>
            <div>
              <span>Fuente</span>
              <strong>{sourceText}</strong>
            </div>
            <p>
              La fecha de importación no confirma por sí sola que el aviso siga
              abierto.
            </p>
          </section>
        </aside>
      </div>
      {similarItems.length > 0 && (
        <section className="similar-jobs">
          <div className="similar-heading">
            <div>
              <span className="eyebrow">MISMA ÁREA</span>
              <h2>Ofertas similares almacenadas</h2>
            </div>
            <Link className="text-link" href={returnPath}>
              Volver a búsqueda <ArrowLeft size={13} />
            </Link>
          </div>
          <div className="data-grid">
            {similarItems.slice(0, 3).map(item => (
              <JobCard key={item.id} job={item} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
