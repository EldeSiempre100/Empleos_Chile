import { FormEvent, useState } from "react";
import {
  ArrowRight,
  FilePlus2,
  MapPin,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { regions, communesForRegion } from "@shared/locations";
import { trpc } from "@/lib/trpc";
import FilterFacet from "@/components/FilterFacet";

function parseList(value: string) {
  return value
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

type Mode = "list" | "create";
export default function PeoplePage({ mode }: { mode: Mode }) {
  return mode === "create" ? <CreateCandidate /> : <CandidateList />;
}

function CandidateList() {
  const list = trpc.candidates.list.useQuery(undefined, { retry: false });
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PERFILES AUTORIZADOS</span>
          <h1>Personas</h1>
          <p>
            Perfiles de búsqueda asociados a esta cuenta y con consentimiento
            registrado.
          </p>
        </div>
        <Link className="button button-primary" href="/personas/nuevo">
          <Plus size={15} /> Agregar persona
        </Link>
      </div>
      {list.isLoading ? (
        <div className="surface empty-state">
          <span className="loading-spinner" />
          <p>Cargando perfiles…</p>
        </div>
      ) : list.error ? (
        <div className="surface empty-state">
          <h2>No se pudieron cargar los perfiles</h2>
          <p>La información se mantiene restringida a esta cuenta.</p>
          <button
            className="button button-secondary"
            onClick={() => list.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : list.data?.length ? (
        <div className="data-grid">
          {list.data.map(person => (
            <Link
              href={`/personas/${person.id}`}
              key={person.id}
              className="person-card"
            >
              <div className="person-card-head">
                <div className="person-avatar">
                  {person.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2>{person.displayName}</h2>
                  <p>
                    {[person.communeName, person.regionName]
                      .filter(Boolean)
                      .join(", ") || "Ubicación no indicada"}
                  </p>
                </div>
              </div>
              <div className="person-card-topics">
                {(person.preferredTitles ?? [])
                  .slice(0, 2)
                  .map((title: string) => (
                    <span className="pill" key={title}>
                      {title}
                    </span>
                  ))}
                {(person.preferredTitles?.length ?? 0) > 2 && (
                  <span className="pill">
                    +{person.preferredTitles.length - 2}
                  </span>
                )}
              </div>
              <div className="person-card-foot">
                <span className="pill pill-teal">
                  <FilePlus2 size={11} />
                  {person.cvCount} CV
                </span>
                <span className="pill pill-outline">
                  {person.experienceYearsKnown
                    ? `${person.yearsExperience} años declarados`
                    : "Experiencia no informada"}
                </span>
                <span style={{ marginLeft: "auto", color: "#278077" }}>
                  <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface empty-state">
          <div className="empty-icon">
            <UsersRound size={20} />
          </div>
          <h2>No hay perfiles asociados a esta cuenta</h2>
          <p>
            Agrega personas solo cuando hayan autorizado expresamente el
            almacenamiento y uso de sus datos para esta búsqueda.
          </p>
          <Link className="button button-primary" href="/personas/nuevo">
            <Plus size={15} /> Agregar persona
          </Link>
        </div>
      )}
    </div>
  );
}

function CreateCandidate() {
  const [, setLocation] = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communeCode, setCommuneCode] = useState("");
  const [regionAvailability, setRegionAvailability] = useState<string[]>([]);
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [titles, setTitles] = useState("");
  const [compatible, setCompatible] = useState("");
  const [sectors, setSectors] = useState("");
  const [experience, setExperience] = useState("");
  const [experienceYearsKnown, setExperienceYearsKnown] = useState(false);
  const [experienceEntries, setExperienceEntries] = useState("");
  const [seniority, setSeniority] = useState("");
  const [education, setEducation] = useState("");
  const [certifications, setCertifications] = useState("");
  const [licenses, setLicenses] = useState("");
  const [hardSkills, setHardSkills] = useState("");
  const [softSkills, setSoftSkills] = useState("");
  const [languages, setLanguages] = useState("");
  const [modalities, setModalities] = useState<string[]>(["presencial"]);
  const [schedules, setSchedules] = useState("");
  const [contracts, setContracts] = useState("");
  const [salaryTargetCLP, setSalaryTargetCLP] = useState("");
  const [salaryBasisPreference, setSalaryBasisPreference] = useState<
    "gross" | "net" | "unknown"
  >("unknown");
  const [privateNotes, setPrivateNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const communes = communesForRegion(regionCode);
  const create = trpc.candidates.create.useMutation({
    onSuccess: result => {
      toast.success("Perfil guardado con consentimiento registrado");
      setLocation(`/personas/${result.id}`);
    },
    onError: error => toast.error(error.message),
  });
  const toggleModality = (value: string) =>
    setModalities(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!consent) {
      toast.error(
        "Confirma el consentimiento explícito antes de guardar el perfil."
      );
      return;
    }
    if (!modalities.length) {
      toast.error("Selecciona al menos una modalidad aceptada.");
      return;
    }
    const region = regions.find(item => item.code === regionCode);
    const commune = communes.find(item => item.communeCode === communeCode);
    const experienceRows = experienceEntries
      .split(/\n/)
      .map(line => line.split("|").map(part => part.trim()))
      .filter(parts => parts[0])
      .map(([role, companyName, achievements]) => ({
        role,
        companyName,
        achievements,
      }));
    create.mutate({
      displayName,
      regionCode: region?.code,
      regionName: region?.name,
      communeCode: commune?.communeCode,
      communeName: commune?.communeName,
      regionsAvailable: regionAvailability,
      willingToRelocate,
      preferredTitles: parseList(titles),
      compatibleTitles: parseList(compatible),
      sectors: parseList(sectors),
      yearsExperience: Math.max(0, Number(experience || 0)),
      experienceYearsKnown,
      seniority: seniority || undefined,
      experience: experienceRows,
      education: parseList(education),
      certifications: parseList(certifications),
      licenses: parseList(licenses),
      hardSkills: parseList(hardSkills),
      softSkills: parseList(softSkills),
      languages: parseList(languages),
      acceptedModalities: modalities as never,
      acceptedSchedules: parseList(schedules),
      preferredContracts: parseList(contracts),
      salaryTargetCLP: salaryTargetCLP ? Number(salaryTargetCLP) : null,
      salaryBasisPreference,
      privateNotes,
      consentGiven: true,
      consentAt: new Date().toISOString(),
    });
  };
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <Link href="/personas" className="back-link">
            ‹ Volver a personas
          </Link>
          <span className="eyebrow">NUEVO PERFIL · DATOS PRIVADOS</span>
          <h1>Agregar persona</h1>
          <p>
            Guarda solo los datos útiles para explorar vacantes y comparar
            requisitos.
          </p>
        </div>
      </div>
      <form className="form-panel" onSubmit={submit}>
        <div className="form-panel-header">
          <div>
            <h2>Preferencias y antecedentes laborales</h2>
            <p>
              El alias evita registrar nombre completo si no es necesario. Los
              campos se pueden corregir después.
            </p>
          </div>
          <span className="pill pill-teal">
            <ShieldCheck size={12} /> Solo en esta cuenta
          </span>
        </div>
        <div className="field-grid" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="displayName">Alias o nombre visible *</label>
            <input
              id="displayName"
              required
              maxLength={180}
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              placeholder="Ej.: Perfil técnico norte"
            />
          </div>
          <div className="field">
            <label htmlFor="yearsExperience">Años de experiencia</label>
            <input
              id="yearsExperience"
              type="number"
              min="0"
              max="60"
              value={experience}
              onChange={event => setExperience(event.target.value)}
              placeholder="0"
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
            Años declarados por la persona (marca también si confirmó 0 años).
            Si queda desmarcado, el motor lo tratará como dato no informado.
          </span>
        </label>
        <section className="form-section">
          <h3>
            <MapPin size={14} /> Ubicación y movilidad
          </h3>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="profile-region">Región principal</label>
              <select
                id="profile-region"
                value={regionCode}
                onChange={event => {
                  setRegionCode(event.target.value);
                  setCommuneCode("");
                }}
              >
                <option value="">No informada</option>
                {regions.map(item => (
                  <option value={item.code} key={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="profile-commune">Comuna principal</label>
              <select
                id="profile-commune"
                value={communeCode}
                onChange={event => setCommuneCode(event.target.value)}
              >
                <option value="">No informada</option>
                {communes.map(item => (
                  <option value={item.communeCode} key={item.communeCode}>
                    {item.communeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Regiones donde puede trabajar</label>
            <FilterFacet
              label="Regiones"
              options={regions.map(item => ({
                value: item.name,
                label: item.name,
              }))}
              values={regionAvailability}
              onChange={setRegionAvailability}
              placeholder="Seleccionar regiones disponibles"
            />
          </div>
          <label className="check-row" style={{ marginTop: 11 }}>
            <input
              type="checkbox"
              checked={willingToRelocate}
              onChange={event => setWillingToRelocate(event.target.checked)}
            />
            <span>
              Considera traslado a otra región (solo si la persona lo indicó).
            </span>
          </label>
        </section>
        <section className="form-section">
          <h3>Cargos y sectores preferidos</h3>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="titles">Cargos preferidos</label>
              <textarea
                id="titles"
                value={titles}
                onChange={event => setTitles(event.target.value)}
                placeholder="Un cargo por línea; también puedes usar comas"
              />
            </div>
            <div className="field">
              <label htmlFor="compatible-titles">Cargos compatibles</label>
              <textarea
                id="compatible-titles"
                value={compatible}
                onChange={event => setCompatible(event.target.value)}
                placeholder="No se infieren automáticamente"
              />
            </div>
            <div className="field">
              <label htmlFor="sectors">Sectores de interés</label>
              <textarea
                id="sectors"
                value={sectors}
                onChange={event => setSectors(event.target.value)}
                placeholder="Por ejemplo, solo si lo ha indicado"
              />
            </div>
            <div className="field">
              <label htmlFor="seniority">Seniority</label>
              <select
                id="seniority"
                value={seniority}
                onChange={event => setSeniority(event.target.value)}
              >
                <option value="">No informada</option>
                {[
                  "Operativo",
                  "Técnico",
                  "Administrativo",
                  "Profesional",
                  "Analista",
                  "Coordinación",
                  "Supervisión",
                  "Jefatura",
                  "Subgerencia",
                  "Gerencia",
                ].map(item => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
        <section className="form-section">
          <h3>Experiencia, formación y capacidades</h3>
          <div className="field">
            <label htmlFor="history">Experiencia y logros</label>
            <textarea
              id="history"
              value={experienceEntries}
              onChange={event => setExperienceEntries(event.target.value)}
              placeholder="Un puesto por línea: Cargo | Empresa (opcional) | Logro o función"
            />
            <span className="hint">
              Se guardan solo antecedentes declarados o revisados.
            </span>
          </div>
          <div className="field-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="education">Estudios y formación</label>
              <textarea
                id="education"
                value={education}
                onChange={event => setEducation(event.target.value)}
                placeholder="Títulos o formación declarada"
              />
            </div>
            <div className="field">
              <label htmlFor="certifications">Certificaciones</label>
              <textarea
                id="certifications"
                value={certifications}
                onChange={event => setCertifications(event.target.value)}
                placeholder="Certificaciones vigentes o declaradas"
              />
            </div>
            <div className="field">
              <label htmlFor="licenses">Licencias o credenciales</label>
              <textarea
                id="licenses"
                value={licenses}
                onChange={event => setLicenses(event.target.value)}
                placeholder="No agregues credenciales inferidas"
              />
            </div>
            <div className="field">
              <label htmlFor="hard-skills">Competencias técnicas</label>
              <textarea
                id="hard-skills"
                value={hardSkills}
                onChange={event => setHardSkills(event.target.value)}
                placeholder="Herramientas, técnicas, tecnologías"
              />
            </div>
            <div className="field">
              <label htmlFor="soft-skills">Competencias transversales</label>
              <textarea
                id="soft-skills"
                value={softSkills}
                onChange={event => setSoftSkills(event.target.value)}
                placeholder="Habilidades que la persona declara"
              />
            </div>
            <div className="field">
              <label htmlFor="languages">Idiomas</label>
              <textarea
                id="languages"
                value={languages}
                onChange={event => setLanguages(event.target.value)}
                placeholder="Idioma y nivel si se conoce"
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
                    onChange={() => toggleModality(item.value)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <span className="hint">
              La modalidad desconocida no se asumirá como presencial en
              resultados.
            </span>
          </div>
          <div className="field-grid" style={{ marginTop: 13 }}>
            <div className="field">
              <label htmlFor="schedules">Jornadas aceptadas</label>
              <input
                id="schedules"
                value={schedules}
                onChange={event => setSchedules(event.target.value)}
                placeholder="Completa, turnos…"
              />
            </div>
            <div className="field">
              <label htmlFor="contracts">Contratos preferidos</label>
              <input
                id="contracts"
                value={contracts}
                onChange={event => setContracts(event.target.value)}
                placeholder="Indefinido, plazo fijo…"
              />
            </div>
            <div className="field">
              <label htmlFor="salary">
                Remuneración objetivo mensual · CLP
              </label>
              <input
                id="salary"
                type="number"
                min="0"
                step="50000"
                value={salaryTargetCLP}
                onChange={event => setSalaryTargetCLP(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="field">
              <label htmlFor="salaryBasis">Base de remuneración objetivo</label>
              <select
                id="salaryBasis"
                value={salaryBasisPreference}
                onChange={event =>
                  setSalaryBasisPreference(
                    event.target.value as typeof salaryBasisPreference
                  )
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
          <h3>Notas privadas</h3>
          <div className="field">
            <label htmlFor="notes">
              Notas de contexto (máx. 10.000 caracteres)
            </label>
            <textarea
              id="notes"
              maxLength={10000}
              value={privateNotes}
              onChange={event => setPrivateNotes(event.target.value)}
              placeholder="Solo información necesaria para orientar la búsqueda"
            />
            <span className="hint">
              Las notas no se comparten con las fuentes ni con empleadores.
            </span>
          </div>
        </section>
        <section className="form-section consent-box">
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={event => setConsent(event.target.checked)}
              required
            />
            <span>
              <strong>Consentimiento explícito *</strong>
              <br />
              Confirmo que la persona autorizó guardar estos antecedentes y
              utilizarlos para buscar oportunidades laborales. El sistema
              registra la fecha de este consentimiento.
            </span>
          </label>
          <p className="privacy-hint">
            No cargues datos personales de terceros sin autorización. El acceso
            al perfil se limita a esta cuenta; puedes borrar el perfil y sus
            versiones de CV desde su ficha.
          </p>
        </section>
        <div className="form-actions">
          <Link href="/personas" className="button button-quiet">
            Cancelar
          </Link>
          <button
            type="submit"
            className="button button-primary"
            disabled={create.isPending || !consent}
          >
            <ShieldCheck size={15} />
            {create.isPending ? "Guardando…" : "Guardar perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
