import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import * as mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import { and, count, desc, eq, isNull, max, or } from "drizzle-orm";
import {
  appSettings,
  atsCompanyBoards,
  auditEvents,
  candidateExperience,
  candidateJobMatches,
  candidates,
  candidateSkills,
  companies,
  cvDocuments,
  importBatches,
  importRows,
  jobSkills,
  jobNotes,
  jobs,
  jobSourceOccurrences,
  locations,
  savedJobs,
  savedSearches,
} from "../drizzle/schema";
import type { FieldEvidence, JobFilters, JobRecord } from "@shared/domain";
import {
  SOURCE_CATALOG,
} from "./source-catalog";
import { findCommune, findRegion } from "@shared/locations";
import {
  DEFAULT_MATCH_WEIGHTS,
  filterJobs,
  normalizeImportedCountry,
  normalizeText,
  parseCLPAmount,
  scoreMatch,
  stringList,
  type MatchCandidate,
} from "@shared/normalization";
import {
  classifySalaryVisibility,
  isSalaryPubliclyDisclosed,
} from "@shared/salary";
import { getDb } from "./db";

const pdfParse = createRequire(import.meta.url)("pdf-parse") as (
  buffer: Buffer,
  options?: { max?: number }
) => Promise<{ text: string }>;

const id = () => randomUUID().replaceAll("-", "").slice(0, 24);
const optionalDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};
const safeExternalUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
};
const optionalNumber = (value: unknown, label: string): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10_000_000)
    throw new Error(`${label} debe ser un valor numérico válido.`);
  return Math.round(number);
};
const optionalSourceAmount = (value: unknown, label: string): string | null => {
  if (value == null || value === "") return null;
  const raw = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!raw || raw.startsWith("-"))
    throw new Error(`${label} debe ser un monto fuente no negativo válido.`);
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let normalized = raw;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const groupingSeparator = decimalSeparator === "." ? "," : ".";
    normalized = raw.split(groupingSeparator).join("").replace(decimalSeparator, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? "." : ",";
    const index = raw.lastIndexOf(separator);
    const trailingDigits = raw.length - index - 1;
    normalized =
      trailingDigits === 3
        ? raw.split(separator).join("")
        : raw.replace(separator, ".");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999_999.99)
    throw new Error(`${label} debe ser un monto fuente no negativo válido.`);
  return amount.toFixed(2).replace(/\.00$/, "");
};
const optionalPercent = (value: unknown, label: string): number | null => {
  const parsed = optionalNumber(value, label);
  if (parsed != null && (parsed < 0 || parsed > 100))
    throw new Error(`${label} debe estar entre 0 y 100.`);
  return parsed;
};
const parseJsonValue = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[")))
    return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("Un campo JSON de la oferta no contiene JSON válido.");
  }
};
const parseJsonObject = (value: unknown, label: string) => {
  const parsed = parseJsonValue(value);
  if (parsed == null || parsed === "") return {};
  if (typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`${label} debe ser un objeto JSON.`);
  return parsed as Record<string, unknown>;
};
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const sanitizeJobHtml = (value: unknown) => {
  if (value == null || value === "") return null;
  return sanitizeHtml(String(value).slice(0, 120_000), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a"],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
};
const plainTextFromHtml = (value: string) =>
  value
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
const normalizeWorkplaceType = (
  value: unknown,
  fallback: unknown
): "on_site" | "hybrid" | "remote" | "unknown" => {
  const normalized = normalizeText(String(value ?? fallback ?? "unknown")).replaceAll(
    /[\s-]+/g,
    "_"
  );
  if (["on_site", "onsite", "presencial", "in_person"].includes(normalized))
    return "on_site";
  if (["hybrid", "hibrida", "hibrido"].includes(normalized)) return "hybrid";
  if (["remote", "remoto", "remota", "teletrabajo"].includes(normalized))
    return "remote";
  return "unknown";
};

function buildFieldEvidence(
  input: Record<string, unknown>,
  sourceCode: string,
  observedAt: Date
): Record<string, FieldEvidence> {
  const supplied = parseJsonObject(input.sourceEvidence, "La evidencia por campo");
  const evidence: Record<string, FieldEvidence> = {};
  const allowedLevels = new Set(["explicit", "parsed", "inferred", "unknown"]);
  for (const [field, rawEntry] of Object.entries(supplied)) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry))
      throw new Error(`La evidencia de “${field}” debe incluir nivel y valor en un objeto.`);
    const entry = rawEntry as Record<string, unknown>;
    const level = String(entry.level ?? "unknown");
    if (!allowedLevels.has(level))
      throw new Error(`El nivel de evidencia de “${field}” no es válido.`);
    evidence[field] = {
      level: level as FieldEvidence["level"],
      ...(entry.raw != null ? { raw: String(entry.raw).slice(0, 2_000) } : {}),
      sourceCode: String(entry.sourceCode ?? sourceCode).slice(0, 64),
      observedAt: optionalDate(entry.observedAt)?.toISOString() ?? observedAt.toISOString(),
    };
  }
  const inferredFields = new Set([
    "inferredSector",
    "inferredSeniority",
    "normalizedSkills",
    "availabilityConfidence",
    "dataCompleteness",
  ]);
  for (const [field, raw] of Object.entries(input)) {
    if (
      raw == null ||
      raw === "" ||
      field.startsWith("_") ||
      ["sourceEvidence", "rawRecordHash", "provenance"].includes(field) ||
      evidence[field]
    )
      continue;
    const serialized = typeof raw === "string" ? raw : stableJson(raw);
    evidence[field] = {
      level: inferredFields.has(field) ? "inferred" : "explicit",
      raw: serialized.slice(0, 2_000),
      sourceCode,
      observedAt: observedAt.toISOString(),
    };
  }
  return evidence;
}
const normalizeModality = (
  value: unknown
): "presencial" | "hibrida" | "remota" | "no_informada" => {
  const normalized = normalizeText(String(value ?? "no_informada")).replaceAll(
    /[\s-]+/g,
    "_"
  );
  if (["presencial", "in_person", "on_site"].includes(normalized))
    return "presencial";
  if (["hibrida", "hybrid"].includes(normalized)) return "hibrida";
  if (["remota", "remoto", "remote", "teletrabajo"].includes(normalized))
    return "remota";
  return "no_informada";
};

function dbOrThrow() {
  return getDb().then(db => {
    if (!db) throw new Error("La base de datos no está disponible.");
    return db;
  });
}

type DbExecutor = Pick<
  NonNullable<Awaited<ReturnType<typeof getDb>>>,
  "select" | "insert" | "update" | "delete"
>;

function jobForUi(job: typeof jobs.$inferSelect): JobRecord {
  return {
    ...job,
    publishedAt: job.publishedAt,
    expiresAt: job.expiresAt,
    firstSeenAt: job.firstSeenAt,
    lastVerifiedAt: job.lastVerifiedAt,
  };
}

export function hashJobFingerprint(
  input: Pick<
    JobRecord,
    "title" | "companyName" | "regionName" | "communeName" | "publishedAt"
  >
): string {
  const basis = [
    input.companyName,
    input.title,
    input.regionName,
    input.communeName,
    input.publishedAt,
  ]
    .map(normalizeText)
    .join("|");
  return createHash("sha256").update(basis).digest("hex");
}

export async function addAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId?: string,
  executor?: DbExecutor
) {
  const db = executor ?? (await dbOrThrow());
  await db.insert(auditEvents).values({
    id: id(),
    userId,
    action,
    entityType,
    entityId: entityId ?? null,
  });
}

export async function listJobs(filters: JobFilters, userId: number) {
  const db = await dbOrThrow();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.active, true), eq(jobs.countryCode, "CL")));
  const saved = await db
    .select({ jobId: savedJobs.jobId })
    .from(savedJobs)
    .where(eq(savedJobs.userId, userId));
  const savedIds = new Set(saved.map(row => row.jobId));
  const filtered = filterJobs(rows.map(jobForUi), filters, savedIds);
  const sort = filters.sort ?? "recent";
  filtered.sort((a, b) => {
    if (sort === "salary")
      return (b.salaryMaxCLP ?? -1) - (a.salaryMaxCLP ?? -1);
    if (sort === "closing")
      return (
        (optionalDate(a.expiresAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (optionalDate(b.expiresAt)?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    if (sort === "relevance" && filters.q) {
      const q = normalizeText(filters.q);
      const rank = (job: JobRecord) =>
        (normalizeText(job.title).includes(q) ? 3 : 0) +
        (normalizeText(job.companyName).includes(q) ? 2 : 0) +
        (normalizeText(job.description).includes(q) ? 1 : 0);
      return (
        rank(b) - rank(a) ||
        (optionalDate(b.publishedAt)?.getTime() ?? 0) -
          (optionalDate(a.publishedAt)?.getTime() ?? 0)
      );
    }
    return (
      (optionalDate(b.publishedAt)?.getTime() ??
        optionalDate(b.firstSeenAt)?.getTime() ??
        0) -
      (optionalDate(a.publishedAt)?.getTime() ??
        optionalDate(a.firstSeenAt)?.getTime() ??
        0)
    );
  });
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20));
  const page = Math.max(1, filters.page ?? 1);
  const items = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map(job => ({ ...job, saved: savedIds.has(job.id) }));
  const count = <K extends keyof JobRecord>(key: K) => {
    const map = new Map<string, number>();
    for (const job of filtered) {
      const value = job[key];
      if (typeof value === "string" && value)
        map.set(value, (map.get(value) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "es-CL"));
  };
  const sourceMap = new Map<string, number>();
  for (const job of filtered)
    for (const source of job.sourceCodes ?? [])
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  const sources = [...sourceMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "es-CL"));
  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    facets: {
      regions: count("regionName"),
      categories: count("category"),
      subcategories: count("subcategory"),
      seniorities: count("seniority"),
      schedules: count("schedule"),
      contracts: count("contractType"),
      companies: count("companyName"),
      sectors: count("sector"),
      statuses: [
        ...new Set(
          filtered.map(job => job.verificationStatus ?? "por_verificar")
        ),
      ].map(value => ({
        value,
        count: filtered.filter(
          job => (job.verificationStatus ?? "por_verificar") === value
        ).length,
      })),
      sources,
    },
  };
}

export async function getJob(jobId: string, userId: number) {
  const db = await dbOrThrow();
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.id, jobId), eq(jobs.active, true), eq(jobs.countryCode, "CL"))
    )
    .limit(1);
  if (!job) return null;
  const [[saved], [note], sourceOccurrences] = await Promise.all([
    db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
    .limit(1),
    db
    .select()
    .from(jobNotes)
    .where(and(eq(jobNotes.userId, userId), eq(jobNotes.jobId, jobId)))
    .limit(1),
    db
      .select({
        sourceCode: jobSourceOccurrences.sourceCode,
        sourceExternalId: jobSourceOccurrences.sourceExternalId,
        originalUrl: jobSourceOccurrences.originalUrl,
        capturedAt: jobSourceOccurrences.capturedAt,
        sourceObservedAt: jobSourceOccurrences.sourceObservedAt,
        verifiedAt: jobSourceOccurrences.verifiedAt,
        provenance: jobSourceOccurrences.provenance,
        evidence: jobSourceOccurrences.evidence,
      })
      .from(jobSourceOccurrences)
      .where(eq(jobSourceOccurrences.jobId, jobId))
      .orderBy(desc(jobSourceOccurrences.capturedAt))
      .limit(40),
  ]);
  return {
    ...jobForUi(job),
    sourceOccurrences,
    saved: Boolean(saved && !saved.discardedAt),
    tags: saved?.tags ?? [],
    note: note?.note ?? null,
  };
}

export async function listAdminJobs() {
  const db = await dbOrThrow();
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.countryCode, "CL"))
    .orderBy(desc(jobs.updatedAt))
    .limit(500);
  return rows.map(jobForUi);
}

export async function upsertJob(
  input: Record<string, unknown>,
  userId: number,
  sourceCode = "manual",
  executor?: DbExecutor
) {
  const db = executor ?? (await dbOrThrow());
  const title = String(input.title ?? "").trim();
  const companyProvided = Boolean(String(input.companyName ?? "").trim());
  const companyName =
    String(input.companyName ?? "").trim() || "Empresa confidencial";
  const countryValue = String(input.countryCode ?? input.country ?? "CL")
    .trim()
    .toUpperCase();
  const countryCode = countryValue === "CHILE" ? "CL" : countryValue;
  if (countryCode !== "CL")
    throw new Error("Solo se admiten empleos con lugar de trabajo en Chile.");
  if (!title || title.length > 255)
    throw new Error(
      "El cargo es obligatorio y no puede superar 255 caracteres."
    );
  const canonicalUrl = safeExternalUrl(input.canonicalUrl);
  if (input.canonicalUrl && !canonicalUrl)
    throw new Error(
      "La URL original debe ser HTTP(S) y no contener credenciales."
    );
  const publishedAtInput = optionalDate(input.publishedAt);
  const rawRegion = input.regionCode ?? input.regionName;
  const region = findRegion(rawRegion ? String(rawRegion) : null);
  if (rawRegion && !region)
    throw new Error(
      "La región no coincide con el catálogo territorial chileno."
    );
  const rawCommune = input.communeCode ?? input.communeName;
  const commune = findCommune(
    rawCommune ? String(rawCommune) : null,
    region?.code
  );
  if (rawCommune && !commune)
    throw new Error(
      "La comuna no coincide con la región o con el catálogo territorial chileno."
    );
  const base = {
    title,
    companyName,
    regionName: region?.name ?? null,
    communeName: commune?.communeName ?? null,
    publishedAt: publishedAtInput,
  };
  const fingerprint = hashJobFingerprint(base);
  const normalizedSource = normalizeSourceCode(sourceCode);
  const externalIds = stringList(
    input.sourceExternalIds ??
      input.sourceExternalId ??
      input.externalId ??
      input.idExterno
  ).slice(0, 50);
  if (externalIds.some(externalId => externalId.length > 255))
    throw new Error("Cada ID externo debe tener 255 caracteres o menos.");
  const [byExternalOccurrence] = externalIds.length
    ? await db
        .select({ jobId: jobSourceOccurrences.jobId })
        .from(jobSourceOccurrences)
        .where(
          and(
            eq(jobSourceOccurrences.sourceCode, normalizedSource),
            eq(jobSourceOccurrences.sourceExternalId, externalIds[0])
          )
        )
        .limit(1)
    : [];
  const [byExternalJob] = byExternalOccurrence
    ? await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, byExternalOccurrence.jobId))
        .limit(1)
    : [];
  const [byUrl] = canonicalUrl
    ? await db
        .select()
        .from(jobs)
        .where(eq(jobs.canonicalUrl, canonicalUrl))
        .limit(1)
    : [];
  const [byFingerprint] =
    !byExternalJob && !byUrl
      ? await db
          .select()
          .from(jobs)
          .where(eq(jobs.fingerprint, fingerprint))
          .limit(1)
      : [];
  const existing = byExternalJob ?? byUrl ?? byFingerprint;
  const preserveMissing = input._preserveMissing === true;
  const incomingValue = (key: string) => {
    const value = input[key];
    if (preserveMissing && (value == null || value === ""))
      return existing
        ? (existing as unknown as Record<string, unknown>)[key]
        : value;
    return value;
  };
  const incomingList = (key: string) => {
    const list = stringList(input[key]);
    return preserveMissing && list.length === 0 && existing
      ? stringList((existing as unknown as Record<string, unknown>)[key])
      : list;
  };
  const publishedAt = publishedAtInput ?? existing?.publishedAt ?? null;
  const normalizedSourceCodes = stringList(input.sourceCodes).map(
    normalizeSourceCode
  );
  const salaryPeriodInput = incomingValue("salaryPeriod");
  const salaryPeriod = String(
    salaryPeriodInput ??
      (input.salaryMinCLP != null || input.salaryMaxCLP != null
        ? "monthly"
        : existing?.salaryPeriod ?? "unknown")
  ).trim().slice(0, 32);
  const salaryCurrencyInput = incomingValue("salaryCurrency");
  const salaryCurrency = String(
    salaryCurrencyInput ??
      (input.salaryMinCLP != null || input.salaryMaxCLP != null
        ? "CLP"
        : existing?.salaryCurrency ?? "")
  )
    .trim()
    .toUpperCase()
    .slice(0, 12) || null;
  const monthlySalary = ["monthly", "mensual", "mes"].includes(
    normalizeText(salaryPeriod)
  );
  const clpSalary = salaryCurrency == null || salaryCurrency === "CLP";
  if (
    (input.salaryMinCLP != null || input.salaryMaxCLP != null) &&
    (!monthlySalary || !clpSalary)
  )
    throw new Error(
      "Los filtros numéricos solo admiten montos explícitos mensuales en CLP; conserva otros montos en los campos de origen."
    );
  const inputSalaryVisibility = normalizeText(
    String(incomingValue("salaryVisibility") ?? "")
  );
  const rawSalaryText = normalizeText(String(incomingValue("salaryRaw") ?? ""));
  const hiddenSalary =
    /reserv/.test(inputSalaryVisibility || rawSalaryText) ||
    /(?:no informado|no publicado|no divulga|no especificad|not disclosed|a convenir|confidencial)/.test(
      inputSalaryVisibility || rawSalaryText
    );
  if (
    hiddenSalary &&
    (input.salaryMinCLP != null || input.salaryMaxCLP != null)
  )
    throw new Error("Un sueldo reservado/no publicado no puede incluir un valor numérico para filtros.");
  const salaryMinCLP =
    (input.salaryMinCLP != null
      ? parseCLPAmount(input.salaryMinCLP)
      : null) ??
    (preserveMissing && monthlySalary && clpSalary
      ? (existing?.salaryMinCLP ?? null)
      : null);
  const salaryMaxCLP =
    (input.salaryMaxCLP != null
      ? parseCLPAmount(input.salaryMaxCLP)
      : null) ??
    (preserveMissing && monthlySalary && clpSalary
      ? (existing?.salaryMaxCLP ?? null)
      : null);
  if (
    salaryMinCLP != null &&
    salaryMaxCLP != null &&
    salaryMinCLP > salaryMaxCLP
  )
    throw new Error("El sueldo mínimo no puede superar al sueldo máximo.");
  const modalityInput = input.modality ?? input.workplaceType;
  const modality =
    modalityInput == null
      ? (existing?.modality ?? "no_informada")
      : normalizeModality(modalityInput);
  const salaryBasisInput = incomingValue("salaryBasis");
  const salaryBasis =
    salaryBasisInput == null
      ? (existing?.salaryBasis ?? "unknown")
      : String(salaryBasisInput);
  if (!["gross", "net", "unknown"].includes(salaryBasis))
    throw new Error(
      "La base del sueldo debe ser bruto, líquido o desconocida."
    );
  const resolvedCompanyName = companyProvided
    ? companyName
    : (existing?.companyName ?? companyName);
  const hasNamedCompany =
    companyProvided ||
    Boolean(
      existing?.companyName && existing.companyName !== "Empresa confidencial"
    );
  const companyConfidential =
    input.companyConfidential == null
      ? (existing?.companyConfidential ?? !companyProvided)
      : Boolean(input.companyConfidential) || !hasNamedCompany;
  let companyId = companyConfidential ? null : (existing?.companyId ?? null);
  if (!companyConfidential) {
    const normalizedName = normalizeText(resolvedCompanyName).slice(0, 255);
    const [knownCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.normalizedName, normalizedName))
      .limit(1);
    if (knownCompany) companyId = knownCompany.id;
    else {
      companyId = id();
      const website = safeExternalUrl(input.companyWebsite);
      if (input.companyWebsite && !website)
        throw new Error(
          "La URL de empresa debe ser HTTP(S) y no contener credenciales."
        );
      await db.insert(companies).values({
        id: companyId,
        canonicalName: resolvedCompanyName.slice(0, 255),
        normalizedName,
        confidential: false,
        website,
      });
    }
  }
  if (region && commune) {
    const [knownLocation] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.regionCode, region.code),
          eq(locations.communeCode, commune.communeCode)
        )
      )
      .limit(1);
    if (!knownLocation)
      await db.insert(locations).values({
        id: id(),
        regionCode: region.code,
        regionName: region.name,
        communeCode: commune.communeCode,
        communeName: commune.communeName,
      });
  }
  const sourceObservedAt =
    optionalDate(incomingValue("sourceObservedAt")) ??
    (preserveMissing ? (existing?.sourceObservedAt ?? null) : null) ??
    new Date();
  const rawInput =
    input._rawRecord && typeof input._rawRecord === "object"
      ? input._rawRecord
      : input;
  const rawRecordHash = createHash("sha256")
    .update(stableJson(rawInput))
    .digest("hex");
  const sourceEvidence = {
    ...(preserveMissing ? (existing?.sourceEvidence ?? {}) : {}),
    ...buildFieldEvidence(input, normalizedSource, sourceObservedAt),
  };
  const descriptionRaw = String(incomingValue("description") ?? "").slice(
    0,
    120_000
  );
  const htmlInput =
    incomingValue("descriptionHtmlSanitized") ??
    incomingValue("descriptionHtml") ??
    (/<\/?[a-z][^>]*>/i.test(descriptionRaw) ? descriptionRaw : null);
  const descriptionHtmlSanitized = sanitizeJobHtml(htmlInput);
  const description = descriptionRaw
    ? /<\/?[a-z][^>]*>/i.test(descriptionRaw)
      ? plainTextFromHtml(sanitizeJobHtml(descriptionRaw) ?? "").slice(0, 120_000)
      : descriptionRaw
    : plainTextFromHtml(descriptionHtmlSanitized ?? "").slice(0, 120_000);
  const allUrls = stringList(input.allSourceUrls);
  const normalizedUrls = [
    ...new Set([canonicalUrl ?? existing?.canonicalUrl, ...allUrls].filter(Boolean)),
  ]
    .map(value => safeExternalUrl(value))
    .filter((value): value is string => Boolean(value));
  if (allUrls.some(value => !safeExternalUrl(value)))
    throw new Error("Cada URL de origen debe ser HTTP(S) y no contener credenciales.");
  const applicationUrl = safeExternalUrl(incomingValue("applicationUrl"));
  if (incomingValue("applicationUrl") && !applicationUrl)
    throw new Error("La URL de postulación debe ser HTTP(S) y no contener credenciales.");
  const salaryComponentsValue = parseJsonValue(incomingValue("salaryComponents"));
  if (salaryComponentsValue != null && !Array.isArray(salaryComponentsValue))
    throw new Error("Los componentes del sueldo deben ser una lista JSON.");
  const salaryComponents = Array.isArray(salaryComponentsValue)
    ? salaryComponentsValue.slice(0, 50)
    : null;
  const salaryMinSource = optionalSourceAmount(
    incomingValue("salaryMinSource"),
    "El sueldo mínimo fuente"
  );
  const salaryMaxSource = optionalSourceAmount(
    incomingValue("salaryMaxSource"),
    "El sueldo máximo fuente"
  );
  const componentHasAmount = (salaryComponents ?? []).some(component => {
    if (!component || typeof component !== "object" || Array.isArray(component))
      return false;
    const amount = (component as Record<string, unknown>).amount;
    return amount != null && String(amount).trim() !== "";
  });
  const salaryHasAmount =
    salaryMinCLP != null ||
    salaryMaxCLP != null ||
    salaryMinSource != null ||
    salaryMaxSource != null ||
    componentHasAmount;
  const salaryVisibility = classifySalaryVisibility({
    visibility: incomingValue("salaryVisibility"),
    rawText: incomingValue("salaryRaw"),
    hasAmount: salaryHasAmount,
    isDisclosedFlag: incomingValue("salaryIsDisclosed") === true,
  });
  if (
    (salaryVisibility === "reserved" ||
      salaryVisibility === "not_disclosed") &&
    salaryHasAmount
  )
    throw new Error(
      "Un sueldo reservado/no publicado no puede incluir importes ni componentes numéricos."
    );
  if (
    salaryVisibility !== "disclosed" &&
    (input.salaryMinCLP != null || input.salaryMaxCLP != null)
  )
    throw new Error("Solo un sueldo declarado puede poblar los filtros mensuales.");
  const evidenceObject = (value: unknown, label: string) => {
    const parsed = parseJsonValue(value);
    if (parsed == null || parsed === "") return null;
    if (typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
    if (typeof parsed === "string") return { note: parsed.slice(0, 2_000) };
    throw new Error(`${label} debe ser un objeto o texto breve de evidencia.`);
  };
  const sourceStatusValue = incomingValue("sourceStatus");
  const verificationStatusValue = String(
    incomingValue("verificationStatus") ?? "por_verificar"
  );
  if (!["vigente", "por_verificar", "vencido", "archivado"].includes(verificationStatusValue))
    throw new Error("El estado interno de verificación no es válido.");
  const values = {
    fingerprint: existing?.fingerprint ?? fingerprint,
    canonicalUrl: canonicalUrl ?? existing?.canonicalUrl ?? null,
    allSourceUrls: [
      ...new Set([...(existing?.allSourceUrls ?? []), ...normalizedUrls]),
    ],
    sourceExternalIds: [
      ...new Set([...(existing?.sourceExternalIds ?? []), ...externalIds]),
    ],
    companyId,
    title,
    originalTitle: String(incomingValue("originalTitle") ?? title).slice(0, 255),
    normalizedTitle: normalizeText(
      incomingValue("originalTitle") ?? title
    ).slice(0, 255),
    companyName: resolvedCompanyName,
    companyConfidential,
    companySector: incomingValue("companySector")
      ? String(incomingValue("companySector")).slice(0, 160)
      : null,
    countryCode,
    regionCode: region?.code ?? existing?.regionCode ?? null,
    regionName: base.regionName ?? existing?.regionName ?? null,
    communeCode: commune?.communeCode ?? existing?.communeCode ?? null,
    communeName: base.communeName ?? existing?.communeName ?? null,
    locality: incomingValue("locality")
      ? String(incomingValue("locality"))
      : null,
    addressApprox: incomingValue("addressApprox")
      ? String(incomingValue("addressApprox"))
      : null,
    cityRaw: incomingValue("cityRaw") ? String(incomingValue("cityRaw")).slice(0, 180) : null,
    locationRaw: incomingValue("locationRaw") ? String(incomingValue("locationRaw")).slice(0, 500) : null,
    officeLocation: incomingValue("officeLocation") ? String(incomingValue("officeLocation")).slice(0, 255) : null,
    geoConfidence: optionalPercent(incomingValue("geoConfidence"), "La confianza geográfica"),
    geoEvidence: evidenceObject(incomingValue("geoEvidence"), "La evidencia geográfica"),
    modality: modality as "presencial" | "hibrida" | "remota" | "no_informada",
    workplaceType: normalizeWorkplaceType(
      incomingValue("workplaceType"),
      incomingValue("modality") ?? modality
    ),
    workplaceEvidence: evidenceObject(
      incomingValue("workplaceEvidence"),
      "La evidencia de modalidad"
    ),
    category: incomingValue("category")
      ? String(incomingValue("category"))
      : null,
    subcategory: incomingValue("subcategory")
      ? String(incomingValue("subcategory"))
      : null,
    sector: incomingValue("sector") ? String(incomingValue("sector")) : null,
    inferredSector: incomingValue("inferredSector") ? String(incomingValue("inferredSector")) : null,
    department: incomingValue("department") ? String(incomingValue("department")).slice(0, 180) : null,
    team: incomingValue("team") ? String(incomingValue("team")).slice(0, 180) : null,
    occupationCodeCiuo: incomingValue("occupationCodeCiuo") ? String(incomingValue("occupationCodeCiuo")).slice(0, 32) : null,
    seniority: incomingValue("seniority")
      ? String(incomingValue("seniority"))
      : null,
    inferredSeniority: incomingValue("inferredSeniority") ? String(incomingValue("inferredSeniority")) : null,
    jobType: incomingValue("jobType") ? String(incomingValue("jobType")) : null,
    employmentType: incomingValue("employmentType") ? String(incomingValue("employmentType")).slice(0, 80) : null,
    contractType: incomingValue("contractType")
      ? String(incomingValue("contractType"))
      : null,
    schedule: incomingValue("schedule")
      ? String(incomingValue("schedule"))
      : null,
    scheduleType: incomingValue("scheduleType") ? String(incomingValue("scheduleType")).slice(0, 80) : null,
    shift: incomingValue("shift") ? String(incomingValue("shift")).slice(0, 80) : null,
    hoursPerWeek: optionalNumber(incomingValue("hoursPerWeek"), "Las horas semanales"),
    vacancyCount: optionalNumber(incomingValue("vacancyCount"), "La cantidad de vacantes"),
    practiceType: incomingValue("practiceType") ? String(incomingValue("practiceType")).slice(0, 40) : null,
    experienceMinYears:
      optionalNumber(input.experienceMinYears, "La experiencia") ??
      (preserveMissing ? (existing?.experienceMinYears ?? null) : null),
    experienceRaw: incomingValue("experienceRaw") ? String(incomingValue("experienceRaw")).slice(0, 2_000) : null,
    educationLevel: incomingValue("educationLevel")
      ? String(incomingValue("educationLevel"))
      : null,
    degreeNames: incomingList("degreeNames"),
    salaryMinCLP: salaryVisibility === "reserved" ? null : salaryMinCLP,
    salaryMaxCLP: salaryVisibility === "reserved" ? null : salaryMaxCLP,
    salaryMinSource: optionalSourceAmount(incomingValue("salaryMinSource"), "El sueldo mínimo fuente"),
    salaryMaxSource: optionalSourceAmount(incomingValue("salaryMaxSource"), "El sueldo máximo fuente"),
    salaryRaw: incomingValue("salaryRaw") ? String(incomingValue("salaryRaw")).slice(0, 2_000) : null,
    salaryCurrency,
    salaryPeriod,
    salaryBasis: salaryBasis as "gross" | "net" | "unknown",
    salaryVisibility,
    salaryComponents,
    salaryEvidence: evidenceObject(incomingValue("salaryEvidence"), "La evidencia del sueldo"),
    salaryIsDisclosed: isSalaryPubliclyDisclosed(
      salaryVisibility,
      input.salaryIsDisclosed === true
    ),
    description,
    descriptionHtmlSanitized,
    applicationUrl,
    applicationMethod: incomingValue("applicationMethod") ? String(incomingValue("applicationMethod")).slice(0, 255) : null,
    requiredDocuments: incomingList("requiredDocuments"),
    recruitmentStages: incomingList("recruitmentStages"),
    responsibilities: incomingList("responsibilities"),
    requirements: incomingList("requirements"),
    mandatoryRequirements: incomingList("mandatoryRequirements"),
    benefits: incomingList("benefits"),
    skills: incomingList("skills"),
    skillsExplicit: incomingList("skillsExplicit"),
    normalizedSkills: incomingList("normalizedSkills"),
    licenses: incomingList("licenses"),
    languages: incomingList("languages"),
    sourceEvidence,
    companyBoardId: incomingValue("companyBoardId") ? String(incomingValue("companyBoardId")).slice(0, 255) : null,
    rawRecordHash,
    sourceObservedAt,
    recordUpdatedAt: optionalDate(incomingValue("recordUpdatedAt")) ?? (preserveMissing ? (existing?.recordUpdatedAt ?? null) : null),
    sourceStatus: sourceStatusValue ? String(sourceStatusValue).slice(0, 64) : null,
    availabilityConfidence: optionalPercent(incomingValue("availabilityConfidence"), "La confianza de disponibilidad"),
    dataCompleteness: optionalPercent(incomingValue("dataCompleteness"), "La completitud"),
    sourceCodes: [
      ...new Set([
        ...(existing?.sourceCodes ?? []),
        normalizedSource,
        ...normalizedSourceCodes,
      ]),
    ],
    publishedAt,
    expiresAt:
      optionalDate(input.expiresAt) ??
      (preserveMissing ? (existing?.expiresAt ?? null) : null),
    lastSeenAt: new Date(),
    lastVerifiedAt:
      optionalDate(input.lastVerifiedAt) ?? existing?.lastVerifiedAt ?? null,
    verificationStatus: verificationStatusValue as
      | "vigente"
      | "por_verificar"
      | "vencido"
      | "archivado",
    active:
      input.active == null
        ? (existing?.active ?? true)
        : input.active !== false,
  };
  let jobId: string;
  if (existing) {
    jobId = existing.id;
    await db.update(jobs).set(values).where(eq(jobs.id, existing.id));
  } else {
    jobId = id();
    await db.insert(jobs).values({ id: jobId, ...values });
  }
  await db.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
  const skillRows = incomingList("skills")
    .map(skillName => ({
      id: id(),
      jobId,
      skillName: skillName.slice(0, 160),
      normalizedSkill: normalizeText(skillName).slice(0, 160),
    }))
    .filter(row => row.normalizedSkill)
    .slice(0, 200);
  if (skillRows.length) await db.insert(jobSkills).values(skillRows);
  await db.insert(jobSourceOccurrences).values({
    id: id(),
    jobId,
    sourceCode: normalizedSource,
    sourceExternalId: externalIds[0] ?? null,
    originalUrl: canonicalUrl ?? existing?.canonicalUrl ?? null,
    capturedAt: new Date(),
    verifiedAt: optionalDate(input.lastVerifiedAt),
    provenance: String(input.provenance ?? "Carga manual autorizada").slice(0, 2_000),
    sourceKind: "import",
    rawRecordHash,
    sourceObservedAt,
    rawFields: rawInput as Record<string, unknown>,
    evidence: sourceEvidence,
  });
  await addAudit(
    userId,
    existing ? "job.deduplicated_or_updated" : "job.created",
    "job",
    jobId,
    db
  );
  return { id: jobId, duplicate: Boolean(existing) };
}

export async function updateJob(
  jobId: string,
  patch: Record<string, unknown>,
  userId: number
) {
  const current = await getJob(jobId, userId);
  if (!current) throw new Error("La oferta ya no está disponible.");
  const result = await upsertJob({ ...current, ...patch }, userId, "manual");
  await addAudit(userId, "job.updated", "job", result.id);
  return result;
}

export async function archiveJob(jobId: string, userId: number) {
  const db = await dbOrThrow();
  await db
    .update(jobs)
    .set({ active: false, verificationStatus: "archivado" })
    .where(eq(jobs.id, jobId));
  await addAudit(userId, "job.archived", "job", jobId);
  return { success: true };
}

export async function restoreJob(jobId: string, userId: number) {
  const db = await dbOrThrow();
  await db
    .update(jobs)
    .set({
      active: true,
      verificationStatus: "por_verificar",
      lastVerifiedAt: null,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.countryCode, "CL")));
  await addAudit(userId, "job.restored_for_verification", "job", jobId);
  return { success: true, verificationStatus: "por_verificar" as const };
}

export async function getFacets(userId: number) {
  const result = await listJobs(
    { page: 1, pageSize: 100, includeUnknownModality: false },
    userId
  );
  return result.facets;
}

export async function toggleSavedJob(jobId: string, userId: number) {
  const db = await dbOrThrow();
  const [existing] = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
    .limit(1);
  if (existing) {
    await db.delete(savedJobs).where(eq(savedJobs.id, existing.id));
    return { saved: false };
  }
  await db
    .insert(savedJobs)
    .values({ id: id(), userId, jobId, tags: [], discardedAt: null });
  return { saved: true };
}

export async function setJobNote(jobId: string, note: string, userId: number) {
  const db = await dbOrThrow();
  const [existing] = await db
    .select()
    .from(jobNotes)
    .where(and(eq(jobNotes.userId, userId), eq(jobNotes.jobId, jobId)))
    .limit(1);
  if (!note.trim()) {
    if (existing) await db.delete(jobNotes).where(eq(jobNotes.id, existing.id));
    return { success: true };
  }
  if (existing)
    await db
      .update(jobNotes)
      .set({ note: note.trim().slice(0, 5000) })
      .where(eq(jobNotes.id, existing.id));
  else
    await db
      .insert(jobNotes)
      .values({ id: id(), userId, jobId, note: note.trim().slice(0, 5000) });
  return { success: true };
}

export async function listSavedJobs(userId: number, includeDiscarded = false) {
  const db = await dbOrThrow();
  const saves = await db
    .select()
    .from(savedJobs)
    .where(eq(savedJobs.userId, userId))
    .orderBy(desc(savedJobs.createdAt));
  const allJobs = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.active, true), eq(jobs.countryCode, "CL")));
  const notes = await db
    .select()
    .from(jobNotes)
    .where(eq(jobNotes.userId, userId));
  const noteByJob = new Map(notes.map(entry => [entry.jobId, entry.note]));
  return saves
    .filter(entry => includeDiscarded || !entry.discardedAt)
    .map(entry => {
      const job = allJobs.find(item => item.id === entry.jobId);
      return job
        ? {
            ...jobForUi(job),
            saved: true,
            tags: entry.tags,
            discardedAt: entry.discardedAt,
            note: noteByJob.get(entry.jobId) ?? null,
          }
        : null;
    })
    .filter(value => value !== null);
}

export async function updateSavedJob(
  jobId: string,
  userId: number,
  patch: { tags?: string[]; discarded?: boolean }
) {
  const db = await dbOrThrow();
  const [entry] = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
    .limit(1);
  if (!entry)
    throw new Error("Guarda la oferta antes de editar sus etiquetas.");
  await db
    .update(savedJobs)
    .set({
      tags: patch.tags ?? entry.tags,
      discardedAt:
        patch.discarded === undefined
          ? entry.discardedAt
          : patch.discarded
            ? new Date()
            : null,
    })
    .where(eq(savedJobs.id, entry.id));
  return { success: true };
}

export async function listSearches(userId: number) {
  const db = await dbOrThrow();
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.updatedAt));
}

export async function createSearch(
  userId: number,
  name: string,
  filters: Record<string, unknown>
) {
  const db = await dbOrThrow();
  const recordId = id();
  await db.insert(savedSearches).values({
    id: recordId,
    userId,
    name: name.trim().slice(0, 150),
    filters,
    resultCount: 0,
    lastExecutedAt: null,
  });
  return { id: recordId };
}

export async function updateSearch(
  userId: number,
  searchId: string,
  patch: { name?: string; filters?: Record<string, unknown> }
) {
  const db = await dbOrThrow();
  const [search] = await db
    .select()
    .from(savedSearches)
    .where(
      and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId))
    )
    .limit(1);
  if (!search) throw new Error("No se encontró la búsqueda guardada.");
  await db
    .update(savedSearches)
    .set({
      name: patch.name?.trim().slice(0, 150) ?? search.name,
      filters: patch.filters ?? search.filters,
    })
    .where(eq(savedSearches.id, searchId));
  return { success: true };
}

export async function executeSearch(userId: number, searchId: string) {
  const db = await dbOrThrow();
  const [search] = await db
    .select()
    .from(savedSearches)
    .where(
      and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId))
    )
    .limit(1);
  if (!search) throw new Error("No se encontró la búsqueda guardada.");
  const result = await listJobs(
    { ...(search.filters as JobFilters), page: 1, pageSize: 1 },
    userId
  );
  await db
    .update(savedSearches)
    .set({ resultCount: result.total, lastExecutedAt: new Date() })
    .where(eq(savedSearches.id, searchId));
  return { ...result, search };
}

export async function deleteSearch(userId: number, searchId: string) {
  const db = await dbOrThrow();
  await db
    .delete(savedSearches)
    .where(
      and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId))
    );
  return { success: true };
}

const emptyCandidateFields = {
  regionsAvailable: [],
  preferredTitles: [],
  compatibleTitles: [],
  sectors: [],
  education: [],
  certifications: [],
  licenses: [],
  hardSkills: [],
  softSkills: [],
  languages: [],
  acceptedModalities: ["presencial"],
  acceptedSchedules: [],
  preferredContracts: [],
};

export async function listCandidates(userId: number) {
  const db = await dbOrThrow();
  const rows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.ownerId, userId), isNull(candidates.deletedAt)))
    .orderBy(desc(candidates.updatedAt));
  const documents = await db
    .select({ candidateId: cvDocuments.candidateId })
    .from(cvDocuments)
    .where(isNull(cvDocuments.deletedAt));
  const counts = new Map<string, number>();
  for (const doc of documents)
    counts.set(doc.candidateId, (counts.get(doc.candidateId) ?? 0) + 1);
  return rows.map(candidate => ({
    ...candidate,
    cvCount: counts.get(candidate.id) ?? 0,
  }));
}

export async function getCandidate(candidateId: string, userId: number) {
  const db = await dbOrThrow();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.ownerId, userId),
        isNull(candidates.deletedAt)
      )
    )
    .limit(1);
  if (!candidate) return null;
  const [experience, cv] = await Promise.all([
    db
      .select()
      .from(candidateExperience)
      .where(eq(candidateExperience.candidateId, candidateId)),
    db
      .select()
      .from(cvDocuments)
      .where(
        and(
          eq(cvDocuments.candidateId, candidateId),
          isNull(cvDocuments.deletedAt)
        )
      )
      .orderBy(desc(cvDocuments.uploadedAt)),
  ]);
  return { ...candidate, experience, cvDocuments: cv };
}

export async function createCandidate(
  input: Record<string, unknown>,
  userId: number
) {
  if (input.consentGiven !== true || !input.consentAt)
    throw new Error(
      "Registra el consentimiento explícito de la persona y su fecha antes de guardar."
    );
  const db = await dbOrThrow();
  const candidateId = id();
  const data = {
    ownerId: userId,
    displayName: String(input.displayName ?? "")
      .trim()
      .slice(0, 180),
    communeName: input.communeName ? String(input.communeName) : null,
    regionCode: input.regionCode ? String(input.regionCode) : null,
    regionName: input.regionName ? String(input.regionName) : null,
    communeCode: input.communeCode ? String(input.communeCode) : null,
    willingToRelocate: Boolean(input.willingToRelocate),
    yearsExperience: Math.max(0, Number(input.yearsExperience ?? 0)),
    experienceYearsKnown:
      input.experienceYearsKnown == null
        ? Number(input.yearsExperience ?? 0) > 0
        : input.experienceYearsKnown === true,
    educationKnown: input.educationKnown === true,
    credentialsKnown: input.credentialsKnown === true,
    seniority: input.seniority ? String(input.seniority) : null,
    salaryTargetCLP: input.salaryTargetCLP
      ? Number(input.salaryTargetCLP)
      : null,
    salaryBasisPreference:
      (input.salaryBasisPreference as "gross" | "net" | "unknown") ?? "unknown",
    privateNotes: String(input.privateNotes ?? "").slice(0, 10_000) || null,
    consentGiven: true,
    consentAt: optionalDate(input.consentAt) ?? new Date(),
    deletedAt: null,
    ...Object.fromEntries(
      Object.entries(emptyCandidateFields).map(([key]) => [
        key,
        stringList(input[key]),
      ])
    ),
  } as typeof candidates.$inferInsert;
  if (!data.displayName) throw new Error("El nombre o alias es obligatorio.");
  await db.insert(candidates).values({ ...data, id: candidateId });
  await saveCandidateExperience(
    db,
    candidateId,
    Array.isArray(input.experience)
      ? (input.experience as Array<Record<string, unknown>>)
      : []
  );
  await syncCandidateSkills(
    db,
    candidateId,
    data.hardSkills,
    data.softSkills,
    data.languages,
    data.certifications
  );
  await addAudit(userId, "candidate.created", "candidate", candidateId);
  return { id: candidateId };
}

async function saveCandidateExperience(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  candidateId: string,
  rows: Array<Record<string, unknown>>
) {
  await db
    .delete(candidateExperience)
    .where(eq(candidateExperience.candidateId, candidateId));
  for (const row of rows.slice(0, 30)) {
    const role = String(row.role ?? "").trim();
    if (!role) continue;
    await db.insert(candidateExperience).values({
      id: id(),
      candidateId,
      companyName: String(row.companyName ?? "").trim() || null,
      role: role.slice(0, 180),
      startedAt: String(row.startedAt ?? "").slice(0, 24) || null,
      endedAt: String(row.endedAt ?? "").slice(0, 24) || null,
      achievements: String(row.achievements ?? "").slice(0, 3000) || null,
    });
  }
}

async function syncCandidateSkills(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  candidateId: string,
  hard: string[],
  soft: string[],
  languages: string[],
  certs: string[]
) {
  await db
    .delete(candidateSkills)
    .where(eq(candidateSkills.candidateId, candidateId));
  const rows = [
    ...hard.map(skillName => ({ skillName, skillType: "hard" as const })),
    ...soft.map(skillName => ({ skillName, skillType: "soft" as const })),
    ...languages.map(skillName => ({
      skillName,
      skillType: "language" as const,
    })),
    ...certs.map(skillName => ({
      skillName,
      skillType: "certification" as const,
    })),
  ];
  for (const row of rows.slice(0, 200))
    await db.insert(candidateSkills).values({
      id: id(),
      candidateId,
      ...row,
      normalizedSkill: normalizeText(row.skillName),
    });
}

export async function updateCandidate(
  candidateId: string,
  patch: Record<string, unknown>,
  userId: number
) {
  const db = await dbOrThrow();
  const current = await getCandidate(candidateId, userId);
  if (!current) throw new Error("No se encontró el perfil.");
  if (patch.consentGiven === false)
    throw new Error(
      "El consentimiento fue revocado. Elimina el perfil o registra nuevamente el consentimiento para volver a usarlo."
    );
  const fields = [
    "displayName",
    "communeName",
    "regionsAvailable",
    "regionCode",
    "regionName",
    "communeCode",
    "willingToRelocate",
    "yearsExperience",
    "experienceYearsKnown",
    "educationKnown",
    "credentialsKnown",
    "preferredTitles",
    "compatibleTitles",
    "sectors",
    "education",
    "certifications",
    "licenses",
    "hardSkills",
    "softSkills",
    "languages",
    "seniority",
    "acceptedModalities",
    "acceptedSchedules",
    "preferredContracts",
    "salaryTargetCLP",
    "salaryBasisPreference",
    "privateNotes",
  ];
  const data: Record<string, unknown> = {};
  for (const field of fields)
    if (patch[field] !== undefined) data[field] = patch[field];
  if (patch.displayName !== undefined)
    data.displayName = String(patch.displayName).trim().slice(0, 180);
  if (patch.privateNotes !== undefined)
    data.privateNotes = String(patch.privateNotes).slice(0, 10_000) || null;
  if (patch.consentAt) data.consentAt = optionalDate(patch.consentAt);
  await db
    .update(candidates)
    .set(data as Partial<typeof candidates.$inferInsert>)
    .where(and(eq(candidates.id, candidateId), eq(candidates.ownerId, userId)));
  if (Array.isArray(patch.experience))
    await saveCandidateExperience(
      db,
      candidateId,
      patch.experience as Array<Record<string, unknown>>
    );
  if (
    ["hardSkills", "softSkills", "languages", "certifications"].some(
      key => patch[key] !== undefined
    )
  ) {
    const next = { ...current, ...patch };
    await syncCandidateSkills(
      db,
      candidateId,
      stringList(next.hardSkills),
      stringList(next.softSkills),
      stringList(next.languages),
      stringList(next.certifications)
    );
  }
  await addAudit(userId, "candidate.updated", "candidate", candidateId);
  return { success: true };
}

export async function deleteCandidate(candidateId: string, userId: number) {
  const db = await dbOrThrow();
  const current = await getCandidate(candidateId, userId);
  if (!current) return { success: true };
  await db.transaction(async tx => {
    await tx
      .delete(cvDocuments)
      .where(eq(cvDocuments.candidateId, candidateId));
    await tx
      .delete(candidateExperience)
      .where(eq(candidateExperience.candidateId, candidateId));
    await tx
      .delete(candidateSkills)
      .where(eq(candidateSkills.candidateId, candidateId));
    await tx
      .delete(candidateJobMatches)
      .where(eq(candidateJobMatches.candidateId, candidateId));
    await tx
      .delete(candidates)
      .where(
        and(eq(candidates.id, candidateId), eq(candidates.ownerId, userId))
      );
  });
  await addAudit(userId, "candidate.deleted", "candidate", candidateId);
  return { success: true };
}

export async function uploadCandidateCv(
  candidateId: string,
  userId: number,
  input: { fileName: string; mimeType: string; base64: string }
) {
  const candidate = await getCandidate(candidateId, userId);
  if (!candidate) throw new Error("No se encontró el perfil.");
  if (!candidate.consentGiven)
    throw new Error("El perfil no tiene consentimiento vigente.");
  // eslint-disable-next-line no-control-regex -- elimina separadores de ruta y controles antes de guardar metadatos.
  const fileName = input.fileName.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 255);
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "docx")
    throw new Error("El CV debe estar en formato PDF o DOCX.");
  if (input.base64.length > 11_200_000)
    throw new Error("El archivo supera el límite de 8 MB.");
  const buffer = Buffer.from(input.base64, "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024)
    throw new Error("El archivo supera el límite de 8 MB o está vacío.");
  const isPdf =
    extension === "pdf" && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isDocx =
    extension === "docx" && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isPdf && !isDocx)
    throw new Error(
      "El contenido del archivo no coincide con el tipo declarado."
    );
  let extractedText: string;
  try {
    if (isPdf) {
      const parsed = await pdfParse(buffer, { max: 200 });
      extractedText = String(parsed.text ?? "")
        .replace(/\0/g, "")
        .trim()
        .slice(0, 120_000);
    } else {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = String(result.value ?? "")
        .replace(/\0/g, "")
        .trim()
        .slice(0, 120_000);
    }
  } catch {
    extractedText = "";
  }
  const db = await dbOrThrow();
  const documentId = id();
  const extractionStatus =
    extractedText.length > 20 ? "text_extracted" : "manual_review";
  await db.insert(cvDocuments).values({
    id: documentId,
    candidateId,
    fileName,
    mimeType: isPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: buffer.length,
    extractedText: extractedText || null,
    extractionStatus,
    deletedAt: null,
  });
  await addAudit(userId, "candidate.cv_added", "cv_document", documentId);
  return {
    id: documentId,
    fileName,
    sizeBytes: buffer.length,
    extractionStatus,
    extractedText,
    message:
      extractionStatus === "manual_review"
        ? "El archivo no contiene texto legible. Revisa el documento o completa el perfil manualmente; no se aplicó OCR."
        : "Texto extraído para revisión privada.",
  };
}

export async function deleteCandidateCv(
  candidateId: string,
  documentId: string,
  userId: number
) {
  const db = await dbOrThrow();
  const candidate = await getCandidate(candidateId, userId);
  if (!candidate) throw new Error("No se encontró el perfil.");
  await db
    .delete(cvDocuments)
    .where(
      and(
        eq(cvDocuments.id, documentId),
        eq(cvDocuments.candidateId, candidateId)
      )
    );
  await addAudit(userId, "candidate.cv_deleted", "cv_document", documentId);
  return { success: true };
}

type CandidateRecord = NonNullable<Awaited<ReturnType<typeof getCandidate>>>;

function candidateForScoring(candidate: CandidateRecord): MatchCandidate {
  return {
    preferredTitles: candidate.preferredTitles,
    compatibleTitles: candidate.compatibleTitles,
    sectors: candidate.sectors,
    yearsExperience: candidate.yearsExperience,
    experienceYearsKnown: candidate.experienceYearsKnown,
    educationKnown: candidate.educationKnown,
    credentialsKnown: candidate.credentialsKnown,
    experience: candidate.experience,
    education: candidate.education,
    certifications: candidate.certifications,
    licenses: candidate.licenses,
    hardSkills: candidate.hardSkills,
    softSkills: candidate.softSkills,
    languages: candidate.languages,
    acceptedModalities:
      candidate.acceptedModalities as MatchCandidate["acceptedModalities"],
    acceptedSchedules: candidate.acceptedSchedules,
    preferredContracts: candidate.preferredContracts,
    regionsAvailable: candidate.regionsAvailable,
    communeName: candidate.communeName,
    willingToRelocate: candidate.willingToRelocate,
    salaryTargetCLP: candidate.salaryTargetCLP,
    salaryBasisPreference: candidate.salaryBasisPreference,
  };
}

export async function candidateMatches(
  candidateId: string,
  userId: number,
  filters: JobFilters = {}
) {
  const db = await dbOrThrow();
  const candidate = await getCandidate(candidateId, userId);
  if (!candidate || !candidate.consentGiven)
    throw new Error("El perfil no existe o no tiene consentimiento vigente.");
  const allJobs = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.active, true), eq(jobs.countryCode, "CL")));
  const weightsRow = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "matchWeights"))
    .limit(1);
  const weights = {
    ...DEFAULT_MATCH_WEIGHTS,
    ...(weightsRow[0]?.value ?? {}),
  } as typeof DEFAULT_MATCH_WEIGHTS;
  const query: JobFilters = {
    ...filters,
    page: 1,
    pageSize: 5000,
    modalities: filters.modalities?.length
      ? filters.modalities
      : (candidate.acceptedModalities as MatchCandidate["acceptedModalities"]),
    includeUnknownModality: false,
  };
  const filtered = filterJobs(allJobs.map(jobForUi), query);
  const matches = filtered.map(job => ({
    job,
    explanation: scoreMatch(candidateForScoring(candidate), job, weights),
  }));
  matches.sort(
    (a, b) =>
      Number(b.explanation.isEligible) - Number(a.explanation.isEligible) ||
      b.explanation.score - a.explanation.score
  );
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 20));
  const page = Math.max(1, filters.page ?? 1);
  const pageItems = matches.slice((page - 1) * pageSize, page * pageSize);
  for (const match of pageItems) {
    const [previous] = await db
      .select()
      .from(candidateJobMatches)
      .where(
        and(
          eq(candidateJobMatches.candidateId, candidateId),
          eq(candidateJobMatches.jobId, match.job.id)
        )
      )
      .limit(1);
    if (previous)
      await db
        .update(candidateJobMatches)
        .set({
          score: match.explanation.score,
          isEligible: match.explanation.isEligible,
          explanation: match.explanation,
          calculatedAt: new Date(),
        })
        .where(eq(candidateJobMatches.id, previous.id));
    else
      await db.insert(candidateJobMatches).values({
        id: id(),
        candidateId,
        jobId: match.job.id,
        score: match.explanation.score,
        isEligible: match.explanation.isEligible,
        explanation: match.explanation,
      });
  }
  return { items: pageItems, total: matches.length, page, pageSize, weights };
}

export async function getMatchWeights() {
  const db = await dbOrThrow();
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "matchWeights"))
    .limit(1);
  return { ...DEFAULT_MATCH_WEIGHTS, ...(row?.value ?? {}) };
}

export async function setMatchWeights(
  weights: typeof DEFAULT_MATCH_WEIGHTS,
  userId: number
) {
  if (
    Object.values(weights).some(
      value => !Number.isInteger(value) || value < 0
    ) ||
    Object.values(weights).reduce((a, b) => a + b, 0) !== 100
  )
    throw new Error("Los pesos deben ser enteros no negativos y sumar 100.");
  const db = await dbOrThrow();
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "matchWeights"))
    .limit(1);
  if (row)
    await db
      .update(appSettings)
      .set({ value: weights })
      .where(eq(appSettings.key, "matchWeights"));
  else
    await db
      .insert(appSettings)
      .values({ key: "matchWeights", value: weights });
  await addAudit(
    userId,
    "settings.match_weights_updated",
    "app_setting",
    "matchWeights"
  );
  return weights;
}

const SOURCE_ALIASES: Record<string, string> = {
  trabajando: "trabajando_cl",
  laborum: "laborum_cl",
  computrabajo: "computrabajo_cl",
  "get on board": "getonbrd_cl",
  "getonboard": "getonbrd_cl",
};

const normalizeSourceCode = (value: unknown) => {
  const normalized = normalizeText(String(value ?? "manual"));
  const alias = SOURCE_ALIASES[normalized];
  if (alias) return alias;
  return SOURCE_CATALOG.find(
    source =>
      normalizeText(source.id) === normalized ||
      normalizeText(source.label) === normalized
  )?.id ?? "other";
};

export async function listSources() {
  const db = await dbOrThrow();
  const rows = await db
    .select({
      sourceCode: jobSourceOccurrences.sourceCode,
      occurrenceCount: count(),
      lastSeenAt: max(jobSourceOccurrences.capturedAt),
    })
    .from(jobSourceOccurrences)
    .groupBy(jobSourceOccurrences.sourceCode);
  const occurrencesBySource = new Map(
    rows.map(row => [row.sourceCode, row])
  );
  return SOURCE_CATALOG.map(source => {
    const occurrence = occurrencesBySource.get(source.id);
    const countOccurrences =
      source.category === "reference_data" ? 0 : Number(occurrence?.occurrenceCount ?? 0);
    return {
      ...source,
      referenceUrl: source.referenceUrl ?? null,
      status: source.sourceStatus,
      active: source.sourceStatus === "available",
      occurrenceCount: countOccurrences,
      lastSeenAt:
        source.category === "reference_data" ? null : (occurrence?.lastSeenAt ?? null),
      lastRunAt: null,
      lastVerifiedAt: null,
      lastSuccessfulSync: null,
      syncEnabled: false as const,
    };
  });
}

export async function getSourceStatus(sourceId: string) {
  const source = (await listSources()).find(item => item.id === sourceId);
  if (!source) return null;
  return {
    ...source,
    syncEnabled: false,
    healthCheck: {
      connected: false,
      checkedAt: null,
      message:
        source.accessMode === "manual_only"
          ? "Carga manual interna disponible; no hay conector externo ni sincronización."
          : source.sourceKind === "reference_data" && source.sourceStatus === "available"
            ? "Catálogo territorial local disponible; no se consulta la API en esta fase."
            : "Fuente registrada; conector no conectado y ninguna consulta externa ejecutada.",
    },
  };
}

export async function listAtsCompanyBoards() {
  const db = await dbOrThrow();
  return db
    .select()
    .from(atsCompanyBoards)
    .orderBy(desc(atsCompanyBoards.updatedAt))
    .limit(500);
}

export async function saveAtsCompanyBoard(
  input: Record<string, unknown>,
  userId: number
) {
  const db = await dbOrThrow();
  const companyName = String(input.companyName ?? "").trim().slice(0, 255);
  const provider = String(input.provider ?? "");
  const boardId = String(input.boardId ?? "").trim().slice(0, 255);
  if (!companyName) throw new Error("El nombre de la empresa es obligatorio.");
  if (!SOURCE_CATALOG.some(source => source.id === provider && source.category === "ats"))
    throw new Error("Selecciona un proveedor ATS del catálogo.");
  if (!/^[A-Za-z0-9._-]{1,255}$/.test(boardId))
    throw new Error("El ID de board/sitio solo admite letras, números, punto, guion y guion bajo.");
  if (input.countryCode != null && String(input.countryCode).toUpperCase() !== "CL")
    throw new Error("Solo se pueden registrar boards de oportunidades en Chile.");
  const physicalLocationSummary = String(input.physicalLocationSummary ?? "")
    .trim()
    .slice(0, 255) || null;
  const workplaceEvidence = String(input.workplaceEvidence ?? "")
    .trim()
    .slice(0, 2_000) || null;
  const verified = input.chilePhysicalSiteVerified === true;
  if (verified && (!physicalLocationSummary || !workplaceEvidence || workplaceEvidence.length < 10))
    throw new Error("Para verificar una sede física chilena registra ubicación y evidencia comprobable.");
  const verificationStatus: "verified" | "pending" = verified
    ? "verified"
    : "pending";
  const [sameBoard] = await db
    .select()
    .from(atsCompanyBoards)
    .where(and(eq(atsCompanyBoards.provider, provider), eq(atsCompanyBoards.boardId, boardId)))
    .limit(1);
  const suppliedId = String(input.id ?? "").trim();
  const existing = suppliedId
    ? (await db.select().from(atsCompanyBoards).where(eq(atsCompanyBoards.id, suppliedId)).limit(1))[0]
    : sameBoard;
  if (suppliedId && !existing) throw new Error("No se encontró el board indicado.");
  if (sameBoard && existing && sameBoard.id !== existing.id)
    throw new Error("Ese proveedor y board ya están registrados para otra empresa.");
  const boardRecord = {
    companyId: input.companyId ? String(input.companyId).slice(0, 32) : null,
    companyName,
    provider,
    boardId,
    countryCode: "CL" as const,
    physicalLocationSummary,
    chilePhysicalSiteVerified: verified,
    workplaceEvidence,
    verificationStatus:
      input.active === false ? ("inactive" as const) : verificationStatus,
    connectionStatus: "not_connected" as const,
    active: input.active !== false,
    verifiedAt: verified ? new Date() : null,
  };
  const boardRecordId = existing?.id ?? id();
  if (existing)
    await db.update(atsCompanyBoards).set(boardRecord).where(eq(atsCompanyBoards.id, existing.id));
  else
    await db.insert(atsCompanyBoards).values({
      id: boardRecordId,
      createdBy: userId,
      ...boardRecord,
    });
  await addAudit(
    userId,
    existing ? "ats.board_updated" : "ats.board_registered",
    "ats_company_board",
    boardRecordId
  );
  return { id: boardRecordId, connectionStatus: "not_connected" as const };
}

export async function listImportBatches(userId: number) {
  const db = await dbOrThrow();
  return db
    .select()
    .from(importBatches)
    .where(eq(importBatches.userId, userId))
    .orderBy(desc(importBatches.createdAt))
    .limit(100);
}

export async function importPreview(rows: Record<string, unknown>[]) {
  const db = await dbOrThrow();
  const result = [] as Array<{
    rowNumber: number;
    status: "new" | "duplicate" | "error";
    message: string | null;
    title: string | null;
    companyName: string | null;
    row: Record<string, unknown>;
  }>;
  for (const [index, row] of rows.slice(0, 2000).entries()) {
    const title = String(row.title ?? row.cargo ?? row.position ?? "").trim();
    const companyName = String(
      row.companyName ?? row.empresa ?? row.company ?? ""
    ).trim();
    const countryValue =
      [row.countryCode, row.country, row.pais].find(
        value => value != null && String(value).trim()
      ) ?? "";
    const rawRegion = row.regionCode ?? row.regionName ?? row.region;
    const rawCommune = row.communeCode ?? row.communeName ?? row.comuna;
    const verifiedRegion = rawRegion ? findRegion(String(rawRegion)) : null;
    const verifiedCommune = rawCommune
      ? findCommune(String(rawCommune), verifiedRegion?.code)
      : null;
    const hasVerifiedChileLocation = Boolean(verifiedRegion || verifiedCommune);
    const country = normalizeImportedCountry(
      countryValue,
      hasVerifiedChileLocation
    );
    const rawUrl = row.canonicalUrl ?? row.url ?? row.urlOriginal;
    const canonicalUrl = safeExternalUrl(rawUrl);
    const rawPublished = row.publishedAt ?? row.fechaPublicacion;
    const rawExpires = row.expiresAt ?? row.fechaCierre;
    const sourceCode = normalizeSourceCode(
      row.sourceCode ??
        row.fuenteCodigo ??
        row.sourceName ??
        row.fuente ??
        (Array.isArray(row.sourceCodes) ? row.sourceCodes[0] : row.sourceCodes) ??
        "manual"
    );
    const sourceEntry = SOURCE_CATALOG.find(source => source.id === sourceCode);
    let message: string | null = null;
    if (!title) message = "Falta el cargo.";
    else if (title.length > 255)
      message = "El cargo supera los 255 caracteres.";
    else if (companyName.length > 255)
      message = "El nombre de empresa supera los 255 caracteres.";
    else if (!country)
      message =
        "Indica el país o una comuna/región válida de Chile; el país no se asume automáticamente.";
    else if (country !== "CL")
      message = "El lugar de trabajo no corresponde a Chile.";
    else if (sourceEntry?.category === "reference_data")
      message = "Esta fuente es un catálogo de referencia, no una oferta laboral postulable.";
    else if (JSON.stringify(row).length > 100_000)
      message = "La fila supera el máximo de 100 KB.";
    else if (rawUrl != null && String(rawUrl).trim() && !canonicalUrl)
      message = "La URL original debe ser HTTP(S) y no contener credenciales.";
    else if (rawPublished != null && !optionalDate(rawPublished))
      message = "La fecha de publicación no es válida; usa una fecha ISO.";
    else if (rawExpires != null && !optionalDate(rawExpires))
      message = "La fecha de cierre no es válida; usa una fecha ISO.";
    else if (
      (row.sourceObservedAt != null && !optionalDate(row.sourceObservedAt)) ||
      (row.recordUpdatedAt != null && !optionalDate(row.recordUpdatedAt))
    )
      message = "La fecha observada/actualizada no es válida; usa una fecha ISO.";
    else if (row.applicationUrl && !safeExternalUrl(row.applicationUrl))
      message = "La URL de postulación debe ser HTTP(S) y no contener credenciales.";
    else if (
      stringList(row.allSourceUrls).some(url => !safeExternalUrl(url))
    )
      message = "Todas las URLs alternativas deben ser HTTP(S) y no contener credenciales.";
    else if (rawRegion && !findRegion(String(rawRegion)))
      message = "La región no coincide con el catálogo chileno de regiones.";
    else if (
      rawCommune &&
      !findCommune(
        String(rawCommune),
        rawRegion ? findRegion(String(rawRegion))?.code : undefined
      )
    )
      message = "La comuna no coincide con la región del catálogo chileno.";
    else {
      try {
        const min = parseCLPAmount(
          row.salaryMinCLP ?? row.sueldoMinCLP ?? row.sueldoMinimo
        );
        const max = parseCLPAmount(
          row.salaryMaxCLP ?? row.sueldoMaxCLP ?? row.sueldoMaximo
        );
        optionalNumber(
          row.experienceMinYears ?? row.experienciaMinima,
          "La experiencia"
        );
        const experience = optionalNumber(
          row.experienceMinYears ?? row.experienciaMinima,
          "La experiencia"
        );
        if (experience != null && experience > 60)
          message = "La experiencia mínima no puede superar los 60 años.";
        const weeklyHours = optionalNumber(row.hoursPerWeek, "Las horas semanales");
        if (weeklyHours != null && weeklyHours > 168)
          message = "Las horas semanales no pueden superar 168.";
        const vacancyCount = optionalNumber(row.vacancyCount, "La cantidad de vacantes");
        if (vacancyCount != null && vacancyCount > 100_000)
          message = "La cantidad de vacantes excede el límite de importación.";
        for (const [value, label] of [
          [row.geoConfidence, "La confianza geográfica"],
          [row.availabilityConfidence, "La confianza de disponibilidad"],
          [row.dataCompleteness, "La completitud"],
        ] as const) {
          const percent = optionalPercent(value, label);
          if (percent != null && (percent < 0 || percent > 100))
            throw new Error(`${label} debe estar entre 0 y 100.`);
        }
        const canonicalSalary =
          row.salaryMinCLP ??
          row.salaryMaxCLP ??
          row.sueldoMinCLP ??
          row.sueldoMaxCLP;
        const salaryCurrency = String(
          row.salaryCurrency ?? (canonicalSalary != null ? "CLP" : "")
        ).toUpperCase();
        const salaryPeriod = normalizeText(
          String(
            row.salaryPeriod ??
              row.periodoSueldo ??
              (canonicalSalary != null ? "monthly" : "unknown")
          )
        );
        const isMonthly = ["monthly", "mensual", "mes"].includes(salaryPeriod);
        if (
          canonicalSalary != null &&
          (!isMonthly || (salaryCurrency && salaryCurrency !== "CLP"))
        )
          message =
            "Solo los campos de sueldo mensuales en CLP alimentan filtros; conserva otros montos en sus campos fuente sin convertirlos.";
        const sourceMin = optionalSourceAmount(row.salaryMinSource, "El sueldo mínimo fuente");
        const sourceMax = optionalSourceAmount(row.salaryMaxSource, "El sueldo máximo fuente");
        const salaryComponents = parseJsonValue(row.salaryComponents);
        if (salaryComponents != null && !Array.isArray(salaryComponents))
          throw new Error("Los componentes del sueldo deben ser una lista JSON.");
        const componentHasAmount = (Array.isArray(salaryComponents) ? salaryComponents : []).some(component => {
          if (!component || typeof component !== "object" || Array.isArray(component))
            return false;
          const amount = (component as Record<string, unknown>).amount;
          return amount != null && String(amount).trim() !== "";
        });
        const hasSalaryAmount =
          min != null ||
          max != null ||
          sourceMin != null ||
          sourceMax != null ||
          componentHasAmount;
        const salaryVisibility = classifySalaryVisibility({
          visibility: row.salaryVisibility,
          rawText: row.salaryRaw,
          hasAmount: hasSalaryAmount,
          isDisclosedFlag: row.salaryIsDisclosed === true,
        });
        if (
          !message &&
          (salaryVisibility === "reserved" ||
            salaryVisibility === "not_disclosed") &&
          hasSalaryAmount
        )
          message = "Un sueldo reservado/no publicado no puede incluir importes ni componentes numéricos.";
        if (!message && sourceMin != null && sourceMax != null && Number(sourceMin) > Number(sourceMax))
          message = "El rango del sueldo fuente no puede tener mínimo superior al máximo.";
        for (const key of ["sourceEvidence", "geoEvidence", "workplaceEvidence", "salaryEvidence"]) {
          if (row[key] == null || row[key] === "") continue;
          const parsed = parseJsonValue(row[key]);
          if (key === "sourceEvidence" && (!parsed || typeof parsed !== "object" || Array.isArray(parsed)))
            throw new Error("La evidencia por campo debe ser un objeto JSON.");
          if (key !== "sourceEvidence" && parsed != null && typeof parsed !== "string" && (typeof parsed !== "object" || Array.isArray(parsed)))
            throw new Error(`${key} debe ser un objeto JSON o una nota breve.`);
        }
        if (min != null && max != null && min > max)
          message = "El sueldo mínimo no puede superar al sueldo máximo.";
      } catch (error) {
        message =
          error instanceof Error
            ? error.message
            : "Hay un sueldo o requisito numérico inválido.";
      }
    }
    if (message) {
      result.push({
        rowNumber: index + 1,
        status: "error",
        message,
        title: title || null,
        companyName: companyName || null,
        row,
      });
      continue;
    }

    const normalizedTitle = title;
    const normalizedCompany = companyName || "Empresa confidencial";
    const region = rawRegion ? findRegion(String(rawRegion)) : null;
    const commune = rawCommune
      ? findCommune(String(rawCommune), region?.code)
      : null;
    const externalId = stringList(
      row.sourceExternalIds ??
        row.sourceExternalId ??
        row.externalId ??
        row.idExterno
    )[0];
    const fingerprint = hashJobFingerprint({
      title: normalizedTitle,
      companyName: normalizedCompany,
      regionName: region?.name ?? "",
      communeName: commune?.communeName ?? "",
      publishedAt: optionalDate(rawPublished),
    });
    const jobConditions = [
      canonicalUrl ? eq(jobs.canonicalUrl, canonicalUrl) : undefined,
      eq(jobs.fingerprint, fingerprint),
    ].filter((condition): condition is NonNullable<typeof condition> =>
      Boolean(condition)
    );
    const [jobMatch] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(or(...jobConditions))
      .limit(1);
    const [externalMatch] = externalId
      ? await db
          .select({ jobId: jobSourceOccurrences.jobId })
          .from(jobSourceOccurrences)
          .where(
            and(
              eq(jobSourceOccurrences.sourceCode, sourceCode),
              eq(jobSourceOccurrences.sourceExternalId, externalId)
            )
          )
          .limit(1)
      : [];
    const duplicate =
      jobMatch ?? (externalMatch ? { id: externalMatch.jobId } : undefined);
    result.push({
      rowNumber: index + 1,
      status: duplicate ? "duplicate" : "new",
      message: duplicate
        ? "Coincide por URL, ID externo o huella; se conservará la identidad y procedencia."
        : null,
      title,
      companyName: companyName || null,
      row,
    });
  }
  return result;
}

export async function commitImport(
  rows: Record<string, unknown>[],
  fileName: string,
  format: "csv" | "json",
  userId: number
) {
  const db = await dbOrThrow();
  const preview = await importPreview(rows);
  const batchId = id();
  let importedCount = 0,
    duplicateCount = 0,
    errorCount = 0;
  await db.insert(importBatches).values({
    id: batchId,
    userId,
    fileName: fileName.slice(0, 255),
    format,
    rowCount: preview.length,
    importedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
  });
  for (const item of preview) {
    if (item.status === "error") {
      errorCount++;
      await db.insert(importRows).values({
        id: id(),
        batchId,
        rowNumber: item.rowNumber,
        status: "error",
        message: item.message,
        jobId: null,
        rawRow: item.row,
      });
      continue;
    }
    const row = item.row;
    const normalized = {
      ...row,
      title: row.title ?? row.cargo ?? row.position,
      countryCode:
        String(
          [row.countryCode, row.country, row.pais].find(
            value => value != null && String(value).trim()
          ) ?? ""
        ).trim() || "CL",
      companyName:
        row.companyName ?? row.empresa ?? row.company ?? "Empresa confidencial",
      regionName: row.regionName ?? row.region,
      communeName: row.communeName ?? row.comuna,
      canonicalUrl: row.canonicalUrl ?? row.url ?? row.urlOriginal,
      description: row.description ?? row.descripcion,
      modality:
        (row.modality ?? row.modalidad) == null
          ? undefined
          : normalizeModality(row.modality ?? row.modalidad),
      category: row.category ?? row.area,
      sector: row.sector ?? row.sectorEconomico,
      publishedAt: row.publishedAt ?? row.fechaPublicacion,
      salaryMinCLP: parseCLPAmount(
        row.salaryMinCLP ?? row.sueldoMinCLP ?? row.sueldoMinimo
      ),
      salaryMaxCLP: parseCLPAmount(
        row.salaryMaxCLP ?? row.sueldoMaxCLP ?? row.sueldoMaximo
      ),
      salaryBasis: row.salaryBasis ?? row.baseSueldo,
      sourceExternalIds: stringList(
        row.sourceExternalIds ??
          row.sourceExternalId ??
          row.externalId ??
          row.idExterno
      ),
      sourceCodes: stringList(
        row.sourceCodes ?? row.fuenteCodigo ?? row.fuente ?? "manual"
      ).map(normalizeSourceCode),
      _preserveMissing: true,
    };
    try {
      const result = await db.transaction(async tx => {
        const saved = await upsertJob(
          normalized,
          userId,
          normalizeSourceCode(stringList(normalized.sourceCodes)[0] || "manual"),
          tx
        );
        await tx.insert(importRows).values({
          id: id(),
          batchId,
          rowNumber: item.rowNumber,
          status: saved.duplicate ? "duplicate" : "imported",
          message: saved.duplicate
            ? "Oferta deduplicada; se mantuvo el ID y sus favoritos."
            : null,
          jobId: saved.id,
          rawRow: item.row,
        });
        return saved;
      });
      if (result.duplicate) duplicateCount++;
      else importedCount++;
    } catch (error) {
      errorCount++;
      await db.insert(importRows).values({
        id: id(),
        batchId,
        rowNumber: item.rowNumber,
        status: "error",
        message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "No se pudo guardar la fila.",
        jobId: null,
        rawRow: item.row,
      });
    }
  }
  await db
    .update(importBatches)
    .set({ importedCount, duplicateCount, errorCount })
    .where(eq(importBatches.id, batchId));
  await addAudit(userId, "offers.imported", "import_batch", batchId);
  return {
    id: batchId,
    rowCount: preview.length,
    importedCount,
    duplicateCount,
    errorCount,
  };
}

export async function getImportErrors(batchId: string, userId: number) {
  const db = await dbOrThrow();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
    .limit(1);
  if (!batch) return [];
  return db
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, "error")))
    .orderBy(importRows.rowNumber);
}

export async function exportJobs() {
  const db = await dbOrThrow();
  const rows = await db.select().from(jobs).where(eq(jobs.countryCode, "CL"));
  return rows.map(jobForUi);
}
