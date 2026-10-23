import {
  boolean,
  decimal,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { FieldEvidence, SalaryComponent } from "@shared/domain";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const companies = mysqlTable(
  "companies",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    canonicalName: varchar("canonicalName", { length: 255 }).notNull(),
    normalizedName: varchar("normalizedName", { length: 255 }).notNull(),
    confidential: boolean("confidential").default(false).notNull(),
    website: varchar("website", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("companies_normalized_name_idx").on(table.normalizedName)]
);

export const locations = mysqlTable(
  "locations",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    regionCode: varchar("regionCode", { length: 4 }).notNull(),
    regionName: varchar("regionName", { length: 100 }).notNull(),
    communeCode: varchar("communeCode", { length: 8 }).notNull(),
    communeName: varchar("communeName", { length: 100 }).notNull(),
  },
  table => [
    uniqueIndex("locations_region_commune_uq").on(
      table.regionCode,
      table.communeCode
    ),
    index("locations_region_commune_idx").on(
      table.regionCode,
      table.communeCode
    ),
    index("locations_commune_name_idx").on(table.communeName),
  ]
);

export const jobSources = mysqlTable(
  "job_sources",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    sourceCode: varchar("sourceCode", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    sourceUrl: varchar("sourceUrl", { length: 512 }),
    sourceKind: varchar("sourceKind", { length: 32 }).default("import").notNull(),
    accessMode: varchar("accessMode", { length: 32 }).default("manual_only").notNull(),
    capabilities: json("capabilities").$type<Record<string, boolean>>(),
    canRead: boolean("canRead").default(false).notNull(),
    hasStructuredSalary: boolean("hasStructuredSalary").default(false).notNull(),
    hasPublishedAt: boolean("hasPublishedAt").default(false).notNull(),
    hasExpiryDate: boolean("hasExpiryDate").default(false).notNull(),
    hasWorkplaceType: boolean("hasWorkplaceType").default(false).notNull(),
    hasFullDescription: boolean("hasFullDescription").default(false).notNull(),
    supportsComuna: boolean("supportsComuna").default(false).notNull(),
    requiresCredential: boolean("requiresCredential").default(false).notNull(),
    sourceStatus: mysqlEnum("sourceStatus", [
      "available",
      "pending",
      "disconnected",
      "not_connected",
    ])
      .default("not_connected")
      .notNull(),
    lastSuccessfulSync: timestamp("lastSuccessfulSync"),
    firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    active: boolean("active").default(true).notNull(),
  },
  table => [index("job_sources_code_idx").on(table.sourceCode)]
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    canonicalUrl: text("canonicalUrl"),
    sourceExternalIds: json("sourceExternalIds").$type<string[]>().notNull(),
    allSourceUrls: json("allSourceUrls").$type<string[]>(),
    companyId: varchar("companyId", { length: 32 }),
    title: varchar("title", { length: 255 }).notNull(),
    originalTitle: varchar("originalTitle", { length: 255 }),
    normalizedTitle: varchar("normalizedTitle", { length: 255 }),
    companyName: varchar("companyName", { length: 255 }).notNull(),
    companySector: varchar("companySector", { length: 160 }),
    companyConfidential: boolean("companyConfidential")
      .default(false)
      .notNull(),
    countryCode: varchar("countryCode", { length: 2 }).default("CL").notNull(),
    regionCode: varchar("regionCode", { length: 4 }),
    regionName: varchar("regionName", { length: 100 }),
    communeCode: varchar("communeCode", { length: 8 }),
    communeName: varchar("communeName", { length: 100 }),
    locality: varchar("locality", { length: 150 }),
    addressApprox: varchar("addressApprox", { length: 255 }),
    cityRaw: varchar("cityRaw", { length: 180 }),
    locationRaw: varchar("locationRaw", { length: 500 }),
    officeLocation: varchar("officeLocation", { length: 255 }),
    geoConfidence: int("geoConfidence"),
    geoEvidence: json("geoEvidence").$type<Record<string, unknown>>(),
    modality: mysqlEnum("modality", [
      "presencial",
      "hibrida",
      "remota",
      "no_informada",
    ])
      .default("no_informada")
      .notNull(),
    category: varchar("category", { length: 120 }),
    subcategory: varchar("subcategory", { length: 120 }),
    sector: varchar("sector", { length: 120 }),
    inferredSector: varchar("inferredSector", { length: 120 }),
    department: varchar("department", { length: 180 }),
    team: varchar("team", { length: 180 }),
    occupationCodeCiuo: varchar("occupationCodeCiuo", { length: 32 }),
    seniority: varchar("seniority", { length: 64 }),
    inferredSeniority: varchar("inferredSeniority", { length: 64 }),
    jobType: varchar("jobType", { length: 64 }),
    employmentType: varchar("employmentType", { length: 80 }),
    contractType: varchar("contractType", { length: 64 }),
    schedule: varchar("schedule", { length: 64 }),
    scheduleType: varchar("scheduleType", { length: 80 }),
    shift: varchar("shift", { length: 80 }),
    hoursPerWeek: int("hoursPerWeek"),
    vacancyCount: int("vacancyCount"),
    practiceType: varchar("practiceType", { length: 40 }),
    workplaceType: mysqlEnum("workplaceType", [
      "on_site",
      "hybrid",
      "remote",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    workplaceEvidence: json("workplaceEvidence").$type<Record<string, unknown>>(),
    experienceMinYears: int("experienceMinYears"),
    experienceRaw: text("experienceRaw"),
    educationLevel: varchar("educationLevel", { length: 100 }),
    degreeNames: json("degreeNames").$type<string[]>(),
    skillsExplicit: json("skillsExplicit").$type<string[]>(),
    licenses: json("licenses").$type<string[]>(),
    languages: json("languages").$type<string[]>(),
    salaryMinCLP: int("salaryMinCLP"),
    salaryMaxCLP: int("salaryMaxCLP"),
    salaryMinSource: decimal("salaryMinSource", { precision: 14, scale: 2 }),
    salaryMaxSource: decimal("salaryMaxSource", { precision: 14, scale: 2 }),
    salaryRaw: text("salaryRaw"),
    salaryCurrency: varchar("salaryCurrency", { length: 12 }),
    salaryPeriod: varchar("salaryPeriod", { length: 32 })
      .default("unknown")
      .notNull(),
    salaryBasis: mysqlEnum("salaryBasis", ["gross", "net", "unknown"])
      .default("unknown")
      .notNull(),
    salaryVisibility: mysqlEnum("salaryVisibility", [
      "disclosed",
      "reserved",
      "not_disclosed",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    salaryComponents: json("salaryComponents").$type<SalaryComponent[]>(),
    salaryEvidence: json("salaryEvidence").$type<Record<string, unknown>>(),
    salaryIsDisclosed: boolean("salaryIsDisclosed").default(false).notNull(),
    description: longtext("description").notNull(),
    descriptionHtmlSanitized: longtext("descriptionHtmlSanitized"),
    applicationUrl: text("applicationUrl"),
    applicationMethod: text("applicationMethod"),
    requiredDocuments: json("requiredDocuments").$type<string[]>(),
    recruitmentStages: json("recruitmentStages").$type<string[]>(),
    responsibilities: json("responsibilities").$type<string[]>().notNull(),
    requirements: json("requirements").$type<string[]>().notNull(),
    mandatoryRequirements: json("mandatoryRequirements")
      .$type<string[]>()
      .notNull(),
    benefits: json("benefits").$type<string[]>().notNull(),
    skills: json("skills").$type<string[]>().notNull(),
    normalizedSkills: json("normalizedSkills").$type<string[]>(),
    sourceEvidence: json("sourceEvidence").$type<Record<string, FieldEvidence>>(),
    sourceCodes: json("sourceCodes").$type<string[]>().notNull(),
    companyBoardId: varchar("companyBoardId", { length: 255 }),
    rawRecordHash: varchar("rawRecordHash", { length: 64 }),
    sourceObservedAt: timestamp("sourceObservedAt"),
    recordUpdatedAt: timestamp("recordUpdatedAt"),
    sourceStatus: varchar("sourceStatus", { length: 64 }),
    availabilityConfidence: int("availabilityConfidence"),
    dataCompleteness: int("dataCompleteness"),
    searchIndex: longtext("searchIndex"),
    publishedAt: timestamp("publishedAt"),
    expiresAt: timestamp("expiresAt"),
    firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    verificationStatus: mysqlEnum("verificationStatus", [
      "vigente",
      "por_verificar",
      "vencido",
      "archivado",
    ])
      .default("por_verificar")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("jobs_fingerprint_uq").on(table.fingerprint),
    index("jobs_location_idx").on(table.regionCode, table.communeCode),
    index("jobs_status_date_idx").on(
      table.verificationStatus,
      table.publishedAt
    ),
    index("jobs_category_idx").on(table.category),
    index("jobs_company_idx").on(table.companyName),
    index("jobs_occupation_code_idx").on(table.occupationCodeCiuo),
    index("jobs_board_idx").on(table.companyBoardId),
  ]
);

export const jobSourceOccurrences = mysqlTable(
  "job_source_occurrences",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    jobId: varchar("jobId", { length: 32 }).notNull(),
    sourceCode: varchar("sourceCode", { length: 64 }).notNull(),
    sourceExternalId: varchar("sourceExternalId", { length: 255 }),
    originalUrl: text("originalUrl"),
    capturedAt: timestamp("capturedAt").defaultNow().notNull(),
    verifiedAt: timestamp("verifiedAt"),
    provenance: text("provenance"),
    sourceKind: varchar("sourceKind", { length: 32 }).default("import").notNull(),
    rawRecordHash: varchar("rawRecordHash", { length: 64 }),
    sourceObservedAt: timestamp("sourceObservedAt"),
    rawFields: json("rawFields").$type<Record<string, unknown>>(),
    evidence: json("evidence").$type<Record<string, unknown>>(),
  },
  table => [
    index("occurrences_job_idx").on(table.jobId),
    index("occurrences_source_idx").on(table.sourceCode),
  ]
);

export const jobSkills = mysqlTable(
  "job_skills",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    jobId: varchar("jobId", { length: 32 }).notNull(),
    skillName: varchar("skillName", { length: 160 }).notNull(),
    normalizedSkill: varchar("normalizedSkill", { length: 160 }).notNull(),
  },
  table => [
    index("job_skills_job_idx").on(table.jobId),
    index("job_skills_name_idx").on(table.normalizedSkill),
  ]
);

export const candidates = mysqlTable(
  "candidates",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    displayName: varchar("displayName", { length: 180 }).notNull(),
    communeName: varchar("communeName", { length: 100 }),
    regionCode: varchar("regionCode", { length: 4 }),
    regionName: varchar("regionName", { length: 100 }),
    communeCode: varchar("communeCode", { length: 8 }),
    regionsAvailable: json("regionsAvailable").$type<string[]>().notNull(),
    willingToRelocate: boolean("willingToRelocate").default(false).notNull(),
    preferredTitles: json("preferredTitles").$type<string[]>().notNull(),
    compatibleTitles: json("compatibleTitles").$type<string[]>().notNull(),
    sectors: json("sectors").$type<string[]>().notNull(),
    yearsExperience: int("yearsExperience").default(0).notNull(),
    experienceYearsKnown: boolean("experienceYearsKnown").default(false).notNull(),
    education: json("education").$type<string[]>().notNull(),
    educationKnown: boolean("educationKnown").default(false).notNull(),
    certifications: json("certifications").$type<string[]>().notNull(),
    licenses: json("licenses").$type<string[]>().notNull(),
    credentialsKnown: boolean("credentialsKnown").default(false).notNull(),
    hardSkills: json("hardSkills").$type<string[]>().notNull(),
    softSkills: json("softSkills").$type<string[]>().notNull(),
    languages: json("languages").$type<string[]>().notNull(),
    seniority: varchar("seniority", { length: 64 }),
    acceptedModalities: json("acceptedModalities").$type<string[]>().notNull(),
    acceptedSchedules: json("acceptedSchedules").$type<string[]>().notNull(),
    preferredContracts: json("preferredContracts").$type<string[]>().notNull(),
    salaryTargetCLP: int("salaryTargetCLP"),
    salaryBasisPreference: mysqlEnum("salaryBasisPreference", [
      "gross",
      "net",
      "unknown",
    ])
      .default("unknown")
      .notNull(),
    privateNotes: text("privateNotes"),
    consentGiven: boolean("consentGiven").default(false).notNull(),
    consentAt: timestamp("consentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [
    index("candidates_owner_idx").on(table.ownerId),
    index("candidates_commune_idx").on(table.communeName),
  ]
);

export const candidateExperience = mysqlTable(
  "candidate_experience",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 32 }).notNull(),
    companyName: varchar("companyName", { length: 180 }),
    role: varchar("role", { length: 180 }).notNull(),
    startedAt: varchar("startedAt", { length: 24 }),
    endedAt: varchar("endedAt", { length: 24 }),
    achievements: text("achievements"),
  },
  table => [index("candidate_experience_candidate_idx").on(table.candidateId)]
);

export const candidateSkills = mysqlTable(
  "candidate_skills",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 32 }).notNull(),
    skillName: varchar("skillName", { length: 160 }).notNull(),
    normalizedSkill: varchar("normalizedSkill", { length: 160 }).notNull(),
    skillType: mysqlEnum("skillType", [
      "hard",
      "soft",
      "language",
      "certification",
    ]).notNull(),
  },
  table => [
    index("candidate_skills_candidate_idx").on(table.candidateId),
    index("candidate_skills_name_idx").on(table.normalizedSkill),
  ]
);

export const cvDocuments = mysqlTable(
  "cv_documents",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 32 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    extractedText: longtext("extractedText"),
    extractionStatus: mysqlEnum("extractionStatus", [
      "text_extracted",
      "manual_review",
      "failed",
    ]).notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("cv_documents_candidate_idx").on(table.candidateId)]
);

export const savedJobs = mysqlTable(
  "saved_jobs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    jobId: varchar("jobId", { length: 32 }).notNull(),
    tags: json("tags").$type<string[]>().notNull(),
    discardedAt: timestamp("discardedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("saved_jobs_user_job_uq").on(table.userId, table.jobId),
    index("saved_jobs_user_idx").on(table.userId),
  ]
);

export const jobNotes = mysqlTable(
  "job_notes",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    jobId: varchar("jobId", { length: 32 }).notNull(),
    note: text("note").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("job_notes_user_job_uq").on(table.userId, table.jobId)]
);

export const savedSearches = mysqlTable(
  "saved_searches",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    filters: json("filters").$type<Record<string, unknown>>().notNull(),
    resultCount: int("resultCount").default(0).notNull(),
    lastExecutedAt: timestamp("lastExecutedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("saved_searches_user_idx").on(table.userId)]
);

export const importBatches = mysqlTable("import_batches", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  format: mysqlEnum("format", ["csv", "json"]).notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  importedCount: int("importedCount").default(0).notNull(),
  duplicateCount: int("duplicateCount").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const importRows = mysqlTable(
  "import_rows",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    batchId: varchar("batchId", { length: 32 }).notNull(),
    rowNumber: int("rowNumber").notNull(),
    status: mysqlEnum("status", ["imported", "duplicate", "error"]).notNull(),
    message: text("message"),
    jobId: varchar("jobId", { length: 32 }),
    rawRow: json("rawRow").$type<Record<string, unknown>>(),
  },
  table => [index("import_rows_batch_idx").on(table.batchId)]
);

export const atsCompanyBoards = mysqlTable(
  "ats_company_boards",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    companyId: varchar("companyId", { length: 32 }),
    companyName: varchar("companyName", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    boardId: varchar("boardId", { length: 255 }).notNull(),
    countryCode: varchar("countryCode", { length: 2 }).default("CL").notNull(),
    physicalLocationSummary: varchar("physicalLocationSummary", { length: 255 }),
    chilePhysicalSiteVerified: boolean("chilePhysicalSiteVerified")
      .default(false)
      .notNull(),
    workplaceEvidence: text("workplaceEvidence"),
    verificationStatus: mysqlEnum("verificationStatus", [
      "pending",
      "verified",
      "inactive",
    ])
      .default("pending")
      .notNull(),
    connectionStatus: mysqlEnum("connectionStatus", ["not_connected", "connected"])
      .default("not_connected")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    verifiedAt: timestamp("verifiedAt"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("ats_board_provider_board_uq").on(table.provider, table.boardId),
    index("ats_board_company_idx").on(table.companyName),
    index("ats_board_provider_idx").on(table.provider),
  ]
);

export const sourceConnectors = mysqlTable("source_connectors", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  status: mysqlEnum("status", [
    "available",
    "pending",
    "disconnected",
    "not_connected",
  ])
    .default("not_connected")
    .notNull(),
  adapterContract: varchar("adapterContract", { length: 64 }).notNull(),
  sourceKind: varchar("sourceKind", { length: 32 }).default("open_web").notNull(),
  accessMode: varchar("accessMode", { length: 32 }).default("scraper_pending").notNull(),
  capabilities: json("capabilities").$type<Record<string, boolean>>(),
  canRead: boolean("canRead").default(false).notNull(),
  hasStructuredSalary: boolean("hasStructuredSalary").default(false).notNull(),
  hasPublishedAt: boolean("hasPublishedAt").default(false).notNull(),
  hasExpiryDate: boolean("hasExpiryDate").default(false).notNull(),
  hasWorkplaceType: boolean("hasWorkplaceType").default(false).notNull(),
  hasFullDescription: boolean("hasFullDescription").default(false).notNull(),
  supportsComuna: boolean("supportsComuna").default(false).notNull(),
  requiresCredential: boolean("requiresCredential").default(false).notNull(),
  sourceStatus: mysqlEnum("sourceStatus", [
    "available",
    "pending",
    "disconnected",
    "not_connected",
  ])
    .default("not_connected")
    .notNull(),
  lastRunAt: timestamp("lastRunAt"),
  lastSuccessfulSync: timestamp("lastSuccessfulSync"),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const candidateJobMatches = mysqlTable(
  "candidate_job_matches",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 32 }).notNull(),
    jobId: varchar("jobId", { length: 32 }).notNull(),
    score: int("score").notNull(),
    isEligible: boolean("isEligible").default(true).notNull(),
    explanation: json("explanation").$type<Record<string, unknown>>().notNull(),
    calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  },
  table => [
    index("candidate_matches_pair_idx").on(table.candidateId, table.jobId),
    index("candidate_matches_score_idx").on(table.candidateId, table.score),
  ]
);

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: json("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: varchar("entityId", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_user_created_idx").on(table.userId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;
