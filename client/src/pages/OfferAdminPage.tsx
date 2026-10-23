import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { FieldEvidence, Modality, VerificationStatus } from "@shared/domain";
import { communesForRegion, regions } from "@shared/locations";
import { trpc } from "@/lib/trpc";
import {
  autoMapHeaders,
  importMappingGroups,
  importMappingLabels,
  mapImportRows,
  parseImportFile,
  primaryImportFields,
  type ImportRow,
} from "@/lib/importData";

const emptyEditor = {
  id: "",
  title: "",
  originalTitle: "",
  companyName: "",
  companySector: "",
  confidential: false,
  canonicalUrl: "",
  applicationUrl: "",
  applicationMethod: "",
  regionCode: "",
  communeCode: "",
  locality: "",
  cityRaw: "",
  locationRaw: "",
  officeLocation: "",
  category: "",
  subcategory: "",
  sector: "",
  department: "",
  team: "",
  occupationCodeCiuo: "",
  seniority: "",
  workplaceType: "unknown" as "on_site" | "hybrid" | "remote" | "unknown",
  workplaceEvidence: "",
  modality: "no_informada" as Modality,
  schedule: "",
  scheduleType: "",
  shift: "",
  hoursPerWeek: "",
  vacancyCount: "",
  practiceType: "",
  employmentType: "",
  contractType: "",
  experience: "",
  experienceRaw: "",
  educationLevel: "",
  degreeNames: "",
  salaryMin: "",
  salaryMax: "",
  salaryMinSource: "",
  salaryMaxSource: "",
  salaryRaw: "",
  salaryCurrency: "",
  salaryPeriod: "",
  salaryVisibility: "",
  salaryComponentsJson: "",
  salaryEvidenceJson: "",
  salaryBasis: "unknown" as "gross" | "net" | "unknown",
  description: "",
  responsibilities: "",
  requirements: "",
  mandatoryRequirements: "",
  benefits: "",
  skills: "",
  skillsExplicit: "",
  licenses: "",
  languages: "",
  requiredDocuments: "",
  recruitmentStages: "",
  sourceCode: "manual",
  sourceExternalId: "",
  companyBoardId: "",
  sourceEvidenceJson: "",
  publishedAt: "",
  expiresAt: "",
  verificationStatus: "por_verificar" as VerificationStatus,
  verified: false,
  provenance: "Carga manual autorizada",
};
const split = (value: string) =>
  value
    .split(/[\n;|]/)
    .map(part => part.trim())
    .filter(Boolean);
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;
const dateForInput = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
const dateAtSantiagoNoon = (value: string) =>
  value ? new Date(`${value}T12:00:00-03:00`).toISOString() : undefined;
function parseEditorJson(
  value: string,
  label: string,
  expected: "array"
): Array<Record<string, unknown>> | undefined;
function parseEditorJson(
  value: string,
  label: string,
  expected: "object"
): Record<string, unknown> | undefined;
function parseEditorJson(
  value: string,
  label: string,
  expected: "array" | "object"
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  if (!value.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} debe ser JSON válido.`);
  }
  if (expected === "array") {
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        item => item && typeof item === "object" && !Array.isArray(item)
      )
    )
      throw new Error(`${label} debe ser un arreglo JSON de objetos.`);
    return parsed as Array<Record<string, unknown>>;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`${label} debe ser un objeto JSON.`);
  return parsed as Record<string, unknown>;
}

export default function OfferAdminPage() {
  const utils = trpc.useUtils();
  const jobs = trpc.administration.jobs.useQuery(undefined, { retry: false });
  const imports = trpc.administration.imports.useQuery(undefined, {
    retry: false,
  });
  const exportQuery = trpc.administration.exportJobs.useQuery(undefined, {
    enabled: false,
  });
  const sources = trpc.administration.sources.useQuery(undefined, {
    retry: false,
  });
  const [tab, setTab] = useState<"all" | "active" | "archived">("all");
  const [editor, setEditor] = useState<typeof emptyEditor | null>(null);
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | undefined>>(
    {}
  );
  const [selectedBatch, setSelectedBatch] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [previewedPayloadKey, setPreviewedPayloadKey] = useState<string | null>(
    null
  );
  const mappedRows = useMemo(
    () => (rawRows.length ? mapImportRows(rawRows, mapping) : []),
    [rawRows, mapping]
  );
  const preview = trpc.administration.importPreview.useMutation({
    onError: error => toast.error(error.message),
  });
  const mappedRowsKey = useMemo(() => JSON.stringify(mappedRows), [mappedRows]);
  const previewIsCurrent =
    preview.data !== undefined && previewedPayloadKey === mappedRowsKey;
  const commit = trpc.administration.importCommit.useMutation({
    onSuccess: async result => {
      setSelectedBatch(result.id);
      setConfirmImport(false);
      setRawRows([]);
      setFileName("");
      preview.reset();
      setPreviewedPayloadKey(null);
      toast.success(
        `Importación confirmada: ${result.importedCount} nuevas, ${result.duplicateCount} duplicadas, ${result.errorCount} con error.`
      );
      await Promise.all([
        utils.administration.jobs.invalidate(),
        utils.administration.imports.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const create = trpc.jobs.create.useMutation({
    onSuccess: async () => {
      toast.success("Oferta guardada como registro real");
      setEditor(null);
      await Promise.all([
        utils.administration.jobs.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.jobs.update.useMutation({
    onSuccess: async () => {
      toast.success("Oferta actualizada");
      setEditor(null);
      await Promise.all([
        utils.administration.jobs.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.jobs.archive.useMutation({
    onSuccess: async () => {
      toast.success("Oferta archivada; ya no aparece en Explorar");
      await Promise.all([
        utils.administration.jobs.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const restore = trpc.administration.restoreJob.useMutation({
    onSuccess: async () => {
      toast.success("Oferta restaurada como pendiente de verificación");
      await Promise.all([
        utils.administration.jobs.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const importErrors = trpc.administration.importErrors.useQuery(
    { id: selectedBatch },
    { enabled: Boolean(selectedBatch), retry: false }
  );
  const rows = jobs.data ?? [];
  const visibleRows = rows.filter(
    row =>
      tab === "all" ||
      (tab === "archived"
        ? row.verificationStatus === "archivado" || !row.active
        : row.active && row.verificationStatus !== "archivado")
  );
  const activeCount = rows.filter(
    row => row.active && row.verificationStatus !== "archivado"
  ).length;
  const archivedCount = rows.length - activeCount;
  const importPreview = preview.data;
  const currentHeaders = Object.keys(rawRows[0] ?? {});
  const primaryImportFieldSet = new Set<string>(primaryImportFields);
  const updateMapping = (field: string, header: string) => {
    setMapping(current => ({ ...current, [field]: header || undefined }));
    setPreviewedPayloadKey(null);
    setConfirmImport(false);
    preview.reset();
  };
  const renderMappingField = (field: string) => {
    const label = importMappingLabels[field];
    if (!label) return null;
    return (
      <label className="mapping-row" key={field}>
        <span>{label}</span>
        <select
          value={mapping[field] ?? ""}
          onChange={event => updateMapping(field, event.target.value)}
        >
          <option value="">Sin mapear</option>
          {currentHeaders.map(header => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
      </label>
    );
  };
  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 5 MB.");
      return;
    }
    try {
      const text = await file.text();
      const data = parseImportFile(file.name, text);
      if (!data.length)
        throw new Error("El archivo no contiene filas de ofertas.");
      if (data.length > 2000)
        throw new Error("El máximo admitido es 2.000 filas por lote.");
      setFileName(file.name);
      setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
      setRawRows(data);
      setMapping(autoMapHeaders(Object.keys(data[0])));
      setConfirmImport(false);
      setPreviewedPayloadKey(null);
      preview.reset();
      toast.success(
        `${data.length} filas leídas localmente. Revisa el mapeo y solicita la previsualización.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo leer el archivo."
      );
    }
  };
  const requestPreview = () => {
    if (!mappedRows.length) return;
    setPreviewedPayloadKey(null);
    setConfirmImport(false);
    preview.mutate(
      { rows: mappedRows },
      { onSuccess: () => setPreviewedPayloadKey(mappedRowsKey) }
    );
  };
  const acceptImport = () => {
    if (!previewIsCurrent) {
      toast.error("El mapeo cambió; solicita una nueva previsualización.");
      return;
    }
    if (
      !importPreview ||
      importPreview.some(row => row.status !== "error") === false
    ) {
      toast.error("No hay filas válidas para confirmar.");
      return;
    }
    if (
      !window.confirm(
        `Confirmar importación de ${importPreview.filter(row => row.status !== "error").length} ofertas válidas. Las duplicadas conservarán su identidad y guardados.`
      )
    )
      return;
    commit.mutate({ rows: mappedRows, fileName, format });
  };
  const startEdit = (job: (typeof rows)[number]) =>
    setEditor({
      ...emptyEditor,
      id: job.id,
      title: job.title,
      originalTitle: job.originalTitle ?? "",
      companyName: job.companyName,
      companySector: job.companySector ?? "",
      confidential: job.companyConfidential ?? false,
      canonicalUrl: job.canonicalUrl ?? "",
      applicationUrl: job.applicationUrl ?? "",
      applicationMethod: job.applicationMethod ?? "",
      regionCode: job.regionCode ?? "",
      communeCode: job.communeCode ?? "",
      locality: job.locality ?? "",
      cityRaw: job.cityRaw ?? "",
      locationRaw: job.locationRaw ?? "",
      officeLocation: job.officeLocation ?? "",
      category: job.category ?? "",
      subcategory: job.subcategory ?? "",
      sector: job.sector ?? "",
      department: job.department ?? "",
      team: job.team ?? "",
      occupationCodeCiuo: job.occupationCodeCiuo ?? "",
      seniority: job.seniority ?? "",
      workplaceType: job.workplaceType ?? "unknown",
      workplaceEvidence: JSON.stringify(job.workplaceEvidence ?? {}, null, 2),
      modality: job.modality,
      schedule: job.schedule ?? "",
      scheduleType: job.scheduleType ?? "",
      shift: job.shift ?? "",
      hoursPerWeek: job.hoursPerWeek == null ? "" : String(job.hoursPerWeek),
      vacancyCount: job.vacancyCount == null ? "" : String(job.vacancyCount),
      practiceType: job.practiceType ?? "",
      employmentType: job.employmentType ?? "",
      contractType: job.contractType ?? "",
      experience:
        job.experienceMinYears == null ? "" : String(job.experienceMinYears),
      experienceRaw: job.experienceRaw ?? "",
      educationLevel: job.educationLevel ?? "",
      degreeNames: (job.degreeNames ?? []).join("\n"),
      salaryMin: job.salaryMinCLP == null ? "" : String(job.salaryMinCLP),
      salaryMax: job.salaryMaxCLP == null ? "" : String(job.salaryMaxCLP),
      salaryMinSource: job.salaryMinSource == null ? "" : String(job.salaryMinSource),
      salaryMaxSource: job.salaryMaxSource == null ? "" : String(job.salaryMaxSource),
      salaryRaw: job.salaryRaw ?? "",
      salaryCurrency: job.salaryCurrency ?? "",
      salaryPeriod: job.salaryPeriod ?? "",
      salaryVisibility: job.salaryVisibility ?? "unknown",
      salaryComponentsJson: JSON.stringify(job.salaryComponents ?? [], null, 2),
      salaryEvidenceJson: JSON.stringify(job.salaryEvidence ?? {}, null, 2),
      salaryBasis: job.salaryBasis ?? "unknown",
      description: job.description,
      responsibilities: (job.responsibilities ?? []).join("\n"),
      requirements: (job.requirements ?? []).join("\n"),
      mandatoryRequirements: (job.mandatoryRequirements ?? []).join("\n"),
      benefits: (job.benefits ?? []).join("\n"),
      skills: (job.skills ?? []).join("\n"),
      skillsExplicit: (job.skillsExplicit ?? []).join("\n"),
      licenses: (job.licenses ?? []).join("\n"),
      languages: (job.languages ?? []).join("\n"),
      requiredDocuments: (job.requiredDocuments ?? []).join("\n"),
      recruitmentStages: (job.recruitmentStages ?? []).join("\n"),
      sourceCode: job.sourceCodes?.[0] ?? "manual",
      sourceExternalId: job.sourceExternalIds?.[0] ?? "",
      companyBoardId: job.companyBoardId ?? "",
      sourceEvidenceJson: JSON.stringify(job.sourceEvidence ?? {}, null, 2),
      publishedAt: dateForInput(job.publishedAt),
      expiresAt: dateForInput(job.expiresAt),
      verificationStatus: job.verificationStatus ?? "por_verificar",
      verified: job.verificationStatus === "vigente",
      provenance: "Edición autorizada",
    });
  const submitEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    if (
      editor.salaryMin &&
      editor.salaryMax &&
      Number(editor.salaryMin) > Number(editor.salaryMax)
    ) {
      toast.error("El sueldo mínimo no puede superar el máximo.");
      return;
    }
    if (editor.verificationStatus === "vigente" && !editor.verified) {
      toast.error(
        "Confirma que revisaste la vigencia antes de marcar la oferta como vigente."
      );
      return;
    }
    const selectedRegion = regions.find(
      item => item.code === editor.regionCode
    );
    const selectedCommune = communesForRegion(editor.regionCode).find(
      item => item.communeCode === editor.communeCode
    );
    let salaryComponents: Array<Record<string, unknown>> | undefined;
    let salaryEvidence: Record<string, unknown> | undefined;
    let workplaceEvidence: Record<string, unknown> | undefined;
    let sourceEvidence: Record<string, FieldEvidence> | undefined;
    try {
      salaryComponents = parseEditorJson(
        editor.salaryComponentsJson,
        "Componentes de remuneración",
        "array"
      );
      salaryEvidence = parseEditorJson(
        editor.salaryEvidenceJson,
        "Evidencia salarial",
        "object"
      );
      workplaceEvidence = parseEditorJson(
        editor.workplaceEvidence,
        "Evidencia de modalidad",
        "object"
      );
      sourceEvidence = parseEditorJson(
        editor.sourceEvidenceJson,
        "Evidencia por campo",
        "object"
      ) as Record<string, FieldEvidence> | undefined;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revisa el JSON avanzado.");
      return;
    }
    const payload = {
      title: editor.title,
      originalTitle: editor.originalTitle || undefined,
      companyName: editor.confidential ? "" : editor.companyName,
      companySector: editor.companySector || undefined,
      companyConfidential: editor.confidential,
      countryCode: "CL",
      regionCode: selectedRegion?.code,
      regionName: selectedRegion?.name,
      communeCode: selectedCommune?.communeCode,
      communeName: selectedCommune?.communeName,
      locality: editor.locality || undefined,
      cityRaw: editor.cityRaw || undefined,
      locationRaw: editor.locationRaw || undefined,
      officeLocation: editor.officeLocation || undefined,
      category: editor.category || undefined,
      subcategory: editor.subcategory || undefined,
      sector: editor.sector || undefined,
      department: editor.department || undefined,
      team: editor.team || undefined,
      occupationCodeCiuo: editor.occupationCodeCiuo || undefined,
      seniority: editor.seniority || undefined,
      modality: editor.modality,
      workplaceType: editor.workplaceType,
      workplaceEvidence,
      schedule: editor.schedule || undefined,
      scheduleType: editor.scheduleType || undefined,
      shift: editor.shift || undefined,
      hoursPerWeek: editor.hoursPerWeek ? Number(editor.hoursPerWeek) : null,
      vacancyCount: editor.vacancyCount ? Number(editor.vacancyCount) : null,
      practiceType: editor.practiceType || undefined,
      employmentType: editor.employmentType || undefined,
      contractType: editor.contractType || undefined,
      experienceMinYears: editor.experience ? Number(editor.experience) : null,
      experienceRaw: editor.experienceRaw || undefined,
      educationLevel: editor.educationLevel || undefined,
      degreeNames: split(editor.degreeNames),
      salaryMinCLP: editor.salaryMin ? Number(editor.salaryMin) : null,
      salaryMaxCLP: editor.salaryMax ? Number(editor.salaryMax) : null,
      salaryMinSource: editor.salaryMinSource || undefined,
      salaryMaxSource: editor.salaryMaxSource || undefined,
      salaryRaw: editor.salaryRaw || undefined,
      salaryCurrency: editor.salaryCurrency || undefined,
      salaryPeriod: editor.salaryPeriod || undefined,
      salaryVisibility: editor.salaryVisibility
        ? (editor.salaryVisibility as
            | "disclosed"
            | "reserved"
            | "not_disclosed"
            | "unknown")
        : undefined,
      salaryComponents,
      salaryEvidence,
      salaryBasis: editor.salaryBasis,
      salaryIsDisclosed: Boolean(editor.salaryMin || editor.salaryMax),
      description: editor.description,
      responsibilities: split(editor.responsibilities),
      requirements: split(editor.requirements),
      mandatoryRequirements: split(editor.mandatoryRequirements),
      benefits: split(editor.benefits),
      skills: split(editor.skills),
      skillsExplicit: split(editor.skillsExplicit),
      licenses: split(editor.licenses),
      languages: split(editor.languages),
      requiredDocuments: split(editor.requiredDocuments),
      recruitmentStages: split(editor.recruitmentStages),
      sourceCodes: [editor.sourceCode],
      sourceExternalIds: editor.sourceExternalId
        ? [editor.sourceExternalId]
        : [],
      companyBoardId: editor.companyBoardId || undefined,
      sourceEvidence,
      canonicalUrl: editor.canonicalUrl || null,
      applicationUrl: editor.applicationUrl || undefined,
      applicationMethod: editor.applicationMethod || undefined,
      publishedAt: dateAtSantiagoNoon(editor.publishedAt) ?? null,
      expiresAt: dateAtSantiagoNoon(editor.expiresAt) ?? null,
      lastVerifiedAt: editor.verified ? new Date().toISOString() : null,
      verificationStatus: editor.verificationStatus,
      active: editor.verificationStatus !== "archivado",
      provenance: editor.provenance,
    };
    if (editor.id) update.mutate({ id: editor.id, patch: payload });
    else create.mutate(payload);
  };
  const exportData = async () => {
    try {
      const result = await exportQuery.refetch();
      if (!result.data?.length) {
        toast.info("No hay ofertas para exportar.");
        return;
      }
      const keys = Object.keys(result.data[0]);
      const csv = [
        keys.map(csvCell).join(","),
        ...result.data.map(row =>
          keys
            .map(key => csvCell((row as Record<string, unknown>)[key]))
            .join(",")
        ),
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "empleos-chile-export.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(
        `${result.data.length} ofertas exportadas a este dispositivo.`
      );
    } catch {
      toast.error("No se pudo exportar el conjunto de ofertas.");
    }
  };
  const selectedRow = (job: (typeof rows)[number]) => {
    const archived = !job.active || job.verificationStatus === "archivado";
    const status = job.verificationStatus ?? "por_verificar";
    return (
      <tr key={job.id}>
        <td>
          <strong>{job.title}</strong>
          <span className="admin-table-sub">
            {job.companyConfidential ? "Empresa confidencial" : job.companyName}
          </span>
        </td>
        <td>
          {[job.communeName, job.regionName].filter(Boolean).join(", ") ||
            "Sin ubicación"}
        </td>
        <td>
          <span className={`status-pill status-${status}`}>
            {status.replaceAll("_", " ")}
          </span>
        </td>
        <td>{job.sourceCodes?.join(", ") || "manual"}</td>
        <td>
          {job.lastVerifiedAt
            ? new Intl.DateTimeFormat("es-CL", {
                dateStyle: "medium",
                timeZone: "America/Santiago",
              }).format(new Date(job.lastVerifiedAt))
            : "No verificada"}
        </td>
        <td>
          <div className="table-actions">
            <button
              className="button button-quiet button-small"
              onClick={() => startEdit(job)}
            >
              Editar
            </button>
            {archived ? (
              <button
                className="button button-secondary button-small"
                disabled={restore.isPending}
                onClick={() => restore.mutate({ id: job.id })}
              >
                <RotateCcw size={12} /> Restaurar
              </button>
            ) : (
              <button
                className="button button-quiet button-small"
                disabled={archive.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Archivar “${job.title}”? Dejará de aparecer en Explorar.`
                    )
                  )
                    archive.mutate({ id: job.id });
                }}
              >
                <Archive size={12} /> Archivar
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };
  const renderEditorField = (
    label: string,
    key: keyof typeof emptyEditor,
    inputType: "text" | "date" | "number" = "text",
    placeholder = ""
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        type={inputType}
        value={String(editor?.[key] ?? "")}
        placeholder={placeholder}
        onChange={event =>
          setEditor(current =>
            current
              ? ({
                  ...current,
                  [key]: event.target.value,
                } as typeof emptyEditor)
              : current
          )
        }
      />
    </label>
  );
  const renderTextArea = (
    label: string,
    key: keyof typeof emptyEditor,
    placeholder = ""
  ) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        value={String(editor?.[key] ?? "")}
        placeholder={placeholder}
        onChange={event =>
          setEditor(current =>
            current
              ? ({
                  ...current,
                  [key]: event.target.value,
                } as typeof emptyEditor)
              : current
          )
        }
      />
    </label>
  );

  return (
    <div className="page-wrap admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN · CONTENIDO</span>
          <h1>Ofertas</h1>
          <p>
            Carga manual y curación de vacantes chilenas; no se ejecutan
            scrapers ni sincronizaciones externas.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={exportData}
          >
            <ArrowDownToLine size={14} /> Exportar CSV
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setEditor({ ...emptyEditor })}
          >
            <Plus size={15} /> Nueva oferta
          </button>
        </div>
      </div>
      <div className="admin-stat-row">
        <div className="admin-stat">
          <span>Ofertas en este proyecto</span>
          <strong>{jobs.isLoading ? "—" : rows.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Publicadas/activas</span>
          <strong>{jobs.isLoading ? "—" : activeCount}</strong>
        </div>
        <div className="admin-stat">
          <span>Archivadas</span>
          <strong>{jobs.isLoading ? "—" : archivedCount}</strong>
        </div>
        <div className="admin-stat">
          <span>Límite de previsualización</span>
          <strong>2.000 filas</strong>
        </div>
      </div>
      <div className="admin-columns">
        <div className="admin-main-column">
          <section className="surface import-card">
            <div className="admin-section-heading">
              <div>
                <h2>
                  <Upload size={15} /> Importar ofertas
                </h2>
                <p>
                  Procesamiento local del archivo, luego almacenamiento en esta
                  base de datos. Solo Chile.
                </p>
              </div>
              <a
                className="button button-quiet button-small"
                href="/plantilla-empleos.csv"
                download
              >
                <ArrowDownToLine size={12} /> Plantilla CSV
              </a>
            </div>
            <label
              className={`file-drop admin-file-drop ${rawRows.length ? "file-ready" : ""}`}
            >
              <FileSpreadsheet size={20} />
              <strong>{fileName || "Selecciona un archivo CSV o JSON"}</strong>
              <span>
                5 MB · hasta 2.000 filas · sin terceros · no sube a servicios
                externos
              </span>
              <input
                type="file"
                accept=".csv,.json,.tsv,text/csv,application/json"
                onChange={handleImportFile}
              />
            </label>
            {rawRows.length > 0 && (
              <>
                <div className="import-file-summary">
                  <span>
                    {rawRows.length} filas leídas · {currentHeaders.length}{" "}
                    columnas detectadas
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Quitar archivo"
                    onClick={() => {
                      setRawRows([]);
                      setFileName("");
                      preview.reset();
                      setConfirmImport(false);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <details className="mapping-details">
                  <summary>
                    Revisar mapeo de columnas <ChevronDown size={14} />
                  </summary>
                  <section className="mapping-primary">
                    <span className="eyebrow">Campos principales</span>
                    <div className="mapping-grid">
                      {primaryImportFields.map(renderMappingField)}
                    </div>
                  </section>
                  {importMappingGroups.map(group => (
                    <details className="mapping-group" key={group.label}>
                      <summary>{group.label}</summary>
                      <div className="mapping-grid">
                        {group.fields
                          .filter(field => !primaryImportFieldSet.has(field))
                          .map(renderMappingField)}
                      </div>
                    </details>
                  ))}
                  <p className="hint">
                    Las columnas reconocidas automáticamente se pueden corregir;
                    un registro necesita al menos un cargo y debe corresponder a
                    Chile.
                  </p>
                </details>
                <div className="import-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={preview.isPending || mappedRows.length === 0}
                    onClick={requestPreview}
                  >
                    <RefreshCw size={13} />
                    {preview.isPending ? "Validando…" : "Previsualizar lote"}
                  </button>
                  {importPreview && previewIsCurrent && (
                    <span className="hint">
                      Previsualización calculada para {importPreview.length}{" "}
                      filas; sin cambios todavía.
                    </span>
                  )}
                </div>
                {importPreview && !previewIsCurrent && (
                  <span className="hint" role="status">
                    El mapeo cambió; vuelve a previsualizar antes de confirmar.
                  </span>
                )}
              </>
            )}
            {preview.error && (
              <div className="inline-alert alert-error">
                <ShieldAlert size={14} />
                {preview.error.message}
              </div>
            )}
            {importPreview && previewIsCurrent && (
              <div className="import-preview">
                <div className="preview-counts">
                  <span className="preview-count good">
                    <strong>
                      {
                        importPreview.filter(item => item.status === "new")
                          .length
                      }
                    </strong>{" "}
                    nuevas
                  </span>
                  <span className="preview-count duplicate">
                    <strong>
                      {
                        importPreview.filter(
                          item => item.status === "duplicate"
                        ).length
                      }
                    </strong>{" "}
                    posibles duplicadas
                  </span>
                  <span className="preview-count bad">
                    <strong>
                      {
                        importPreview.filter(item => item.status === "error")
                          .length
                      }
                    </strong>{" "}
                    errores
                  </span>
                </div>
                <div className="import-preview-table-wrap">
                  <table className="admin-table import-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Cargo</th>
                        <th>Empresa</th>
                        <th>Validación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 50).map(item => (
                        <tr key={item.rowNumber}>
                          <td>{item.rowNumber}</td>
                          <td>{item.title ?? "—"}</td>
                          <td>{item.companyName ?? "No informada"}</td>
                          <td>
                            <span
                              className={`status-pill status-${item.status}`}
                            >
                              {item.status === "new"
                                ? "Nueva"
                                : item.status === "duplicate"
                                  ? "Posible duplicada"
                                  : "Error"}
                            </span>
                            <span className="admin-table-sub">
                              {item.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 50 && (
                    <div className="table-more">
                      Mostrando las primeras 50 filas. El historial registra los
                      totales de todas las filas.
                    </div>
                  )}
                </div>
                <label className="check-row import-confirm-check">
                  <input
                    type="checkbox"
                    checked={confirmImport}
                    onChange={event => setConfirmImport(event.target.checked)}
                  />
                  <span>
                    Confirmo la importación de datos autorizados y revisé las
                    advertencias por fila.
                  </span>
                </label>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={
                    !confirmImport ||
                    commit.isPending ||
                    !previewIsCurrent ||
                    !importPreview.some(item => item.status !== "error")
                  }
                  onClick={acceptImport}
                >
                  <Check size={14} />
                  {commit.isPending ? "Importando…" : "Confirmar importación"}
                </button>
              </div>
            )}
          </section>
          <section className="surface admin-offers-section">
            <div className="admin-section-heading">
              <div>
                <h2>Ofertas almacenadas</h2>
                <p>
                  Identidad persistente por URL, ID externo o huella de oferta.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Actualizar ofertas"
                onClick={() => jobs.refetch()}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <div
              className="admin-tabs"
              role="tablist"
              aria-label="Filtrar ofertas"
            >
              <button
                className={tab === "all" ? "active" : ""}
                onClick={() => setTab("all")}
              >
                Todas <span>{rows.length}</span>
              </button>
              <button
                className={tab === "active" ? "active" : ""}
                onClick={() => setTab("active")}
              >
                Activas <span>{activeCount}</span>
              </button>
              <button
                className={tab === "archived" ? "active" : ""}
                onClick={() => setTab("archived")}
              >
                Archivadas <span>{archivedCount}</span>
              </button>
            </div>
            {jobs.isLoading ? (
              <div className="admin-loading">
                <span className="loading-spinner" /> Consultando la base de
                datos…
              </div>
            ) : jobs.error ? (
              <div className="inline-alert alert-error">
                <ShieldAlert size={14} />
                {jobs.error.message}
                <button
                  className="button button-small button-quiet"
                  onClick={() => jobs.refetch()}
                >
                  Reintentar
                </button>
              </div>
            ) : visibleRows.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cargo / empresa</th>
                      <th>Ubicación</th>
                      <th>Estado</th>
                      <th>Fuente</th>
                      <th>Última verificación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>{visibleRows.map(selectedRow)}</tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <div className="empty-icon">
                  <Archive size={18} />
                </div>
                <h3>
                  {tab === "archived"
                    ? "No hay ofertas archivadas"
                    : "No hay ofertas almacenadas"}
                </h3>
                <p>
                  Registra una vacante original o importa un archivo autorizado.
                </p>
                <button
                  type="button"
                  className="button button-primary button-small"
                  onClick={() => setEditor({ ...emptyEditor })}
                >
                  <Plus size={13} /> Nueva oferta
                </button>
              </div>
            )}
          </section>
          <section className="surface import-history">
            <div className="admin-section-heading">
              <div>
                <h2>Historial de importación</h2>
                <p>
                  Se guardan fecha y recuentos, no copias del archivo
                  descargado.
                </p>
              </div>
            </div>
            {imports.isLoading ? (
              <p className="hint">Cargando historial…</p>
            ) : imports.error ? (
              <p className="hint">El historial no está disponible.</p>
            ) : imports.data?.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Archivo</th>
                      <th>Formato</th>
                      <th>Filas</th>
                      <th>Importadas</th>
                      <th>Duplicadas</th>
                      <th>Errores</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.data.map(batch => (
                      <tr key={batch.id}>
                        <td>
                          {new Intl.DateTimeFormat("es-CL", {
                            dateStyle: "medium",
                            timeZone: "America/Santiago",
                          }).format(new Date(batch.createdAt))}
                        </td>
                        <td>{batch.fileName}</td>
                        <td>{batch.format.toUpperCase()}</td>
                        <td>{batch.rowCount}</td>
                        <td>{batch.importedCount}</td>
                        <td>{batch.duplicateCount}</td>
                        <td>{batch.errorCount}</td>
                        <td>
                          <button
                            className="button button-quiet button-small"
                            disabled={!batch.errorCount}
                            onClick={() => setSelectedBatch(batch.id)}
                          >
                            Ver errores
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty compact-empty">
                <p>Aún no hay lotes de importación asociados a esta cuenta.</p>
              </div>
            )}
            {selectedBatch && (
              <div className="import-error-list">
                <div className="inline-alert alert-warn">
                  <ShieldAlert size={14} />
                  Errores por fila del lote seleccionado (sin volcar datos
                  privados en consola).
                </div>
                {importErrors.isLoading ? (
                  <p className="hint">Consultando errores…</p>
                ) : importErrors.data?.length ? (
                  importErrors.data.map(row => (
                    <p className="import-error-row" key={row.id}>
                      <strong>Fila {row.rowNumber}:</strong> {row.message}
                    </p>
                  ))
                ) : (
                  <p className="hint">
                    No hay errores almacenados para este lote.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="admin-aside-column">
          <section className="surface admin-aside-card">
            <span className="eyebrow">ORIGEN Y ESTADOS</span>
            <h2>La procedencia acompaña cada oferta</h2>
            <p>
              Una oferta nueva queda <strong>por verificar</strong>. Marcarla
              vigente exige que una persona confirme su revisión; restaurar un
              archivo vuelve al estado por verificar.
            </p>
            <div className="status-key">
              <span className="status-pill status-vigente">Vigente</span>
              <span>Verificada manualmente</span>
              <span className="status-pill status-por_verificar">
                Por verificar
              </span>
              <span>Importada/actualizada sin confirmar vigencia</span>
              <span className="status-pill status-vencido">Vencida</span>
              <span>Fecha de cierre o revisión agotada</span>
              <span className="status-pill status-archivado">Archivada</span>
              <span>Retirada de Explorar, conservada en historial</span>
            </div>
          </section>
          <section className="surface admin-aside-card">
            <span className="eyebrow">FUENTES</span>
            <h2>Adaptadores desconectados</h2>
            <p>
              La aplicación no consulta portales externos ni finge
              sincronización. La carga manual permanece disponible.
            </p>
            {sources.data?.slice(0, 4).map(source => (
              <div className="admin-source-mini" key={source.id}>
                <span
                  className={`source-dot ${source.status === "available" ? "ready" : "pending"}`}
                />
                <span>{source.label}</span>
                <span className="pill pill-outline">
                  {source.status === "available" ? "Manual" : "Fase 2"}
                </span>
              </div>
            ))}
          </section>
          <section className="surface admin-aside-card">
            <span className="eyebrow">FORMATO</span>
            <h2>Campos reconocidos</h2>
            <p>
              Cargo, empresa, país, región, comuna, modalidad, descripción, URL,
              sueldo mensual, funciones, requisitos, contrato, jornada,
              experiencia, formación, habilidades, fecha y fuente. Se puede
              mapear cada columna.
            </p>
          </section>
        </aside>
      </div>
      {editor && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setEditor(null);
          }}
        >
          <form
            className="offer-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-editor-title"
            onSubmit={submitEditor}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {editor.id ? "EDICIÓN" : "ALTA MANUAL"}
                </span>
                <h2 id="offer-editor-title">
                  {editor.id ? "Editar oferta" : "Registrar oferta"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Cerrar formulario"
                onClick={() => setEditor(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-scroll">
              <div className="field-grid">
                <label className="field">
                  <span>Cargo *</span>
                  <input
                    required
                    maxLength={255}
                    value={editor.title}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, title: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Empresa</span>
                  <input
                    maxLength={255}
                    value={editor.companyName}
                    disabled={editor.confidential}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, companyName: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={editor.confidential}
                  onChange={event =>
                    setEditor(current =>
                      current
                        ? { ...current, confidential: event.target.checked }
                        : current
                    )
                  }
                />
                <span>Empresa confidencial (ocultar su nombre)</span>
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Región</span>
                  <select
                    value={editor.regionCode}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? {
                              ...current,
                              regionCode: event.target.value,
                              communeCode: "",
                            }
                          : current
                      )
                    }
                  >
                    <option value="">No informada</option>
                    {regions.map(region => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Comuna</span>
                  <select
                    value={editor.communeCode}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, communeCode: event.target.value }
                          : current
                      )
                    }
                  >
                    <option value="">No informada</option>
                    {communesForRegion(editor.regionCode).map(commune => (
                      <option
                        key={commune.communeCode}
                        value={commune.communeCode}
                      >
                        {commune.communeName}
                      </option>
                    ))}
                  </select>
                </label>
                {renderEditorField(
                  "Localidad/dirección aproximada",
                  "locality",
                  "text",
                  "Sin dirección personal"
                )}
                {renderEditorField("Área", "category")}
                {renderEditorField("Subárea", "subcategory")}
                {renderEditorField("Sector", "sector")}
                {renderEditorField("Seniority", "seniority")}
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>Modalidad</span>
                  <select
                    value={editor.modality}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? {
                              ...current,
                              modality: event.target.value as Modality,
                            }
                          : current
                      )
                    }
                  >
                    {[
                      { value: "no_informada", label: "No informada" },
                      { value: "presencial", label: "Presencial" },
                      { value: "hibrida", label: "Híbrida" },
                      { value: "remota", label: "Remota" },
                    ].map(item => (
                      <option value={item.value} key={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {renderEditorField("Jornada", "schedule")}
                {renderEditorField("Contrato", "contractType")}
                {renderEditorField(
                  "Años de experiencia",
                  "experience",
                  "number"
                )}
                {renderEditorField("Formación", "educationLevel")}
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>Sueldo mínimo mensual CLP</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editor.salaryMin}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, salaryMin: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Sueldo máximo mensual CLP</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editor.salaryMax}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, salaryMax: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Base de remuneración</span>
                  <select
                    value={editor.salaryBasis}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? {
                              ...current,
                              salaryBasis: event.target
                                .value as typeof current.salaryBasis,
                            }
                          : current
                      )
                    }
                  >
                    <option value="unknown">No especificada</option>
                    <option value="gross">Bruta</option>
                    <option value="net">Líquida</option>
                  </select>
                </label>
              </div>
              {renderTextArea(
                "Descripción",
                "description",
                "Texto original o normalizado del aviso"
              )}
              {renderTextArea("Funciones (una por línea)", "responsibilities")}
              {renderTextArea(
                "Requisitos (una línea por requisito)",
                "requirements"
              )}
              {renderTextArea(
                "Requisitos excluyentes explícitos",
                "mandatoryRequirements"
              )}
              {renderTextArea("Beneficios", "benefits")}
              {renderTextArea("Habilidades declaradas", "skills")}
              <div className="field-grid">
                {renderEditorField(
                  "Fecha de publicación",
                  "publishedAt",
                  "date"
                )}
                {renderEditorField("Fecha de cierre", "expiresAt", "date")}
              </div>
              <label className="field">
                <span>URL original real</span>
                <input
                  type="url"
                  maxLength={2048}
                  value={editor.canonicalUrl}
                  placeholder="https://…"
                  onChange={event =>
                    setEditor(current =>
                      current
                        ? { ...current, canonicalUrl: event.target.value }
                        : current
                    )
                  }
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Fuente de origen</span>
                  <select
                    value={editor.sourceCode}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, sourceCode: event.target.value }
                          : current
                      )
                    }
                  >
                    {(sources.data ?? []).map(source => (
                      <option key={source.id} value={source.id}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </label>
                {renderEditorField(
                  "ID externo (si existe)",
                  "sourceExternalId"
                )}
              </div>
              <label className="field">
                <span>Procedencia / contexto de consulta</span>
                <textarea
                  maxLength={2000}
                  value={editor.provenance}
                  onChange={event =>
                    setEditor(current =>
                      current
                        ? { ...current, provenance: event.target.value }
                        : current
                    )
                  }
                />
              </label>
              <details className="mapping-group editor-extended">
                <summary>Campos técnicos del Anexo 02</summary>
                <p className="hint">
                  Completa solo datos respaldados por la oferta o la fuente. Los
                  campos vacíos permanecen desconocidos y no se estiman.
                </p>
                <section className="mapping-primary">
                  <span className="eyebrow">Empresa, ocupación y board ATS</span>
                  <div className="field-grid">
                    {renderEditorField("Título original de la fuente", "originalTitle")}
                    {renderEditorField("Sector de la empresa", "companySector")}
                    {renderEditorField("Departamento", "department")}
                    {renderEditorField("Equipo", "team")}
                    {renderEditorField("Código ocupacional CIUO", "occupationCodeCiuo")}
                    {renderEditorField("ID externo del board ATS", "companyBoardId")}
                  </div>
                </section>
                <section className="mapping-primary">
                  <span className="eyebrow">Ubicación y condiciones observadas</span>
                  <div className="field-grid">
                    {renderEditorField("Ciudad original", "cityRaw")}
                    {renderEditorField("Ubicación original", "locationRaw")}
                    {renderEditorField("Oficina/sede", "officeLocation")}
                    {renderEditorField("Tipo de empleo", "employmentType")}
                    {renderEditorField("Tipo de jornada", "scheduleType")}
                    {renderEditorField("Turno", "shift")}
                    {renderEditorField("Horas semanales (0–168)", "hoursPerWeek", "number")}
                    {renderEditorField("Cantidad de vacantes", "vacancyCount", "number")}
                    {renderEditorField("Tipo de práctica", "practiceType")}
                    {renderEditorField("Experiencia original", "experienceRaw")}
                  </div>
                  {renderTextArea("Títulos requeridos (uno por línea)", "degreeNames")}
                  <label className="field">
                    <span>Tipo de lugar de trabajo</span>
                    <select
                      value={editor.workplaceType}
                      onChange={event =>
                        setEditor(current =>
                          current
                            ? {
                                ...current,
                                workplaceType: event.target.value as typeof current.workplaceType,
                              }
                            : current
                        )
                      }
                    >
                      <option value="unknown">No informado</option>
                      <option value="on_site">Presencial</option>
                      <option value="hybrid">Híbrido</option>
                      <option value="remote">Remoto</option>
                    </select>
                  </label>
                  {renderTextArea(
                    "Evidencia de lugar/modalidad (JSON)",
                    "workplaceEvidence",
                    '{"level":"explicit","raw":"Texto de la fuente"}'
                  )}
                </section>
                <section className="mapping-primary">
                  <span className="eyebrow">Remuneración original</span>
                  <div className="field-grid">
                    {renderEditorField("Moneda", "salaryCurrency")}
                    {renderEditorField("Período (mensual, anual, hora, etc.)", "salaryPeriod")}
                    {renderEditorField("Mínimo fuente (sin conversión)", "salaryMinSource")}
                    {renderEditorField("Máximo fuente (sin conversión)", "salaryMaxSource")}
                  </div>
                  {renderTextArea("Monto/rango tal como aparece en la fuente", "salaryRaw")}
                  <label className="field">
                    <span>Visibilidad del sueldo</span>
                    <select
                      value={editor.salaryVisibility || "unknown"}
                      onChange={event =>
                        setEditor(current =>
                          current
                            ? {
                                ...current,
                                salaryVisibility: event.target.value,
                                ...(event.target.value === "disclosed"
                                  ? {}
                                  : { salaryMin: "", salaryMax: "" }),
                              }
                            : current
                        )
                      }
                    >
                      <option value="unknown">No determinada</option>
                      <option value="disclosed">Informada</option>
                      <option value="reserved">Reservada</option>
                      <option value="not_disclosed">No publicada</option>
                    </select>
                  </label>
                  {renderTextArea(
                    "Componentes de remuneración (arreglo JSON)",
                    "salaryComponentsJson",
                    '[{"label":"Sueldo base","amount":1000000,"currency":"CLP","period":"monthly","basis":"gross"}]'
                  )}
                  {renderTextArea(
                    "Evidencia de sueldo (objeto JSON)",
                    "salaryEvidenceJson",
                    '{"level":"explicit","raw":"Texto de la fuente"}'
                  )}
                </section>
                <section className="mapping-primary">
                  <span className="eyebrow">Habilidades y postulación</span>
                  {renderTextArea("Habilidades explícitas (una por línea)", "skillsExplicit")}
                  {renderTextArea("Licencias (una por línea)", "licenses")}
                  {renderTextArea("Idiomas (una por línea)", "languages")}
                  <div className="field-grid">
                    {renderEditorField("URL de postulación", "applicationUrl")}
                    {renderEditorField("Método de postulación", "applicationMethod")}
                  </div>
                  {renderTextArea("Documentos requeridos (uno por línea)", "requiredDocuments")}
                  {renderTextArea("Etapas de selección (una por línea)", "recruitmentStages")}
                </section>
                {renderTextArea(
                  "Evidencia por campo (objeto JSON)",
                  "sourceEvidenceJson",
                  '{"officeLocation":{"level":"explicit","raw":"Santiago"}}'
                )}
              </details>
              <label className="field">
                <span>Estado de verificación</span>
                <select
                  value={editor.verificationStatus}
                  onChange={event =>
                    setEditor(current =>
                      current
                        ? {
                            ...current,
                            verificationStatus: event.target
                              .value as VerificationStatus,
                            verified:
                              event.target.value === "vigente"
                                ? current.verified
                                : false,
                          }
                        : current
                    )
                  }
                >
                  <option value="por_verificar">Por verificar</option>
                  <option value="vigente">Vigente</option>
                  <option value="vencido">Vencido</option>
                  <option value="archivado">Archivado</option>
                </select>
              </label>
              {editor.verificationStatus === "vigente" && (
                <label className="check-row verified-check">
                  <input
                    type="checkbox"
                    checked={editor.verified}
                    onChange={event =>
                      setEditor(current =>
                        current
                          ? { ...current, verified: event.target.checked }
                          : current
                      )
                    }
                  />
                  <span>
                    Confirmo que revisé la fuente y la vigencia de esta oferta.
                  </span>
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={create.isPending || update.isPending}
              >
                {create.isPending || update.isPending
                  ? "Guardando…"
                  : editor.id
                    ? "Guardar cambios"
                    : "Crear oferta"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
