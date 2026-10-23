import type {
  JobFilters,
  JobRecord,
  MatchExplanation,
  MatchFactor,
  Modality,
} from "./domain";

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function parseCLPAmount(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  if (typeof value === "number") {
    const rounded = Math.round(value);
    if (!Number.isFinite(value) || value < 0 || rounded > 2_147_483_647)
      throw new Error(
        "El sueldo debe ser un monto mensual no negativo en CLP."
      );
    return rounded;
  }

  const amount = String(value)
    .trim()
    .replace(/^(?:(?:CLP\s*)?\$\s*|CLP\s*)/i, "")
    .replace(/\s*(?:CLP)$/i, "")
    .replace(/[\s\u00a0]+/g, "");
  const chileGrouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(amount);
  const usGrouped = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(amount);
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(amount);
  const integer = /^\d+$/.test(amount);
  const decimal = /^\d+[.,]\d{1,2}$/.test(amount);
  let normalized: string;

  if (chileGrouped) normalized = amount.replace(/\./g, "").replace(",", ".");
  else if (usGrouped) normalized = amount.replace(/,/g, "");
  else if (grouped) normalized = amount.replace(/[.,]/g, "");
  else if (integer) normalized = amount;
  else if (decimal) normalized = amount.replace(",", ".");
  else
    throw new Error(
      "Sueldo inválido: usa un monto mensual en CLP, por ejemplo 1.200.000."
    );

  const parsed = Number(normalized);
  const rounded = Math.round(parsed);
  if (!Number.isFinite(parsed) || parsed < 0 || rounded > 2_147_483_647)
    throw new Error("El sueldo debe ser un monto mensual no negativo en CLP.");
  return rounded;
}

export function normalizeImportedCountry(
  value: unknown,
  hasVerifiedChileLocation: boolean
): string {
  const country = String(value ?? "")
    .trim()
    .toUpperCase();
  if (country) return country === "CHILE" ? "CL" : country;
  return hasVerifiedChileLocation ? "CL" : "";
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(/[\n,;|]/)
      .map(item => item.trim())
      .filter(Boolean);
  return [];
}

export function stableFingerprint(
  job: Pick<
    JobRecord,
    "title" | "companyName" | "regionName" | "communeName" | "publishedAt"
  >
): string {
  return [
    job.companyName,
    job.title,
    job.regionName,
    job.communeName,
    job.publishedAt,
  ]
    .map(normalizeText)
    .join("|");
}

export function searchText(job: JobRecord): string {
  return normalizeText(
    [
      job.title,
      job.companyName,
      job.description,
      ...(job.responsibilities ?? []),
      ...(job.requirements ?? []),
      ...(job.skills ?? []),
    ].join(" ")
  );
}

function intersects<T>(
  selected: T[] | undefined,
  actual: T | null | undefined
): boolean {
  if (!selected?.length) return true;
  return actual != null && selected.includes(actual);
}

function santiagoDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterJobs(
  jobs: JobRecord[],
  filters: JobFilters,
  savedIds: Set<string> = new Set()
): JobRecord[] {
  const q = normalizeText(filters.q);
  const now = Date.now();
  const includeUndisclosedSalary = filters.includeUndisclosedSalary !== false;
  const selectedModalities = filters.modalities?.length
    ? filters.modalities
    : ["presencial"];
  return jobs.filter(job => {
    if (job.countryCode && job.countryCode !== "CL") return false;
    if (job.active === false || job.verificationStatus === "archivado")
      return false;
    const expiry = job.expiresAt
      ? new Date(job.expiresAt).getTime()
      : Number.NaN;
    const effectiveStatus =
      job.verificationStatus === "vencido" ||
      (Number.isFinite(expiry) && expiry < now)
        ? "vencido"
        : (job.verificationStatus ?? "por_verificar");
    if (effectiveStatus === "vencido" && !filters.statuses?.includes("vencido"))
      return false;
    if (q && !searchText(job).includes(q)) return false;
    if (
      filters.regions?.length &&
      !filters.regions.some(
        v =>
          v === job.regionCode ||
          normalizeText(v) === normalizeText(job.regionName)
      )
    )
      return false;
    if (
      filters.communes?.length &&
      !filters.communes.some(
        v =>
          v === job.communeCode ||
          normalizeText(v) === normalizeText(job.communeName)
      )
    )
      return false;
    if (job.modality === "no_informada") {
      if (!filters.includeUnknownModality) return false;
    } else if (!selectedModalities.includes(job.modality)) return false;
    const selectedDate =
      filters.dateBasis === "verification"
        ? job.lastVerifiedAt
        : job.publishedAt;
    if (filters.publishedWithinDays) {
      const timestamp = selectedDate
        ? new Date(selectedDate).getTime()
        : Number.NaN;
      if (
        !Number.isFinite(timestamp) ||
        timestamp < now - filters.publishedWithinDays * 86_400_000
      )
        return false;
    }
    if ((filters.dateFrom || filters.dateTo) && !selectedDate) return false;
    if (
      selectedDate &&
      filters.dateFrom &&
      santiagoDateKey(selectedDate) < filters.dateFrom
    )
      return false;
    if (
      selectedDate &&
      filters.dateTo &&
      santiagoDateKey(selectedDate) > filters.dateTo
    )
      return false;
    const salaryWasWithheld =
      job.salaryVisibility === "reserved" ||
      job.salaryVisibility === "not_disclosed";
    const comparableSalaryMinCLP = salaryWasWithheld ? null : job.salaryMinCLP;
    const comparableSalaryMaxCLP = salaryWasWithheld ? null : job.salaryMaxCLP;
    if ((filters.salaryMin ?? 0) > 0) {
      if (comparableSalaryMaxCLP == null) {
        if (!includeUndisclosedSalary) return false;
      } else if (comparableSalaryMaxCLP < (filters.salaryMin ?? 0)) return false;
    }
    if ((filters.salaryMax ?? 0) > 0) {
      if (comparableSalaryMinCLP == null) {
        if (!includeUndisclosedSalary) return false;
      } else if (
        comparableSalaryMinCLP > (filters.salaryMax ?? Number.MAX_SAFE_INTEGER)
      )
        return false;
    }
    const salaryUndisclosed =
      salaryWasWithheld ||
      (comparableSalaryMinCLP == null &&
        comparableSalaryMaxCLP == null &&
        job.salaryIsDisclosed !== true);
    if (salaryUndisclosed && !includeUndisclosedSalary) return false;
    if (
      filters.salaryBasis &&
      filters.salaryBasis !== "any" &&
      job.salaryBasis !== filters.salaryBasis &&
      !(salaryUndisclosed && includeUndisclosedSalary)
    )
      return false;
    if (!intersects(filters.categories, job.category)) return false;
    if (!intersects(filters.subcategories, job.subcategory)) return false;
    if (!intersects(filters.seniorities, job.seniority)) return false;
    if (!intersects(filters.schedules, job.schedule)) return false;
    if (!intersects(filters.contracts, job.contractType)) return false;
    if (
      !intersects(
        filters.companies?.map(normalizeText),
        normalizeText(job.companyName)
      )
    )
      return false;
    if (
      filters.sources?.length &&
      !filters.sources.some(v => job.sourceCodes?.includes(v))
    )
      return false;
    if (
      !intersects(
        filters.sectors?.map(normalizeText),
        normalizeText(job.sector)
      )
    )
      return false;
    if (filters.statuses?.length && !filters.statuses.includes(effectiveStatus))
      return false;
    if (filters.withOriginalUrl && !job.canonicalUrl) return false;
    if (filters.onlySaved && !savedIds.has(job.id)) return false;
    if (filters.experience?.length) {
      const value = job.experienceMinYears;
      const keys = filters.experience;
      const known =
        value == null
          ? keys.includes("no_informada")
          : keys.some(range => {
              if (range === "sin_experiencia") return value === 0;
              if (range === "0-1") return value <= 1;
              if (range === "1-2") return value >= 1 && value <= 2;
              if (range === "3-5") return value >= 3 && value <= 5;
              if (range === "6-10") return value >= 6 && value <= 10;
              return range === ">10" && value > 10;
            });
      if (!known) return false;
    }
    if (
      filters.education?.length &&
      !filters.education.some(
        value => normalizeText(value) === normalizeText(job.educationLevel)
      )
    )
      return false;
    return true;
  });
}

export const DEFAULT_MATCH_WEIGHTS = {
  function: 25,
  skills: 25,
  experience: 15,
  education: 10,
  geography: 15,
  conditions: 10,
};

const EQUIVALENCES: Record<string, string[]> = {
  "administracion bancaria": [
    "gestion de convenios",
    "operaciones",
    "back office",
    "analisis comercial",
    "control de gestion",
  ],
  "back office": ["operaciones", "procesos", "soporte operacional"],
  "control de gestion": ["analisis financiero", "presupuesto", "planificacion"],
  "servicio al cliente": [
    "atencion al cliente",
    "experiencia cliente",
    "relacion comercial",
  ],
};

function tokenize(value: unknown): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter(part => part.length > 2)
  );
}

function overlap(
  a: string[],
  b: string[]
): { ratio: number; shared: string[]; missing: string[] } {
  const left = new Set(a.flatMap(item => [...tokenize(item)]));
  const right = new Set(b.flatMap(item => [...tokenize(item)]));
  const shared = [...left].filter(item => right.has(item));
  const missing = [...right].filter(item => !left.has(item));
  return {
    ratio: right.size ? shared.length / right.size : 0.5,
    shared,
    missing,
  };
}

export type MatchCandidate = {
  preferredTitles: string[];
  compatibleTitles: string[];
  sectors: string[];
  yearsExperience: number;
  experienceYearsKnown?: boolean;
  seniority?: string | null;
  education: string[];
  educationKnown?: boolean;
  certifications: string[];
  licenses: string[];
  credentialsKnown?: boolean;
  hardSkills: string[];
  softSkills: string[];
  languages?: string[];
  experience?: Array<{
    role: string;
    companyName?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    achievements?: string | null;
  }>;
  acceptedModalities: Modality[];
  acceptedSchedules: string[];
  preferredContracts: string[];
  regionsAvailable: string[];
  communeName?: string | null;
  willingToRelocate: boolean;
  salaryTargetCLP?: number | null;
  salaryBasisPreference?: "gross" | "net" | "unknown";
};

function minimumExperienceFromRequirement(requirement: string): number | null {
  const normalized = normalizeText(requirement);
  if (!/\bexperiencia\b/.test(normalized)) return null;
  const match = normalized.match(/\b(\d+)\s+(?:anos?|years?)\b/);
  if (!match) return null;
  const years = Number(match[1]);
  return Number.isSafeInteger(years) ? years : null;
}

const REQUIREMENT_STOP_WORDS = new Set([
  "a", "al", "algun", "alguna", "algunas", "algunos", "con", "contar",
  "de", "del", "debe", "deben", "el", "ella", "en", "experiencia",
  "excluyente", "obligatorio", "obligatoria", "para", "poseer", "requerido",
  "requerida", "requiere", "tener", "un", "una", "uno", "unos", "unas",
  "anos", "ano", "licencia", "licencias", "certificado", "certificacion",
  "titulo", "grado", "estudios", "formacion", "educacion", "basicos",
  "deseable", "manejo", "dominio", "conocimiento", "conocimientos", "clase",
  "conducir", "vigente", "acreditar", "acredite",
]);

function requirementTokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter(token => token && !REQUIREMENT_STOP_WORDS.has(token));
}

function credentialMatches(requirement: string, credential: string): boolean {
  const required = requirementTokens(requirement);
  const available = new Set(normalizeText(credential).split(" ").filter(Boolean));
  if (!required.length) return false;
  const aliases: Record<string, string[]> = {
    ingles: ["english"],
    english: ["ingles"],
    ingeniero: ["ingenieria"],
    ingeniera: ["ingenieria"],
    ingenieria: ["ingeniero", "ingeniera"],
    magister: ["master"],
    master: ["magister"],
    tecnico: ["tecnica"],
    tecnica: ["tecnico"],
  };
  return required.every(
    token =>
      available.has(token) ||
      (aliases[token] ?? []).some(alias => available.has(alias))
  );
}

function educationRank(value: string): number | null {
  const normalized = normalizeText(value);
  if (/\b(?:doctorado|doctorado profesional)\b/.test(normalized)) return 5;
  if (/\b(?:magister|master|mba)\b/.test(normalized)) return 4;
  if (/\b(?:universitario|universitaria|licenciatura|profesional)\b/.test(normalized))
    return 3;
  if (/\b(?:tecnico|tecnica)\b/.test(normalized)) return 2;
  if (/\b(?:ensenanza media|educacion media|secundaria)\b/.test(normalized))
    return 1;
  return null;
}

function educationMatches(candidateEducation: string, requirement: string) {
  const candidateRank = educationRank(candidateEducation);
  const requiredRank = educationRank(requirement);
  if (candidateRank != null && requiredRank != null)
    return candidateRank >= requiredRank;
  return credentialMatches(requirement, candidateEducation);
}

export function scoreMatch(
  candidate: MatchCandidate,
  job: JobRecord,
  weights = DEFAULT_MATCH_WEIGHTS
): MatchExplanation {
  const structuredExperience = candidate.experience ?? [];
  const experienceRoles = structuredExperience
    .map(item => item.role)
    .filter(Boolean);
  const roleStrings = [
    ...candidate.preferredTitles,
    ...candidate.compatibleTitles,
    ...experienceRoles,
  ];
  const jobRoleStrings = [
    job.title,
    job.originalTitle ?? "",
    job.category ?? "",
    job.subcategory ?? "",
    job.department ?? "",
    job.team ?? "",
    ...(job.responsibilities ?? []),
  ].filter(Boolean);
  const roleCompare = overlap(roleStrings, jobRoleStrings);
  const crossEquivalent =
    roleStrings.some(role =>
      (EQUIVALENCES[normalizeText(role)] ?? []).some(equivalent =>
        jobRoleStrings.some(jobText =>
          normalizeText(jobText).includes(normalizeText(equivalent))
        )
      )
    ) ||
    jobRoleStrings.some(role =>
      (EQUIVALENCES[normalizeText(role)] ?? []).some(equivalent =>
        roleStrings.some(candidateRole =>
          normalizeText(candidateRole).includes(normalizeText(equivalent))
        )
      )
    );
  const sectorCompare = overlap(candidate.sectors, [job.sector ?? job.companySector ?? ""]);
  const sectorScore = !job.sector && !job.companySector
    ? 0.65
    : candidate.sectors.length
      ? sectorCompare.ratio
      : 0.65;
  const roleScore = Math.min(
    1,
    (roleCompare.ratio * 0.8 + sectorScore * 0.2) + (crossEquivalent ? 0.18 : 0)
  );

  const candidateSkills = [
    ...candidate.hardSkills,
    ...candidate.softSkills,
    ...candidate.certifications,
    ...candidate.licenses,
    ...(candidate.languages ?? []),
  ];
  const explicitJobSkills = [
    ...(job.skillsExplicit ?? []),
    ...(job.skills ?? []),
    ...(job.normalizedSkills ?? []),
  ];
  const targetSkills = [...new Set([...explicitJobSkills, ...(job.requirements ?? [])])];
  const skillCompare = overlap(candidateSkills, targetSkills);
  const skillsRatio = targetSkills.length ? skillCompare.ratio : 0.65;
  const rawExperienceMinimum = job.experienceRaw?.match(/\b(\d+)\s+(?:anos?|years?)\b/);
  const experienceMinimum =
    job.experienceMinYears ??
    (rawExperienceMinimum ? Number(rawExperienceMinimum[1]) : null);
  const experienceYearsKnown =
    candidate.experienceYearsKnown ?? candidate.yearsExperience > 0;
  const yearsScore =
    experienceMinimum == null
      ? 0.65
      : !experienceYearsKnown
        ? 0.65
        : candidate.yearsExperience >= experienceMinimum
          ? 1
          : candidate.yearsExperience / Math.max(experienceMinimum, 1);
  const seniorityScore =
    candidate.seniority && job.seniority
      ? normalizeText(candidate.seniority) === normalizeText(job.seniority)
        ? 1
        : 0.5
      : 0.65;
  const experienceCompare = overlap(experienceRoles, jobRoleStrings);
  const experienceRoleScore = experienceRoles.length
    ? experienceCompare.ratio
    : 0.65;
  const expScore = Math.min(
    1,
    yearsScore * 0.55 + seniorityScore * 0.2 + experienceRoleScore * 0.25
  );

  const educationRequirements = [
    ...(job.educationLevel ? [job.educationLevel] : []),
    ...(job.degreeNames ?? []),
    ...(job.mandatoryRequirements ?? []).filter(requirement =>
      /\b(?:educacion|formacion|titulo|licenciatura|tecnico|magister|universitario|grado)\b/.test(
        normalizeText(requirement)
      )
    ),
  ].filter(Boolean);
  const uniqueEducationRequirements = [...new Set(educationRequirements)];
  const educationMatched = uniqueEducationRequirements.filter(requirement =>
    candidate.education.some(degree => educationMatches(degree, requirement))
  );
  const educationKnown = candidate.educationKnown === true;
  const educationMatch = !uniqueEducationRequirements.length
    ? 0.7
    : !candidate.education.length
      ? educationKnown
        ? 0
        : 0.65
      : educationMatched.length
        ? 0.35 + 0.65 * (educationMatched.length / uniqueEducationRequirements.length)
        : educationKnown
          ? 0
          : 0.3;

  const modalityKnown = job.modality !== "no_informada";
  const modalityOK =
    !modalityKnown ||
    !candidate.acceptedModalities.length ||
    candidate.acceptedModalities.includes(job.modality);
  const jobLocationKnown = Boolean(job.regionName || job.regionCode || job.communeName);
  const regionOK =
    !jobLocationKnown ||
    !candidate.regionsAvailable.length ||
    candidate.regionsAvailable.some(
      region =>
        normalizeText(region) === normalizeText(job.regionName) ||
        region === job.regionCode ||
        normalizeText(region) === normalizeText(job.communeName)
    ) ||
    candidate.willingToRelocate;
  const geoScore =
    (modalityKnown ? (modalityOK ? 1 : 0) : 0.65) *
    (jobLocationKnown ? (regionOK ? 1 : 0) : 0.65);
  const scheduleValue = job.schedule ?? job.scheduleType;
  const contractValue = job.contractType ?? job.employmentType;
  const salaryPubliclyDisclosed =
    job.salaryIsDisclosed === true &&
    job.salaryVisibility !== "reserved" &&
    job.salaryVisibility !== "not_disclosed";
  const conditionSignals = [
    candidate.acceptedSchedules.length && scheduleValue
      ? candidate.acceptedSchedules.some(
          value => normalizeText(value) === normalizeText(scheduleValue)
        )
      : null,
    candidate.preferredContracts.length && contractValue
      ? candidate.preferredContracts.some(
          value => normalizeText(value) === normalizeText(contractValue)
        )
      : null,
    candidate.salaryTargetCLP &&
    job.salaryMaxCLP &&
    (candidate.salaryBasisPreference === "unknown" ||
      job.salaryBasis === candidate.salaryBasisPreference)
      ? job.salaryMaxCLP >= candidate.salaryTargetCLP
      : null,
  ].filter((value): value is boolean => value !== null);
  const conditionsScore = conditionSignals.length
    ? conditionSignals.filter(Boolean).length / conditionSignals.length
    : 0.7;

  const factors: MatchFactor[] = [
    {
      key: "function",
      label: "Funciones y cargos",
      weight: weights.function,
      score: Math.round(roleScore * weights.function),
      evidence: [...roleCompare.shared, ...sectorCompare.shared].slice(0, 5),
      gaps: roleCompare.missing.slice(0, 4),
      insufficient: roleStrings.length
        ? []
        : ["No hay cargos preferidos ni experiencia estructurada ingresados."],
    },
    {
      key: "skills",
      label: "Competencias",
      weight: weights.skills,
      score: Math.round(skillsRatio * weights.skills),
      evidence: skillCompare.shared.slice(0, 5),
      gaps: skillCompare.missing.slice(0, 5),
      insufficient: targetSkills.length
        ? candidateSkills.length
          ? []
          : ["Competencias del candidato no declaradas."]
        : ["El aviso no declara competencias suficientes."],
    },
    {
      key: "experience",
      label: "Experiencia y seniority",
      weight: weights.experience,
      score: Math.round(expScore * weights.experience),
      evidence: [
        experienceMinimum == null
          ? null
          : `Experiencia mínima publicada: ${experienceMinimum} años`,
        experienceYearsKnown
          ? `Experiencia del perfil declarada: ${candidate.yearsExperience} años`
          : null,
        ...experienceCompare.shared.slice(0, 2),
      ].filter(Boolean) as string[],
      gaps: [
        experienceYearsKnown &&
        experienceMinimum != null &&
        candidate.yearsExperience < experienceMinimum
          ? "La experiencia declarada es menor a la solicitada."
          : null,
        experienceRoles.length && !experienceCompare.shared.length
          ? "Los cargos del historial no coinciden claramente con el aviso."
          : null,
      ].filter(Boolean) as string[],
      insufficient: [
        experienceMinimum == null ? "Experiencia requerida no informada en el aviso." : null,
        !experienceYearsKnown ? "Años de experiencia del perfil no declarados; no se interpretan como cero." : null,
        !experienceRoles.length ? "El perfil no contiene cargos de experiencia estructurados." : null,
      ].filter(Boolean) as string[],
    },
    {
      key: "education",
      label: "Formación y requisitos",
      weight: weights.education,
      score: Math.round(educationMatch * weights.education),
      evidence: educationMatched.slice(0, 4),
      gaps: uniqueEducationRequirements
        .filter(requirement => !educationMatched.includes(requirement))
        .slice(0, 4)
        .map(requirement => `Revisar formación: ${requirement}`),
      insufficient: [
        !uniqueEducationRequirements.length
          ? "Formación requerida no informada en el aviso."
          : null,
        uniqueEducationRequirements.length && !educationKnown
          ? "La lista de formación no está confirmada como completa; no se infiere un título faltante."
          : null,
      ].filter(Boolean) as string[],
    },
    {
      key: "geography",
      label: "Ubicación y modalidad",
      weight: weights.geography,
      score: Math.round(geoScore * weights.geography),
      evidence: [job.communeName, job.regionName, modalityKnown ? job.modality : null]
        .filter(Boolean) as string[],
      gaps: [
        !modalityOK ? `Modalidad ${job.modality} no aceptada.` : null,
        !regionOK ? "Ubicación fuera de las regiones disponibles." : null,
      ].filter(Boolean) as string[],
      insufficient: [
        !modalityKnown ? "Modalidad no informada en el aviso." : null,
        !jobLocationKnown ? "Ubicación territorial no informada en el aviso." : null,
      ].filter(Boolean) as string[],
    },
    {
      key: "conditions",
      label: "Jornada, contrato y renta",
      weight: weights.conditions,
      score: Math.round(conditionsScore * weights.conditions),
      evidence: [scheduleValue, contractValue].filter(Boolean) as string[],
      gaps:
        conditionsScore < 1
          ? ["Revisar compatibilidad de jornada, contrato o remuneración."]
          : [],
      insufficient: [
        !scheduleValue && "Jornada no informada",
        !contractValue && "Contrato no informado",
        !salaryPubliclyDisclosed && "Remuneración no informada",
      ].filter(Boolean) as string[],
    },
  ];

  const exclusions: string[] = [];
  const requirementInsufficient: string[] = [];
  if (experienceMinimum != null && !experienceYearsKnown)
    requirementInsufficient.push(
      `Años de experiencia no confirmados para el mínimo de ${experienceMinimum}.`
    );
  const educationCredentials = candidate.education;
  for (const requirement of uniqueEducationRequirements) {
    if (educationMatched.includes(requirement)) continue;
    if (educationKnown) exclusions.push(requirement);
    else requirementInsufficient.push(`Formación no confirmada para: ${requirement}`);
  }
  const candidateCredentials = [
    ...candidate.certifications,
    ...candidate.licenses,
    ...candidate.hardSkills,
    ...candidate.softSkills,
    ...(candidate.languages ?? []),
  ];
  const normalizedCredentialMatches = (requirement: string, credentials: string[]) =>
    credentials.some(credential => credentialMatches(requirement, credential));
  const explicitNegativeMatches = (requirement: string, credentials: string[]) =>
    credentials.some(credential =>
      /(?:^|\s)(?:no|sin|carece|falta)(?:\s|$)/.test(normalizeText(credential)) &&
      credentialMatches(requirement, credential)
    );
  for (const requirement of job.mandatoryRequirements ?? []) {
    const normalizedRequirement = normalizeText(requirement);
    const minimumExperience = minimumExperienceFromRequirement(requirement);
    if (minimumExperience !== null) {
      if (!experienceYearsKnown) {
        requirementInsufficient.push(
          `Años de experiencia no informados para: ${requirement}`
        );
      } else if (candidate.yearsExperience < minimumExperience) {
        exclusions.push(requirement);
      }
      continue;
    }
    if (/\b(?:experiencia|anos?|years?|exp)\b/.test(normalizedRequirement)) {
      requirementInsufficient.push(
        `Revisar requisito de experiencia: ${requirement}`
      );
      continue;
    }
    const isEducationRequirement =
      /\b(?:educacion|formacion|titulo|licenciatura|tecnico|magister|universitario|grado)\b/.test(
        normalizedRequirement
      );
    const isLicenseRequirement = /\b(?:licencia|permiso|carnet)\b/.test(
      normalizedRequirement
    );
    const isCertificationRequirement =
      /\b(?:certificacion|certificado|curso|acreditacion)\b/.test(
        normalizedRequirement
      );
    const isLanguageRequirement =
      /\b(?:idioma|ingles|english|portugues|frances|aleman)\b/.test(
        normalizedRequirement
      );
    const completenessConfirmed = isEducationRequirement
      ? educationKnown
      : isLicenseRequirement || isCertificationRequirement
        ? candidate.credentialsKnown === true
        : false;
    const relevantCredentials = isEducationRequirement
      ? educationCredentials
      : isLicenseRequirement
        ? candidate.licenses
        : isCertificationRequirement
          ? candidate.certifications
          : isLanguageRequirement
            ? candidate.languages ?? []
            : candidateCredentials;
    const satisfied = normalizedCredentialMatches(requirement, relevantCredentials);
    if (satisfied) continue;
    if (explicitNegativeMatches(requirement, relevantCredentials)) {
      exclusions.push(requirement);
      continue;
    }
    if (completenessConfirmed) exclusions.push(requirement);
    else
      requirementInsufficient.push(
        `${relevantCredentials.length ? "Confirmar" : "Dato no informado para"}: ${requirement}`
      );
  }
  if (
    modalityKnown &&
    candidate.acceptedModalities.length &&
    !candidate.acceptedModalities.includes(job.modality)
  )
    exclusions.push(
      `Modalidad ${job.modality} incompatible con las modalidades aceptadas.`
    );
  const score = Math.min(
    100,
    factors.reduce((total, factor) => total + factor.score, 0)
  );
  const uniqueExclusions = [...new Set(exclusions)];
  const uniqueRequirementInsufficient = [...new Set(requirementInsufficient)];
  const eligibilityStatus = uniqueExclusions.length
    ? "not_eligible"
    : uniqueRequirementInsufficient.length
      ? "insufficient"
      : "eligible";
  return {
    score,
    isEligible: eligibilityStatus === "eligible",
    eligibilityStatus,
    factors,
    strengths: factors
      .flatMap(factor =>
        factor.evidence.map(text => `${factor.label}: ${text}`)
      )
      .slice(0, 8),
    gaps: factors.flatMap(factor => factor.gaps).slice(0, 8),
    insufficient: [
      ...uniqueRequirementInsufficient,
      ...factors.flatMap(factor => factor.insufficient),
    ].slice(0, 8),
    exclusions: uniqueExclusions,
  };
}
