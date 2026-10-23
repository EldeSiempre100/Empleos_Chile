export type Modality = "presencial" | "hibrida" | "remota" | "no_informada";
export type WorkplaceType = "on_site" | "hybrid" | "remote" | "unknown";
export type SalaryBasis = "gross" | "net" | "unknown";
export type SalaryVisibility = "disclosed" | "reserved" | "not_disclosed" | "unknown";
export type VerificationStatus = "vigente" | "por_verificar" | "vencido" | "archivado";
export type SortOrder = "recent" | "relevance" | "salary" | "closing";
export type EvidenceLevel = "explicit" | "parsed" | "inferred" | "unknown";
export type SourceKind = "public_api" | "open_web" | "import" | "reference_data";
export type SourceAccessMode = "public_api" | "scraper_pending" | "manual_only" | "reference_only";
export type SourceStatus = "available" | "pending" | "disconnected" | "not_connected";
export type SourceCategory = "job_portal" | "ats" | "manual" | "reference_data";
export type AtsProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "other_ats";

export type FieldEvidence = {
  level: EvidenceLevel;
  raw?: string;
  sourceCode?: string;
  observedAt?: string | Date;
};

export type SalaryComponent = {
  label: string;
  amount?: number | string;
  currency?: string;
  period?: string;
  basis?: SalaryBasis;
  evidence?: FieldEvidence;
};

export type SourceCapabilities = {
  canRead: boolean;
  hasStructuredSalary: boolean;
  hasPublishedAt: boolean;
  hasExpiryDate: boolean;
  hasWorkplaceType: boolean;
  hasFullDescription: boolean;
  supportsComuna: boolean;
  requiresCredential: boolean;
};

export type JobFilters = {
  q?: string;
  regions?: string[];
  communes?: string[];
  modalities?: Modality[];
  includeUnknownModality?: boolean;
  publishedWithinDays?: number;
  dateBasis?: "publication" | "verification";
  dateFrom?: string;
  dateTo?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryBasis?: SalaryBasis | "any";
  includeUndisclosedSalary?: boolean;
  categories?: string[];
  subcategories?: string[];
  seniorities?: string[];
  experience?: string[];
  education?: string[];
  schedules?: string[];
  contracts?: string[];
  companies?: string[];
  sources?: string[];
  sectors?: string[];
  statuses?: VerificationStatus[];
  withOriginalUrl?: boolean;
  onlySaved?: boolean;
  sort?: SortOrder;
  page?: number;
  pageSize?: number;
};

export type JobRecord = {
  id: string;
  title: string;
  originalTitle?: string | null;
  normalizedTitle?: string | null;
  companyName: string;
  companySector?: string | null;
  companyConfidential?: boolean;
  countryCode?: string;
  regionCode?: string | null;
  regionName?: string | null;
  communeCode?: string | null;
  communeName?: string | null;
  locality?: string | null;
  addressApprox?: string | null;
  cityRaw?: string | null;
  locationRaw?: string | null;
  officeLocation?: string | null;
  geoConfidence?: number | null;
  geoEvidence?: FieldEvidence | Record<string, unknown> | null;
  modality: Modality;
  workplaceType?: WorkplaceType;
  workplaceEvidence?: FieldEvidence | Record<string, unknown> | null;
  category?: string | null;
  subcategory?: string | null;
  sector?: string | null;
  inferredSector?: string | null;
  department?: string | null;
  team?: string | null;
  occupationCodeCiuo?: string | null;
  seniority?: string | null;
  inferredSeniority?: string | null;
  jobType?: string | null;
  employmentType?: string | null;
  contractType?: string | null;
  schedule?: string | null;
  scheduleType?: string | null;
  shift?: string | null;
  hoursPerWeek?: number | null;
  vacancyCount?: number | null;
  practiceType?: string | null;
  experienceMinYears?: number | null;
  experienceRaw?: string | null;
  educationLevel?: string | null;
  degreeNames?: string[] | null;
  salaryMinCLP?: number | null;
  salaryMaxCLP?: number | null;
  salaryMinSource?: number | string | null;
  salaryMaxSource?: number | string | null;
  salaryRaw?: string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string;
  salaryBasis?: SalaryBasis;
  salaryVisibility?: SalaryVisibility;
  salaryComponents?: SalaryComponent[] | null;
  salaryEvidence?: FieldEvidence | Record<string, unknown> | null;
  salaryIsDisclosed?: boolean;
  description: string;
  descriptionHtmlSanitized?: string | null;
  applicationUrl?: string | null;
  applicationMethod?: string | null;
  requiredDocuments?: string[] | null;
  recruitmentStages?: string[] | null;
  responsibilities?: string[];
  requirements?: string[];
  mandatoryRequirements?: string[];
  benefits?: string[];
  skills?: string[];
  skillsExplicit?: string[] | null;
  normalizedSkills?: string[] | null;
  licenses?: string[] | null;
  languages?: string[] | null;
  sourceEvidence?: Record<string, FieldEvidence> | null;
  sourceCodes?: string[];
  sourceExternalIds?: string[];
  allSourceUrls?: string[] | null;
  companyBoardId?: string | null;
  rawRecordHash?: string | null;
  sourceObservedAt?: string | Date | null;
  sourceStatus?: string | null;
  availabilityConfidence?: number | null;
  dataCompleteness?: number | null;
  recordUpdatedAt?: string | Date | null;
  searchIndex?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  firstSeenAt?: string | Date | null;
  lastSeenAt?: string | Date | null;
  lastVerifiedAt?: string | Date | null;
  verificationStatus?: VerificationStatus;
  active?: boolean;
};

export type JobListResult = {
  items: Array<JobRecord & { saved?: boolean; note?: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  facets: {
    regions: Array<{ value: string; count: number }>;
    categories: Array<{ value: string; count: number }>;
    subcategories: Array<{ value: string; count: number }>;
    seniorities: Array<{ value: string; count: number }>;
    schedules: Array<{ value: string; count: number }>;
    contracts: Array<{ value: string; count: number }>;
    companies: Array<{ value: string; count: number }>;
    sectors: Array<{ value: string; count: number }>;
    statuses: Array<{ value: VerificationStatus; count: number }>;
    sources: Array<{ value: string; count: number }>;
  };
};

export type CandidateProfile = {
  id: string;
  displayName: string;
  communeName?: string | null;
  regionCode?: string | null;
  regionName?: string | null;
  communeCode?: string | null;
  regionsAvailable: string[];
  willingToRelocate: boolean;
  preferredTitles: string[];
  compatibleTitles: string[];
  sectors: string[];
  yearsExperience: number;
  experienceYearsKnown?: boolean;
  education: string[];
  educationKnown?: boolean;
  certifications: string[];
  licenses: string[];
  credentialsKnown?: boolean;
  hardSkills: string[];
  softSkills: string[];
  languages: string[];
  seniority?: string | null;
  acceptedModalities: Modality[];
  acceptedSchedules: string[];
  preferredContracts: string[];
  salaryTargetCLP?: number | null;
  salaryBasisPreference: SalaryBasis;
  privateNotes?: string | null;
  consentGiven: boolean;
  consentAt?: string | Date | null;
  cvCount?: number;
  experience?: Array<{
    id: string;
    companyName?: string | null;
    role: string;
    startedAt?: string | null;
    endedAt?: string | null;
    achievements?: string | null;
  }>;
};

export type MatchFactor = {
  key: string;
  label: string;
  weight: number;
  score: number;
  evidence: string[];
  gaps: string[];
  insufficient: string[];
};

export type MatchExplanation = {
  score: number;
  isEligible: boolean;
  eligibilityStatus: "eligible" | "not_eligible" | "insufficient";
  factors: MatchFactor[];
  strengths: string[];
  gaps: string[];
  insufficient: string[];
  exclusions: string[];
};

export type SourceRegistryRecord = {
  id: string;
  label: string;
  category: SourceCategory;
  sourceKind: SourceKind;
  accessMode: SourceAccessMode;
  sourceStatus: SourceStatus;
  status: SourceStatus;
  adapterContract: string;
  notes: string;
  referenceUrl?: string | null;
  capabilities: SourceCapabilities;
  active: boolean;
  lastSuccessfulSync: string | Date | null;
  occurrenceCount: number;
  lastSeenAt: string | Date | null;
  lastRunAt: string | Date | null;
  lastVerifiedAt: string | Date | null;
  syncEnabled: false;
};

export type AtsCompanyBoard = {
  id: string;
  companyId?: string | null;
  companyName: string;
  provider: AtsProvider;
  boardId: string;
  countryCode: "CL";
  physicalLocationSummary?: string | null;
  chilePhysicalSiteVerified: boolean;
  workplaceEvidence?: string | null;
  verificationStatus: "pending" | "verified" | "inactive";
  connectionStatus: "not_connected" | "connected";
  active: boolean;
  verifiedAt?: string | Date | null;
  updatedAt?: string | Date;
};

export type JobSourceRecord = {
  sourceCode: string;
  sourceKind: SourceKind;
  externalId?: string;
  originalUrl?: string;
  capturedAt: string;
  rawFields: Record<string, unknown>;
  normalized: Partial<JobRecord>;
  evidence: Record<string, FieldEvidence>;
};

export type SourceAdapterContract<Raw = unknown, Normalized = JobRecord> = {
  sourceId: string;
  accessMode: SourceAccessMode;
  capabilities: SourceCapabilities;
  fetch(
    cursor?: string,
    filters?: Record<string, unknown>
  ): Promise<{ records: Raw[]; nextCursor?: string | null }>;
  normalize(raw: Raw): Normalized;
  validate(record: Normalized): { valid: boolean; errors: string[] };
  healthCheck(): Promise<{
    connected: boolean;
    checkedAt: string;
    message: string;
  }>;
  rateLimitPolicy: { requestsPerMinute: number; backoffMs: number };
  lastRunAt: string | null;
  lastSuccessfulSync: string | null;
  nextCursor: string | null;
  provenance: string;
};
