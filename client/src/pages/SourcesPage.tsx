import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CircleHelp,
  Code2,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import type { AtsProvider, SourceCategory } from "@shared/domain";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const categories: Array<{ id: SourceCategory; title: string }> = [
  { id: "job_portal", title: "Portales laborales y corporativos" },
  { id: "ats", title: "ATS corporativos" },
  { id: "reference_data", title: "Datos de referencia (no son vacantes)" },
  { id: "manual", title: "Ingesta manual" },
];
const providerLabels: Record<AtsProvider, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
  other_ats: "Otro ATS (caso a caso)",
};
const capabilityLabels = [
  ["canRead", "Lectura técnica documentada"],
  ["hasStructuredSalary", "Sueldo estructurado"],
  ["hasPublishedAt", "Fecha de publicación"],
  ["hasExpiryDate", "Fecha de cierre"],
  ["hasWorkplaceType", "Tipo de lugar/modalidad"],
  ["hasFullDescription", "Detalle de oferta"],
  ["supportsComuna", "Comuna normalizada"],
  ["requiresCredential", "Requiere credenciales"],
] as const;

export default function SourcesPage() {
  const utils = trpc.useUtils();
  const sources = trpc.administration.sources.useQuery(undefined, {
    retry: false,
  });
  const boards = trpc.administration.atsBoards.useQuery(undefined, {
    retry: false,
  });
  const [selected, setSelected] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [provider, setProvider] = useState<AtsProvider>("greenhouse");
  const [boardId, setBoardId] = useState("");
  const [physicalLocationSummary, setPhysicalLocationSummary] = useState("");
  const [workplaceEvidence, setWorkplaceEvidence] = useState("");
  const [chilePhysicalSiteVerified, setChilePhysicalSiteVerified] =
    useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardActive, setBoardActive] = useState(true);
  const resetBoardForm = () => {
    setEditingBoardId(null);
    setCompanyName("");
    setProvider("greenhouse");
    setBoardId("");
    setPhysicalLocationSummary("");
    setWorkplaceEvidence("");
    setChilePhysicalSiteVerified(false);
    setBoardActive(true);
  };
  const status = trpc.administration.sourceStatus.useQuery(
    { id: selected },
    { enabled: Boolean(selected), retry: false }
  );
  const saveBoard = trpc.administration.saveAtsBoard.useMutation({
    onSuccess: async (_result, variables) => {
      if (variables.active === false)
        toast.success(
          variables.id
            ? "Board desactivado; sigue desconectado."
            : "Board registrado inactivo y desconectado."
        );
      else
        toast.success(
          variables.id
            ? "Board ATS actualizado; permanece desconectado."
            : "Board ATS registrado; permanece desconectado."
        );
      if (!variables.id || editingBoardId === variables.id) resetBoardForm();
      await utils.administration.atsBoards.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  type BoardRecord = NonNullable<typeof boards.data>[number];
  const editBoard = (board: BoardRecord) => {
    setEditingBoardId(board.id);
    setCompanyName(board.companyName);
    setProvider(board.provider as AtsProvider);
    setBoardId(board.boardId);
    setPhysicalLocationSummary(board.physicalLocationSummary ?? "");
    setWorkplaceEvidence(board.workplaceEvidence ?? "");
    setChilePhysicalSiteVerified(board.chilePhysicalSiteVerified);
    setBoardActive(board.active);
  };
  const changeBoardActive = (board: BoardRecord, active: boolean) =>
    saveBoard.mutate({
      id: board.id,
      companyId: board.companyId ?? undefined,
      companyName: board.companyName,
      provider: board.provider as AtsProvider,
      boardId: board.boardId,
      countryCode: "CL",
      physicalLocationSummary: board.physicalLocationSummary ?? "",
      workplaceEvidence: board.workplaceEvidence ?? "",
      chilePhysicalSiteVerified: board.chilePhysicalSiteVerified,
      active,
    });
  const sourceStatusText = (source: {
    accessMode: string;
    sourceStatus: string;
    category: string;
  }) =>
    source.accessMode === "manual_only"
      ? "Carga manual disponible"
      : source.category === "reference_data" && source.sourceStatus === "available"
        ? "Catálogo local disponible"
        : "No conectada";

  return (
    <div className="page-wrap admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN · FUENTES</span>
          <h1>Fuentes y boards</h1>
          <p>
            Catálogo de portales, ATS y referencias del Anexo 02. Las fichas
            describen disponibilidad potencial, no conexiones activas.
          </p>
        </div>
        <Link className="button button-primary" href="/administracion/ofertas">
          Ir a importación manual <ExternalLink size={13} />
        </Link>
      </div>

      <div className="source-callout">
        <ShieldCheck size={15} />
        <div>
          <strong>Sin scraping ni sincronización externa en esta fase</strong>
          <p>
            La carga manual procesa CSV/JSON en el servidor. Los registros de
            APIs públicas y portales no generan peticiones automáticas; la
            disponibilidad de lectura no significa que un conector esté activado.
          </p>
        </div>
      </div>

      {sources.isLoading ? (
        <div className="surface empty-state">
          <span className="loading-spinner" />
          <p>Consultando catálogo local…</p>
        </div>
      ) : sources.error ? (
        <div className="surface empty-state">
          <h2>No se pudo consultar el catálogo</h2>
          <button
            className="button button-secondary"
            onClick={() => sources.refetch()}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : (
        categories.map(category => {
          const records = sources.data?.filter(
            source => source.category === category.id
          ) ?? [];
          if (!records.length) return null;
          return (
            <section className="source-section" key={category.id}>
              <div className="admin-section-heading">
                <div>
                  <span className="eyebrow">CATÁLOGO DE FUENTES</span>
                  <h2>{category.title}</h2>
                </div>
                <span className="pill">{records.length} registros</span>
              </div>
              <div className="source-grid">
                {records.map(source => (
                  <article
                    className={`surface source-card ${selected === source.id ? "selected" : ""}`}
                    key={source.id}
                  >
                    <div className="source-card-head">
                      <div
                        className={`source-logo ${source.sourceStatus === "available" ? "available" : "pending"}`}
                      >
                        {source.sourceStatus === "available" ? (
                          <Database size={17} />
                        ) : (
                          <Unplug size={17} />
                        )}
                      </div>
                      <div className="source-card-title">
                        <h3>{source.label}</h3>
                        <p>
                          <code>{source.id}</code> · {source.sourceKind} ·{" "}
                          <code>{source.adapterContract}</code>
                        </p>
                      </div>
                      <span
                        className={`status-pill ${source.sourceStatus === "available" ? "status-vigente" : "status-por_verificar"}`}
                      >
                        {sourceStatusText(source)}
                      </span>
                    </div>
                    <p className="source-card-notes">{source.notes}</p>
                    <div className="source-card-stats">
                      <span>
                        <strong>{source.occurrenceCount}</strong> ocurrencias
                        importadas
                      </span>
                      <span>
                        <strong>
                          {source.lastSeenAt
                            ? new Intl.DateTimeFormat("es-CL", {
                                dateStyle: "medium",
                                timeZone: "America/Santiago",
                              }).format(new Date(source.lastSeenAt))
                            : "—"}
                        </strong>{" "}
                        última ocurrencia importada
                      </span>
                    </div>
                    <div className="source-card-actions">
                      <button
                        className="button button-quiet button-small"
                        type="button"
                        onClick={() =>
                          setSelected(current =>
                            current === source.id ? "" : source.id
                          )
                        }
                        aria-expanded={selected === source.id}
                      >
                        Ver capacidades/estado <Code2 size={13} />
                      </button>
                      {source.referenceUrl && (
                        <a
                          className="button button-quiet button-small"
                          href={source.referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Referencia <ArrowUpRight size={13} />
                        </a>
                      )}
                    </div>
                    {selected === source.id && (
                      <ul className="source-capability-list">
                        {capabilityLabels.map(([key, label]) => (
                          <li key={key}>
                            <span>{label}</span>
                            <strong>
                              {source.capabilities[key] ? "Sí" : "No documentado"}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}

      {selected && (
        <section className="surface source-contract-panel">
          <div className="admin-section-heading">
            <div>
              <span className="eyebrow">ESTADO LOCAL · SIN LLAMADAS EXTERNAS</span>
              <h2>
                {sources.data?.find(source => source.id === selected)?.label ??
                  selected}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setSelected("")}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>
          {status.isLoading ? (
            <p className="hint">Consultando el estado local…</p>
          ) : status.data ? (
            <div className="source-health-line">
              <Activity size={15} />
              <span>{status.data.healthCheck.message}</span>
              <span className="pill pill-outline">syncEnabled: false</span>
              <span className="pill pill-outline">
                Última sync exitosa: {status.data.lastSuccessfulSync ? "registrada" : "ninguna"}
              </span>
            </div>
          ) : (
            <p className="hint">No existe estado para esta fuente.</p>
          )}
          <h3>Contrato preparado (inactivo)</h3>
          <pre className="adapter-contract">
            <code>{`type Adapter<Raw, Normalized> = {
  sourceId: "${selected}";
  fetch(cursor?: string, filters?: Filters): Promise<{ records: Raw[]; nextCursor?: string | null }>;
  normalize(raw: Raw): Normalized;
  validate(record: Normalized): { valid: boolean; errors: string[] };
  healthCheck(): Promise<{ connected: boolean; checkedAt: string; message: string }>;
  rateLimitPolicy: { requestsPerMinute: number; backoffMs: number };
  lastRunAt: string | null;
  nextCursor: string | null;
  provenance: string;
};`}</code>
          </pre>
          <div className="source-notice">
            <CircleHelp size={14} />
            El contrato es documentación, no un adaptador operativo. No se
            consulta el portal, no hay scraping, credenciales, sincronización ni
            bypass de límites.
          </div>
        </section>
      )}

      <section className="surface source-contract-panel">
        <div className="admin-section-heading">
          <div>
            <span className="eyebrow">CATÁLOGO CORPORATIVO</span>
            <h2>{editingBoardId ? "Editar board ATS" : "Registrar un board ATS"}</h2>
            <p>
              La ficha vincula empresa, proveedor e ID externo. No valida ni
              consulta el sitio; requiere evidencia de sede física en Chile para
              marcarla como verificada.
            </p>
          </div>
          <Building2 size={19} />
        </div>
        <form
          className="form-panel"
          onSubmit={event => {
            event.preventDefault();
            saveBoard.mutate({
              id: editingBoardId ?? undefined,
              companyName,
              provider,
              boardId,
              countryCode: "CL",
              physicalLocationSummary,
              workplaceEvidence,
              chilePhysicalSiteVerified,
              active: boardActive,
            });
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Empresa</span>
              <input
                required
                maxLength={255}
                value={companyName}
                onChange={event => setCompanyName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Proveedor ATS</span>
              <select
                value={provider}
                onChange={event => setProvider(event.target.value as AtsProvider)}
              >
                {Object.entries(providerLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ID del board/sitio en el ATS</span>
              <input
                required
                maxLength={255}
                pattern="[A-Za-z0-9._-]+"
                value={boardId}
                onChange={event => setBoardId(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Sede física / comuna en Chile</span>
              <input
                maxLength={255}
                value={physicalLocationSummary}
                onChange={event => setPhysicalLocationSummary(event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Evidencia verificable de sede/aviso presencial</span>
            <textarea
              maxLength={2_000}
              value={workplaceEvidence}
              onChange={event => setWorkplaceEvidence(event.target.value)}
              placeholder="URL revisada y señal concreta que confirma una oficina física en Chile. No pegues credenciales."
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={chilePhysicalSiteVerified}
              onChange={event => setChilePhysicalSiteVerified(event.target.checked)}
            />
            <span>
              Revisé la evidencia y confirma sede física en Chile. No confirma
              conexión ni disponibilidad del empleo.
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={boardActive}
              onChange={event => setBoardActive(event.target.checked)}
            />
            <span>Activo en el catálogo local; esto no conecta ni sincroniza el board.</span>
          </label>
          <div className="ats-form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={saveBoard.isPending}
            >
              {saveBoard.isPending
                ? "Guardando…"
                : editingBoardId
                  ? "Actualizar board sin conectar"
                  : "Guardar board sin conectar"}
            </button>
            {editingBoardId && (
              <button
                className="button button-quiet button-small"
                type="button"
                onClick={resetBoardForm}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
        {boards.error ? (
          <div className="inline-alert alert-error">
            No se pudo consultar el catálogo de boards.
          </div>
        ) : boards.isLoading ? (
          <p className="hint">Consultando boards…</p>
        ) : boards.data?.length ? (
          <div className="ats-board-list">
            {boards.data.map(board => (
              <article className="ats-board-row" key={board.id}>
                <div className="ats-board-main">
                  <strong>{board.companyName}</strong>
                  <span>
                    {providerLabels[board.provider as AtsProvider] ?? board.provider}
                    {" · "}
                    <code>{board.boardId}</code>
                  </span>
                  <span>
                    {board.physicalLocationSummary || "Sede no documentada"}
                    {" · "}
                    {board.chilePhysicalSiteVerified
                      ? "sede chilena verificada"
                      : "pendiente de evidencia"}
                  </span>
                </div>
                <span className="status-pill status-por_verificar ats-board-status">
                  <Unplug size={12} />
                  {board.active ? "activo · no conectado" : "inactivo · no conectado"}
                </span>
                <div className="ats-board-actions">
                  <button
                    className="button button-quiet button-small"
                    type="button"
                    disabled={saveBoard.isPending}
                    onClick={() => editBoard(board)}
                  >
                    Editar
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={saveBoard.isPending}
                    onClick={() => changeBoardActive(board, !board.active)}
                  >
                    {board.active ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="hint">Aún no hay boards registrados.</p>
        )}
      </section>

      <div className="surface source-footer-note">
        <span className="eyebrow">FASE 1 · MANUAL</span>
        <p>
          Cada oferta guarda códigos de fuente, URLs originales, ID externo,
          hash del registro, fecha observada y evidencia. Dos fuentes de una
          misma vacante conservan sus ocurrencias aunque se muestre una sola ficha.
        </p>
      </div>
    </div>
  );
}
