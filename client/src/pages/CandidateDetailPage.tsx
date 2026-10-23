import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileText,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import FilterFacet from "@/components/FilterFacet";
import { communesForRegion, regions } from "@shared/locations";
import NotFound from "./NotFound";

const split = (value: string) =>
  value
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
const join = (value?: string[] | null) => (value ?? []).join(", ");
type CvDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionStatus: string;
  uploadedAt: Date | string;
};

export default function CandidateDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const detail = trpc.candidates.detail.useQuery({ id }, { retry: false });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communeCode, setCommuneCode] = useState("");
  const [regionsAvailable, setRegionsAvailable] = useState<string[]>([]);
  const [titles, setTitles] = useState("");
  const [compatible, setCompatible] = useState("");
  const [sectors, setSectors] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [experienceYearsKnown, setExperienceYearsKnown] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [experienceEntries, setExperienceEntries] = useState("");
  const [seniority, setSeniority] = useState("");
  const [education, setEducation] = useState("");
  const [educationKnown, setEducationKnown] = useState(false);
  const [certifications, setCertifications] = useState("");
  const [licenses, setLicenses] = useState("");
  const [credentialsKnown, setCredentialsKnown] = useState(false);
  const [hardSkills, setHardSkills] = useState("");
  const [softSkills, setSoftSkills] = useState("");
  const [languages, setLanguages] = useState("");
  const [modalities, setModalities] = useState<string[]>(["presencial"]);
  const [schedules, setSchedules] = useState("");
  const [contracts, setContracts] = useState("");
  const [salaryTargetCLP, setSalaryTargetCLP] = useState("");
  const [salaryBasis, setSalaryBasis] = useState<"gross" | "net" | "unknown">(
    "unknown"
  );
  const [notes, setNotes] = useState("");
  const [extractedDrafts, setExtractedDrafts] = useState<
    Record<string, string>
  >({});
  const [fileBusy, setFileBusy] = useState(false);
  const candidate = detail.data;
  useEffect(() => {
    if (!candidate) return;
    setName(candidate.displayName);
    setRegionCode(candidate.regionCode ?? "");
    setCommuneCode(candidate.communeCode ?? "");
    setRegionsAvailable(candidate.regionsAvailable ?? []);
    setTitles(join(candidate.preferredTitles));
    setCompatible(join(candidate.compatibleTitles));
    setSectors(join(candidate.sectors));
    setYearsExperience(String(candidate.yearsExperience ?? 0));
    setExperienceYearsKnown(candidate.experienceYearsKnown ?? false);
    setSeniority(candidate.seniority ?? "");
    setWillingToRelocate(candidate.willingToRelocate);
    setExperienceEntries(
      (candidate.experience ?? [])
        .map(item =>
          [item.role, item.companyName ?? "", item.achievements ?? ""].join(
            " | "
          )
        )
        .join("\n")
    );
    setEducation(join(candidate.education));
    setEducationKnown(candidate.educationKnown ?? false);
    setCertifications(join(candidate.certifications));
    setLicenses(join(candidate.licenses));
    setCredentialsKnown(candidate.credentialsKnown ?? false);
    setHardSkills(join(candidate.hardSkills));
    setSoftSkills(join(candidate.softSkills));
    setLanguages(join(candidate.languages));
    setModalities(candidate.acceptedModalities ?? ["presencial"]);
    setSchedules(join(candidate.acceptedSchedules));
    setContracts(join(candidate.preferredContracts));
    setSalaryTargetCLP(
      candidate.salaryTargetCLP ? String(candidate.salaryTargetCLP) : ""
    );
    setSalaryBasis(candidate.salaryBasisPreference ?? "unknown");
    setNotes(candidate.privateNotes ?? "");
    setExtractedDrafts(
      Object.fromEntries(
        (candidate.cvDocuments ?? []).map(document => [
          document.id,
          document.extractedText ?? "",
        ])
      )
    );
  }, [candidate]);
  const update = trpc.candidates.update.useMutation({
    onSuccess: async () => {
      toast.success("Perfil actualizado");
      await utils.candidates.detail.invalidate({ id });
      await utils.candidates.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const upload = trpc.candidates.uploadCv.useMutation({
    onSuccess: async result => {
      toast.success(result.message);
      await utils.candidates.detail.invalidate({ id });
      await utils.candidates.list.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: () => setFileBusy(false),
  });
  const correct = trpc.candidates.correctCvText.useMutation({
    onSuccess: () => {
      toast.success("Texto de CV corregido");
      utils.candidates.detail.invalidate({ id });
    },
    onError: error => toast.error(error.message),
  });
  const deleteCv = trpc.candidates.deleteCv.useMutation({
    onSuccess: () => {
      toast.success("Versión eliminada");
      utils.candidates.detail.invalidate({ id });
      utils.candidates.list.invalidate();
    },
  });
  const deleteProfile = trpc.candidates.delete.useMutation({
    onSuccess: () => {
      toast.success("Perfil y CV eliminados");
      setLocation("/personas");
    },
  });

  if (detail.isLoading)
    return (
      <div className="page-wrap">
        <div className="surface empty-state">
          <span className="loading-spinner" />
          <p>Cargando perfil…</p>
        </div>
      </div>
    );
  if (!detail.error && !candidate) return <NotFound />;
  if (detail.error)
    return (
      <div className="page-wrap">
        <div className="surface empty-state">
          <h2>No se pudo abrir el perfil</h2>
          <p>Inténtalo de nuevo sin perder los cambios guardados.</p>
          <button
            className="button button-secondary"
            onClick={() => detail.refetch()}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    );

  const region = regions.find(item => item.code === regionCode);
  const communes = communesForRegion(regionCode);
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (modalities.length === 0) {
      toast.error("Selecciona al menos una modalidad aceptada.");
      return;
    }
    const experienceRows = experienceEntries
      .split(/\n/)
      .map(line => line.split("|").map(part => part.trim()))
      .filter(parts => parts[0])
      .map(([role, companyName, achievements]) => ({
        role,
        companyName,
        achievements,
      }));
    update.mutate({
      id,
      patch: {
        displayName: name,
        regionCode: region?.code ?? null,
        regionName: region?.name ?? null,
        communeCode: communeCode || null,
        communeName:
          communes.find(item => item.communeCode === communeCode)
            ?.communeName ?? null,
        yearsExperience: Math.max(0, Number(yearsExperience || 0)),
        experienceYearsKnown,
        regionsAvailable,
        willingToRelocate,
        experience: experienceRows,
        preferredTitles: split(titles),
        compatibleTitles: split(compatible),
        sectors: split(sectors),
        seniority: seniority || null,
        education: split(education),
        educationKnown,
        certifications: split(certifications),
        licenses: split(licenses),
        credentialsKnown,
        hardSkills: split(hardSkills),
        softSkills: split(softSkills),
        languages: split(languages),
        acceptedModalities: modalities as never,
        acceptedSchedules: split(schedules),
        preferredContracts: split(contracts),
        salaryTargetCLP: salaryTargetCLP ? Number(salaryTargetCLP) : null,
        salaryBasisPreference: salaryBasis,
        privateNotes: notes,
      },
    });
  };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("El CV supera el límite de 8 MB.");
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "docx"].includes(ext ?? "")) {
      toast.error("Elige un archivo PDF o DOCX.");
      return;
    }
    setFileBusy(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setFileBusy(false);
      toast.error("No se pudo leer el archivo local.");
    };
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        setFileBusy(false);
        toast.error("El archivo no pudo convertirse para procesarlo.");
        return;
      }
      upload.mutate({ id, fileName: file.name, mimeType: file.type, base64 });
    };
    reader.readAsDataURL(file);
  };
  const toggle = (value: string) =>
    setModalities(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  const deletePerson = () => {
    if (
      window.confirm(
        "Esto eliminará permanentemente el perfil, datos de experiencia, notas, extracciones de CV y coincidencias asociadas. ¿Continuar?"
      )
    )
      deleteProfile.mutate({ id });
  };

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/personas">
            <ArrowLeft size={13} /> Volver a personas
          </Link>
          <span className="eyebrow">PERFIL PRIVADO</span>
          <h1>{candidate!.displayName}</h1>
          <p>
            {[candidate!.communeName, candidate!.regionName]
              .filter(Boolean)
              .join(", ") || "Ubicación no informada"}{" "}
            · {candidate!.experienceYearsKnown
              ? `${candidate!.yearsExperience} años declarados`
              : "Experiencia no informada"}
          </p>
        </div>
        <div className="heading-actions">
          <Link
            className="button button-secondary"
            href={`/personas/${id}/coincidencias`}
          >
            <BriefcaseBusiness size={14} /> Ver coincidencias{" "}
            <ArrowRight size={12} />
          </Link>
          <button
            className="button button-danger"
            type="button"
            disabled={deleteProfile.isPending}
            onClick={deletePerson}
          >
            <Trash2 size={14} /> Borrar perfil
          </button>
        </div>
      </div>
      <div className="candidate-security-banner">
        <ShieldCheck size={15} />
        <span>
          Consentimiento vigente registrado el{" "}
          {candidate!.consentAt
            ? new Intl.DateTimeFormat("es-CL", {
                dateStyle: "medium",
                timeZone: "America/Santiago",
              }).format(new Date(candidate!.consentAt))
            : "fecha no disponible"}
          . Perfil visible únicamente para esta cuenta.
        </span>
        <span className="pill pill-teal">Solo lectura privada</span>
      </div>
      <div className="candidate-detail-layout">
        <form className="form-panel" onSubmit={saveProfile}>
          <div className="form-panel-header">
            <div>
              <h2>Preferencias y antecedentes</h2>
              <p>
                Corrige cualquier extracción del CV antes de usarla en la
                comparación.
              </p>
            </div>
            <span className="pill">
              {candidate!.cvDocuments?.length ?? 0} versiones CV
            </span>
          </div>
          <div className="field-grid" style={{ marginTop: 17 }}>
            <div className="field">
              <label htmlFor="editName">Alias</label>
              <input
                id="editName"
                required
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="editExperience">Años de experiencia</label>
              <input
                id="editExperience"
                type="number"
                min="0"
                max="60"
                value={yearsExperience}
                onChange={event => setYearsExperience(event.target.value)}
              />
            </div>
          </div>
          <label className="check-row" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={experienceYearsKnown}
              onChange={event => setExperienceYearsKnown(event.target.checked)}
            />
            <span>
              Años confirmados por la persona (marca también si confirmó 0).
              Si queda desmarcado, se tratará como dato no informado.
            </span>
          </label>
          <section className="form-section">
            <h3>Ubicación y movilidad</h3>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="editRegion">Región principal</label>
                <select
                  id="editRegion"
                  value={regionCode}
                  onChange={event => {
                    setRegionCode(event.target.value);
                    setCommuneCode("");
                  }}
                >
                  <option value="">No informada</option>
                  {regions.map(item => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="editCommune">Comuna principal</label>
                <select
                  id="editCommune"
                  value={communeCode}
                  onChange={event => setCommuneCode(event.target.value)}
                >
                  <option value="">No informada</option>
                  {communes.map(item => (
                    <option key={item.communeCode} value={item.communeCode}>
                      {item.communeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <FilterFacet
                label="Regiones disponibles"
                options={regions.map(item => ({
                  value: item.name,
                  label: item.name,
                }))}
                values={regionsAvailable}
                onChange={setRegionsAvailable}
                placeholder="Seleccionar regiones"
              />
            </div>
            <label className="check-row" style={{ marginTop: 11 }}>
              <input
                type="checkbox"
                checked={willingToRelocate}
                onChange={event => setWillingToRelocate(event.target.checked)}
              />
              <span>Considera traslado a otra región.</span>
            </label>
          </section>
          <section className="form-section">
            <h3>Cargos y áreas</h3>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="editTitles">Cargos preferidos</label>
                <textarea
                  id="editTitles"
                  value={titles}
                  onChange={event => setTitles(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editCompatible">Cargos compatibles</label>
                <textarea
                  id="editCompatible"
                  value={compatible}
                  onChange={event => setCompatible(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editSectors">Sectores</label>
                <textarea
                  id="editSectors"
                  value={sectors}
                  onChange={event => setSectors(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editSeniority">Seniority</label>
                <input
                  id="editSeniority"
                  value={seniority}
                  onChange={event => setSeniority(event.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="form-section">
            <h3>Experiencia, formación y capacidades</h3>
            <div className="field">
              <label htmlFor="editWorkHistory">Experiencia y logros</label>
              <textarea
                id="editWorkHistory"
                value={experienceEntries}
                onChange={event => setExperienceEntries(event.target.value)}
                placeholder="Un puesto por línea: Cargo | Empresa (opcional) | Logro o función"
              />
              <span className="hint">No infiere experiencia no declarada.</span>
            </div>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="editEducation">Formación</label>
                <textarea
                  id="editEducation"
                  value={education}
                  onChange={event => setEducation(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editCertifications">Certificaciones</label>
                <textarea
                  id="editCertifications"
                  value={certifications}
                  onChange={event => setCertifications(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editLicenses">Licencias</label>
                <textarea
                  id="editLicenses"
                  value={licenses}
                  onChange={event => setLicenses(event.target.value)}
                />
              </div>
              <label className="check-row" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={educationKnown}
                  onChange={event => setEducationKnown(event.target.checked)}
                />
                <span>
                  La lista de formación fue revisada con la persona; si está
                  marcada y falta un título requerido, el motor puede indicar
                  que no es elegible. Si queda desmarcada, lo tratará como dato
                  insuficiente.
                </span>
              </label>
              <label className="check-row" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={credentialsKnown}
                  onChange={event =>
                    setCredentialsKnown(event.target.checked)
                  }
                />
                <span>
                  La lista de licencias y certificaciones fue revisada con la
                  persona; si está marcada y no incluye una exigencia
                  excluyente, el motor podrá señalarla como no elegible.
                </span>
              </label>
              <div className="field">
                <label htmlFor="editHard">Competencias técnicas</label>
                <textarea
                  id="editHard"
                  value={hardSkills}
                  onChange={event => setHardSkills(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editSoft">Competencias transversales</label>
                <textarea
                  id="editSoft"
                  value={softSkills}
                  onChange={event => setSoftSkills(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editLanguages">Idiomas</label>
                <textarea
                  id="editLanguages"
                  value={languages}
                  onChange={event => setLanguages(event.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="form-section">
            <h3>Condiciones de búsqueda</h3>
            <div className="field">
              <label>Modalidades aceptadas</label>
              <div className="filter-option-list">
                {[
                  { value: "presencial", label: "Presencial" },
                  { value: "hibrida", label: "Híbrida" },
                  { value: "remota", label: "Remota" },
                  { value: "no_informada", label: "No especificada" },
                ].map(item => (
                  <label className="filter-option" key={item.value}>
                    <input
                      type="checkbox"
                      checked={modalities.includes(item.value)}
                      onChange={() => toggle(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="editSchedules">Jornadas aceptadas</label>
                <input
                  id="editSchedules"
                  value={schedules}
                  onChange={event => setSchedules(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editContracts">Contratos preferidos</label>
                <input
                  id="editContracts"
                  value={contracts}
                  onChange={event => setContracts(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editSalary">
                  Remuneración objetivo mensual CLP
                </label>
                <input
                  id="editSalary"
                  type="number"
                  min="0"
                  value={salaryTargetCLP}
                  onChange={event => setSalaryTargetCLP(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="editSalaryBasis">Base</label>
                <select
                  id="editSalaryBasis"
                  value={salaryBasis}
                  onChange={event =>
                    setSalaryBasis(event.target.value as typeof salaryBasis)
                  }
                >
                  <option value="unknown">No especificada</option>
                  <option value="gross">Bruta</option>
                  <option value="net">Líquida</option>
                </select>
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="field">
              <label htmlFor="privateNotes">Notas privadas</label>
              <textarea
                id="privateNotes"
                maxLength={10000}
                value={notes}
                onChange={event => setNotes(event.target.value)}
              />
            </div>
          </section>
          <div className="form-actions">
            <span className="hint">
              El consentimiento original no se altera al editar el perfil.
            </span>
            <button
              className="button button-primary"
              type="submit"
              disabled={update.isPending}
            >
              <Save size={14} />
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
        <aside className="cv-column">
          <section className="surface cv-upload-card">
            <div className="cv-card-heading">
              <div>
                <h2>Versiones de CV</h2>
                <p>
                  PDF o DOCX · hasta 8 MB · extracción sin servicios externos
                </p>
              </div>
              <FileText size={19} />
            </div>
            <label
              className={`file-drop compact-drop ${fileBusy ? "file-busy" : ""}`}
            >
              <UploadCloud size={19} />
              <strong>
                {fileBusy
                  ? "Procesando en el servidor…"
                  : "Agregar versión de CV"}
              </strong>
              <span>
                Se valida el tipo de archivo y se extrae texto localmente.
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                disabled={fileBusy}
                onChange={chooseFile}
              />
            </label>
            <div className="cv-privacy-explainer">
              Por minimización de datos, el archivo binario original se descarta
              tras extraerlo. Se conservan el nombre, formato, fecha y el texto
              estructurado necesario para revisión. Puedes borrar cada versión.
            </div>
          </section>
          {candidate!.cvDocuments?.length ? (
            <div className="cv-version-list">
              {candidate!.cvDocuments.map(document => (
                <CvVersionCard
                  key={document.id}
                  document={document}
                  draft={
                    extractedDrafts[document.id] ?? document.extractedText ?? ""
                  }
                  onChange={value =>
                    setExtractedDrafts(current => ({
                      ...current,
                      [document.id]: value,
                    }))
                  }
                  onSave={() =>
                    correct.mutate({
                      id,
                      documentId: document.id,
                      extractedText: extractedDrafts[document.id] ?? "",
                    })
                  }
                  onDelete={() => {
                    if (
                      window.confirm(
                        `¿Borrar la versión ${document.fileName} y su texto extraído?`
                      )
                    )
                      deleteCv.mutate({ id, documentId: document.id });
                  }}
                  saving={correct.isPending}
                  deleting={deleteCv.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="surface empty-state cv-empty">
              <div className="empty-icon">
                <FileText size={18} />
              </div>
              <h2>Sin CV cargados</h2>
              <p>También puedes completar el perfil manualmente.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function CvVersionCard({
  document,
  draft,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  document: CvDocument;
  draft: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const status =
    document.extractionStatus === "text_extracted"
      ? "Texto extraído · revisar"
      : document.extractionStatus === "manual_review"
        ? "Sin texto legible · revisión manual"
        : "Extracción con error";
  return (
    <article className="surface cv-version-card">
      <div className="cv-version-head">
        <div className="cv-version-icon">
          <FileText size={15} />
        </div>
        <div className="cv-version-title">
          <strong>{document.fileName}</strong>
          <span>
            Versión ·{" "}
            {new Intl.DateTimeFormat("es-CL", {
              dateStyle: "medium",
              timeZone: "America/Santiago",
            }).format(new Date(document.uploadedAt))}{" "}
            · {(document.sizeBytes / 1024).toFixed(0)} KB
          </span>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Eliminar esta versión"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div
        className={`cv-status ${document.extractionStatus === "text_extracted" ? "success" : "warning"}`}
      >
        {document.extractionStatus === "text_extracted" ? (
          <Check size={13} />
        ) : (
          <RefreshCw size={13} />
        )}
        {status}
      </div>
      <p className="cv-review-hint">
        {document.extractionStatus === "manual_review"
          ? "Este archivo no contiene texto legible. No se aplicó OCR; corrige o completa los datos manualmente."
          : "Revisa y corrige la extracción antes de usarla en recomendaciones."}
      </p>
      <label className="field">
        <span className="field-label">Texto privado extraído o revisado</span>
        <textarea
          className="cv-text"
          value={draft}
          onChange={event => onChange(event.target.value)}
          maxLength={120000}
          placeholder="Si el CV es escaneado, ingresa aquí manualmente solo los antecedentes necesarios."
        />
      </label>
      <div className="cv-card-actions">
        <span className="hint">
          {draft.length.toLocaleString("es-CL")} caracteres · máximo 120.000
        </span>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Guardando…" : "Guardar corrección"}
        </button>
      </div>
    </article>
  );
}
