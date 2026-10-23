export type ImportRow = Record<string, unknown>;

export function parseCsv(text: string): ImportRow[] {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === "," || char === "\t") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some(value => value !== "")) records.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(value => value !== "")) records.push(row);
  if (!records.length) return [];
  const headers = records[0].map(
    (header, index) => header || `columna_${index + 1}`
  );
  return records
    .slice(1)
    .map(values =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""])
      )
    );
}

import { parseCLPAmount } from "@shared/normalization";

export function parseImportFile(fileName: string, text: string): ImportRow[] {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "json") {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.jobs)
        ? parsed.jobs
        : null;
    if (
      !rows ||
      !rows.every(
        (row: unknown) => row && typeof row === "object" && !Array.isArray(row)
      )
    )
      throw new Error(
        "El JSON debe ser una lista de ofertas u objeto con una propiedad jobs que contenga una lista."
      );
    return rows as ImportRow[];
  }
  if (extension === "csv" || extension === "tsv" || extension === "txt")
    return parseCsv(text);
  throw new Error("Formato no compatible. Elige un archivo CSV o JSON.");
}

const headerAliases: Record<string, string[]> = {
  title: ["cargo", "titulo", "title", "puesto", "position", "nombre oferta"],
  originalTitle: ["titulo original", "originaltitle", "title original"],
  companyName: ["empresa", "company", "companyname", "nombre empresa", "organizacion"],
  companySector: ["sector empresa", "companysector", "actividad economica"],
  countryCode: ["pais", "country", "countrycode"],
  regionCode: ["codigo region", "regioncode"],
  regionName: ["region", "regionname", "región"],
  communeCode: ["codigo comuna", "communeCode", "comunecode"],
  communeName: ["comuna", "comunename", "municipio", "comuna de trabajo"],
  cityRaw: ["ciudad original", "ciudad", "cityraw", "city"],
  locationRaw: ["ubicacion original", "locationraw", "ubicacion fuente"],
  officeLocation: ["oficina", "office", "officelocation", "sede"],
  locality: ["localidad", "locality"],
  addressApprox: ["direccion aproximada", "addressapprox"],
  geoConfidence: ["confianza geografica", "geoconfidence"],
  geoEvidence: ["evidencia geografica", "geoevidence"],
  modality: ["modalidad", "modality", "tipo modalidad"],
  workplaceType: ["workplacetype", "tipo lugar de trabajo", "tipo de lugar"],
  workplaceEvidence: ["evidencia modalidad", "workplaceevidence"],
  category: ["area", "area empleo", "categoria", "category", "ocupacion"],
  subcategory: ["subarea", "subcategoría", "subcategory"],
  sector: ["sector", "sectoreconomico", "industria"],
  inferredSector: ["sector inferido", "inferredsector"],
  department: ["departamento", "department", "area organizacional"],
  team: ["equipo", "team"],
  occupationCodeCiuo: ["ciuo", "ciuo08", "occupationcodeciuo", "codigo ocupacion"],
  seniority: ["seniority", "nivel", "seniority/cargo"],
  inferredSeniority: ["seniority inferido", "inferredseniority"],
  jobType: ["jobtype", "tipo puesto"],
  employmentType: ["employmenttype", "tipo empleo", "tipo de empleo"],
  contractType: ["contrato", "tipocontrato", "contracttype", "nombramiento"],
  schedule: ["jornada", "horario", "schedule"],
  scheduleType: ["tipo jornada", "scheduleType"],
  shift: ["turno", "shift"],
  hoursPerWeek: ["horas semanales", "hoursperweek", "horas por semana"],
  vacancyCount: ["cantidad vacantes", "vacantes", "vacancycount", "numero de puestos"],
  practiceType: ["practica", "practica profesional", "practicetype"],
  experienceMinYears: ["experiencia", "experienciaminima", "anos experiencia", "years experience"],
  experienceRaw: ["experiencia original", "experienciatexto", "experienceraw"],
  educationLevel: ["formacion", "formación", "educacion", "nivel educativo", "educationlevel"],
  degreeNames: ["titulos", "titulo requerido", "grados", "degreenames", "degree names"],
  salaryMinCLP: ["sueldominclp", "sueldo minimo clp mensual", "sueldo mínimo mensual clp", "salaryminclp"],
  salaryMaxCLP: ["sueldomaxclp", "sueldo maximo clp mensual", "sueldo máximo mensual clp", "salarymaxclp"],
  salaryMinSource: ["sueldo minimo fuente", "salaryminsource", "salary min"],
  salaryMaxSource: ["sueldo maximo fuente", "salarymaxsource", "salary max"],
  salaryRaw: ["sueldo original", "salario original", "salaryraw", "salary source"],
  salaryCurrency: ["moneda", "currency", "salarycurrency"],
  salaryPeriod: ["periodo sueldo", "salaryperiod", "periodicidad sueldo"],
  salaryBasis: ["basesueldo", "base sueldo", "salarybasis", "remuneracionbase", "bruto liquido"],
  salaryVisibility: ["visibilidad sueldo", "salaryvisibility", "reservado"],
  salaryComponents: ["componentes sueldo", "salarycomponents", "componentes remuneracion"],
  salaryEvidence: ["evidencia sueldo", "salaryevidence"],
  salaryIsDisclosed: ["sueldo informado", "salaryisdisclosed"],
  description: ["descripcion", "descripción", "description", "detalle", "descriptionplain"],
  descriptionHtmlSanitized: ["descripcion html", "descriptionhtmlsanitized", "html sanitizado"],
  responsibilities: ["funciones", "responsabilidades", "responsibilities"],
  requirements: ["requisitos", "requirements"],
  mandatoryRequirements: ["requisitos excluyentes", "mandatoryrequirements"],
  benefits: ["beneficios", "benefits"],
  skills: ["habilidades", "skills", "competencias"],
  skillsExplicit: ["habilidades explicitas", "skillsexplicit", "competencias declaradas"],
  normalizedSkills: ["habilidades normalizadas", "normalizedskills"],
  licenses: ["licencias", "licenses", "licencia profesional"],
  languages: ["idiomas", "languages"],
  applicationUrl: ["url postulacion", "applicationurl", "applyurl", "enlace postulacion"],
  applicationMethod: ["metodo postulacion", "applicationmethod", "postulacion"],
  requiredDocuments: ["documentos requeridos", "requireddocuments"],
  recruitmentStages: ["etapas seleccion", "etapas de reclutamiento", "recruitmentstages"],
  canonicalUrl: ["url", "urloriginal", "enlace", "link", "canonicalurl", "oferta original"],
  allSourceUrls: ["todas las urls", "allsourceurls", "urls fuentes"],
  publishedAt: ["fechapublicacion", "fecha_publicacion", "publishedat", "publicada", "fecha publicación"],
  expiresAt: ["fechacierre", "fecha_cierre", "expiresat", "vence", "fecha vencimiento"],
  sourceObservedAt: ["fecha observacion", "observado el", "sourceobservedat", "capturedat"],
  recordUpdatedAt: ["registro actualizado", "recordupdatedat"],
  lastVerifiedAt: ["ultima verificacion", "lastverifiedat"],
  sourceCodes: ["fuente", "fuentes", "source", "sourcecodes", "sourcecode"],
  sourceExternalIds: ["id externo", "sourceexternalid", "id aviso", "externalid", "external id"],
  companyBoardId: ["board id", "companyboardid", "site id", "identificador board"],
  sourceStatus: ["estado fuente", "sourcestatus", "source status"],
  verificationStatus: ["estado oferta", "verificationstatus", "estado verificacion"],
  availabilityConfidence: ["confianza disponibilidad", "availabilityconfidence"],
  dataCompleteness: ["completitud", "datacompleteness"],
  sourceEvidence: ["evidencia fuente", "sourceevidence", "field evidence"],
  provenance: ["procedencia", "provenance", "notas fuente"],
};

function key(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[ _-]+/g, " ")
    .trim();
}

function parseStructured(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function splitList(value: unknown) {
  const parsed = parseStructured(value);
  if (Array.isArray(parsed))
    return parsed.map(item => String(item).trim()).filter(Boolean);
  return typeof parsed === "string"
    ? parsed
        .split(/[;\n|]/)
        .map(item => item.trim())
        .filter(Boolean)
    : parsed;
}

function cleanDate(value: unknown) {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (/^\d{4}-\d\d-\d\d$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}

const listFields = new Set([
  "responsibilities",
  "requirements",
  "mandatoryRequirements",
  "benefits",
  "skills",
  "skillsExplicit",
  "normalizedSkills",
  "sourceCodes",
  "sourceExternalIds",
  "allSourceUrls",
  "degreeNames",
  "licenses",
  "languages",
  "requiredDocuments",
  "recruitmentStages",
]);
const dateFields = new Set([
  "publishedAt",
  "expiresAt",
  "sourceObservedAt",
  "recordUpdatedAt",
  "lastVerifiedAt",
]);
const jsonFields = new Set([
  "geoEvidence",
  "workplaceEvidence",
  "salaryComponents",
  "salaryEvidence",
  "sourceEvidence",
]);
const numericFields = new Set([
  "experienceMinYears",
  "geoConfidence",
  "hoursPerWeek",
  "vacancyCount",
  "availabilityConfidence",
  "dataCompleteness",
]);

export function mapImportRows(
  rows: ImportRow[],
  mapping: Record<string, string | undefined>
) {
  const headers = Object.keys(rows[0] ?? {});
  const selected = { ...mapping };
  for (const [canonical, aliases] of Object.entries(headerAliases)) {
    if (selected[canonical]) continue;
    const match = headers.find(header =>
      aliases.some(alias => key(alias) === key(header))
    );
    if (match) selected[canonical] = match;
  }
  return rows.map(row => {
    const mapped: ImportRow = {};
    for (const [canonical, header] of Object.entries(selected)) {
      if (!header || row[header] === undefined || row[header] === "") continue;
      let value: unknown = row[header];
      if (listFields.has(canonical)) value = splitList(value);
      else if (jsonFields.has(canonical)) value = parseStructured(value);
      if (dateFields.has(canonical)) value = cleanDate(value);
      if (["salaryMinCLP", "salaryMaxCLP"].includes(canonical) && typeof value === "string") {
        try {
          value = parseCLPAmount(value);
        } catch {
          value = String(value);
        }
      }
      if (numericFields.has(canonical) && typeof value === "string" && value.trim())
        value = Number(value.replace(/[^\d.-]/g, ""));
      if (canonical === "salaryBasis" && typeof value === "string") {
        const normalized = key(value);
        value = normalized.includes("liquid") || normalized === "net"
          ? "net"
          : normalized.includes("bruto") || normalized === "gross"
            ? "gross"
            : "unknown";
      }
      if (["modality", "workplaceType"].includes(canonical) && typeof value === "string") {
        const normalized = key(value);
        const modality = normalized.includes("hibr")
          ? "hibrida"
          : normalized.includes("remot") || normalized.includes("teletrabajo")
            ? "remota"
            : normalized.includes("presencial") || normalized.includes("onsite") || normalized.includes("on site")
              ? "presencial"
              : "no_informada";
        value = canonical === "workplaceType"
          ? modality === "presencial" ? "on_site" : modality === "hibrida" ? "hybrid" : modality === "remota" ? "remote" : "unknown"
          : modality;
      }
      if (canonical === "salaryVisibility" && typeof value === "string") {
        const normalized = key(value);
        value = normalized.includes("reserv")
          ? "reserved"
          : /(?:no informado|no publicado|no divulga|not disclosed|a convenir|confidencial)/.test(normalized)
            ? "not_disclosed"
            : /(?:public|informado|disclosed|visible)/.test(normalized)
              ? "disclosed"
              : "unknown";
      }
      mapped[canonical] = value;
    }
    // Se conserva el registro original completo para trazabilidad aunque algunas columnas
    // no se mapeen al esquema canónico.
    mapped._rawRecord = row;
    return mapped;
  });
}

export function autoMapHeaders(headers: string[]) {
  const mapping: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(headerAliases)) {
    const found = headers.find(header =>
      aliases.some(alias => key(alias) === key(header))
    );
    if (found) mapping[canonical] = found;
  }
  return mapping;
}

export const importMappingLabels: Record<string, string> = {
  title: "Cargo (obligatorio)",
  originalTitle: "Cargo original",
  companyName: "Empresa",
  companySector: "Sector de la empresa",
  countryCode: "País/código país",
  regionCode: "Código de región",
  regionName: "Región",
  communeCode: "Código de comuna",
  communeName: "Comuna normalizada",
  cityRaw: "Ciudad original",
  locationRaw: "Ubicación original",
  officeLocation: "Oficina/sede",
  locality: "Localidad normalizada",
  addressApprox: "Dirección aproximada",
  geoConfidence: "Confianza geográfica (0–100)",
  geoEvidence: "Evidencia geográfica JSON",
  modality: "Modalidad normalizada",
  workplaceType: "Tipo de lugar (on_site/hybrid/remote/unknown)",
  workplaceEvidence: "Evidencia de modalidad",
  category: "Área/ocupación",
  subcategory: "Subárea",
  sector: "Sector explícito",
  inferredSector: "Sector inferido (interno)",
  department: "Departamento",
  team: "Equipo",
  occupationCodeCiuo: "Código ocupacional CIUO",
  seniority: "Cargo / seniority declarado",
  inferredSeniority: "Seniority inferido (interno)",
  jobType: "Tipo de puesto",
  employmentType: "Tipo de empleo",
  contractType: "Tipo de contrato/nombramiento",
  schedule: "Jornada",
  scheduleType: "Tipo de jornada",
  shift: "Turno",
  hoursPerWeek: "Horas semanales",
  vacancyCount: "Cantidad de vacantes",
  practiceType: "Práctica profesional",
  experienceMinYears: "Años mínimos explícitos",
  experienceRaw: "Experiencia original",
  educationLevel: "Nivel de formación",
  degreeNames: "Títulos/grados requeridos",
  salaryMinCLP: "Sueldo mínimo mensual CLP",
  salaryMaxCLP: "Sueldo máximo mensual CLP",
  salaryMinSource: "Mínimo fuente (otra moneda/período)",
  salaryMaxSource: "Máximo fuente (otra moneda/período)",
  salaryRaw: "Sueldo original textual",
  salaryCurrency: "Moneda fuente",
  salaryPeriod: "Periodicidad fuente",
  salaryBasis: "Base del sueldo (bruto/líquido)",
  salaryVisibility: "Visibilidad del sueldo",
  salaryComponents: "Componentes del sueldo JSON",
  salaryEvidence: "Evidencia del sueldo JSON",
  salaryIsDisclosed: "Sueldo informado",
  description: "Descripción plana",
  descriptionHtmlSanitized: "Descripción HTML (será sanitizada en servidor)",
  responsibilities: "Funciones/responsabilidades",
  requirements: "Requisitos",
  mandatoryRequirements: "Requisitos excluyentes expresos",
  benefits: "Beneficios",
  skills: "Habilidades normalizadas",
  skillsExplicit: "Habilidades explícitas de la fuente",
  normalizedSkills: "Habilidades normalizadas (internas)",
  licenses: "Licencias",
  languages: "Idiomas",
  applicationUrl: "URL de postulación",
  applicationMethod: "Método de postulación",
  requiredDocuments: "Documentos requeridos",
  recruitmentStages: "Etapas de selección",
  canonicalUrl: "URL original/canónica",
  allSourceUrls: "URLs de todas las fuentes",
  publishedAt: "Fecha de publicación",
  expiresAt: "Fecha de cierre/vigencia",
  sourceObservedAt: "Fecha observada/capturada",
  recordUpdatedAt: "Fecha de actualización de origen",
  lastVerifiedAt: "Última verificación manual",
  sourceCodes: "Fuente(s) origen",
  sourceExternalIds: "ID(s) externo(s)",
  companyBoardId: "ID del board corporativo",
  sourceStatus: "Estado reportado por la fuente",
  verificationStatus: "Estado de verificación interno",
  availabilityConfidence: "Confianza de disponibilidad (0–100)",
  dataCompleteness: "Completitud (0–100)",
  sourceEvidence: "Evidencia por campo JSON",
  provenance: "Procedencia/notas",
};

export const importMappingGroups: Array<{
  label: string;
  fields: string[];
}> = [
  { label: "Identidad y procedencia", fields: ["title", "originalTitle", "companyName", "companySector", "sourceCodes", "sourceExternalIds", "canonicalUrl", "allSourceUrls", "companyBoardId", "sourceObservedAt", "recordUpdatedAt", "sourceEvidence", "provenance"] },
  { label: "Territorio y modalidad", fields: ["countryCode", "regionCode", "regionName", "communeCode", "communeName", "cityRaw", "locationRaw", "officeLocation", "locality", "addressApprox", "geoConfidence", "geoEvidence", "modality", "workplaceType", "workplaceEvidence"] },
  { label: "Cargo y condiciones", fields: ["category", "subcategory", "sector", "inferredSector", "department", "team", "occupationCodeCiuo", "seniority", "inferredSeniority", "jobType", "employmentType", "contractType", "schedule", "scheduleType", "shift", "hoursPerWeek", "vacancyCount", "practiceType"] },
  { label: "Experiencia, formación y competencias", fields: ["experienceMinYears", "experienceRaw", "educationLevel", "degreeNames", "skills", "skillsExplicit", "normalizedSkills", "licenses", "languages", "responsibilities", "requirements", "mandatoryRequirements", "benefits"] },
  { label: "Remuneración y evidencia", fields: ["salaryMinCLP", "salaryMaxCLP", "salaryMinSource", "salaryMaxSource", "salaryRaw", "salaryCurrency", "salaryPeriod", "salaryBasis", "salaryVisibility", "salaryComponents", "salaryEvidence", "salaryIsDisclosed"] },
  { label: "Descripción y postulación", fields: ["description", "descriptionHtmlSanitized", "applicationUrl", "applicationMethod", "requiredDocuments", "recruitmentStages"] },
  { label: "Ciclo de vida", fields: ["publishedAt", "expiresAt", "lastVerifiedAt", "sourceStatus", "verificationStatus", "availabilityConfidence", "dataCompleteness"] },
];

export const primaryImportFields = [
  "title",
  "companyName",
  "canonicalUrl",
  "sourceCodes",
  "sourceExternalIds",
  "countryCode",
  "regionName",
  "communeName",
  "modality",
  "publishedAt",
  "expiresAt",
  "description",
  "salaryMinCLP",
  "salaryMaxCLP",
  "salaryBasis",
] as const;
