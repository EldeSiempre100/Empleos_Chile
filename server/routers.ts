import { COOKIE_NAME } from "@shared/const";
import type { JobFilters } from "@shared/domain";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  archiveJob,
  candidateMatches,
  commitImport,
  createCandidate,
  createSearch,
  deleteCandidate,
  deleteCandidateCv,
  deleteSearch,
  executeSearch,
  getCandidate,
  getFacets,
  getImportErrors,
  getJob,
  getMatchWeights,
  importPreview,
  exportJobs,
  getSourceStatus,
  listAdminJobs,
  listAtsCompanyBoards,
  listCandidates,
  listImportBatches,
  listJobs,
  listSavedJobs,
  listSearches,
  listSources,
  setJobNote,
  setMatchWeights,
  saveAtsCompanyBoard,
  toggleSavedJob,
  updateCandidate,
  updateJob,
  updateSavedJob,
  updateSearch,
  restoreJob,
  uploadCandidateCv,
  upsertJob,
} from "./employment-db";
import { correctCvText } from "./cv-review";

const modality = z.enum(["presencial", "hibrida", "remota", "no_informada"]);
const salaryBasis = z.enum(["gross", "net", "unknown"]);
const evidenceLevel = z.enum(["explicit", "parsed", "inferred", "unknown"]);
const fieldEvidence = z.object({
  level: evidenceLevel,
  raw: z.string().max(2_000).optional(),
  sourceCode: z.string().max(64).optional(),
  observedAt: z.union([z.string().max(40), z.date()]).optional(),
});
const evidenceMap = z
  .record(z.string().max(100), fieldEvidence)
  .refine(value => Object.keys(value).length <= 100);
const jsonMap = z
  .record(z.string().max(100), z.unknown())
  .refine(value => Object.keys(value).length <= 100);
const textList = (maxItems: number, maxLength: number) =>
  z.array(z.string().max(maxLength)).max(maxItems);
const jobFilters = z.object({
  q: z.string().max(200).optional(),
  regions: z.array(z.string().max(100)).max(16).optional(),
  communes: z.array(z.string().max(100)).max(346).optional(),
  modalities: z.array(modality).max(4).optional(),
  includeUnknownModality: z.boolean().optional(),
  publishedWithinDays: z.number().int().min(1).max(365).optional(),
  dateBasis: z.enum(["publication", "verification"]).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  salaryBasis: z.enum(["gross", "net", "unknown", "any"]).optional(),
  includeUndisclosedSalary: z.boolean().optional(),
  categories: z.array(z.string().max(120)).max(50).optional(),
  subcategories: z.array(z.string().max(120)).max(50).optional(),
  seniorities: z.array(z.string().max(64)).max(30).optional(),
  experience: z.array(z.string().max(30)).max(7).optional(),
  education: z.array(z.string().max(100)).max(10).optional(),
  schedules: z.array(z.string().max(64)).max(20).optional(),
  contracts: z.array(z.string().max(64)).max(20).optional(),
  companies: z.array(z.string().max(255)).max(100).optional(),
  sources: z.array(z.string().max(64)).max(50).optional(),
  sectors: z.array(z.string().max(120)).max(50).optional(),
  statuses: z
    .array(z.enum(["vigente", "por_verificar", "vencido", "archivado"]))
    .max(4)
    .optional(),
  withOriginalUrl: z.boolean().optional(),
  onlySaved: z.boolean().optional(),
  sort: z.enum(["recent", "relevance", "salary", "closing"]).optional(),
  page: z.number().int().min(1).max(10000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

const jobFields = z.object({
  title: z.string().trim().min(1).max(255),
  originalTitle: z.string().max(255).optional(),
  companyName: z.string().trim().max(255).optional(),
  companySector: z.string().max(160).optional(),
  companyWebsite: z.string().max(2048).optional(),
  companyConfidential: z.boolean().optional(),
  countryCode: z.string().length(2).optional(),
  regionCode: z.string().max(4).optional(),
  regionName: z.string().max(100).optional(),
  communeCode: z.string().max(8).optional(),
  communeName: z.string().max(100).optional(),
  locality: z.string().max(150).optional(),
  addressApprox: z.string().max(255).optional(),
  cityRaw: z.string().max(180).optional(),
  locationRaw: z.string().max(500).optional(),
  officeLocation: z.string().max(255).optional(),
  geoConfidence: z.number().int().min(0).max(100).nullable().optional(),
  geoEvidence: jsonMap.nullable().optional(),
  modality: modality.optional(),
  workplaceType: z.enum(["on_site", "hybrid", "remote", "unknown"]).optional(),
  workplaceEvidence: jsonMap.nullable().optional(),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  sector: z.string().max(120).optional(),
  inferredSector: z.string().max(120).optional(),
  department: z.string().max(180).optional(),
  team: z.string().max(180).optional(),
  occupationCodeCiuo: z.string().max(32).optional(),
  seniority: z.string().max(64).optional(),
  inferredSeniority: z.string().max(64).optional(),
  jobType: z.string().max(64).optional(),
  employmentType: z.string().max(80).optional(),
  contractType: z.string().max(64).optional(),
  schedule: z.string().max(64).optional(),
  scheduleType: z.string().max(80).optional(),
  shift: z.string().max(80).optional(),
  hoursPerWeek: z.number().int().min(0).max(168).nullable().optional(),
  vacancyCount: z.number().int().min(0).max(100_000).nullable().optional(),
  practiceType: z.string().max(40).optional(),
  experienceMinYears: z.number().int().min(0).max(60).nullable().optional(),
  experienceRaw: z.string().max(2_000).optional(),
  educationLevel: z.string().max(100).optional(),
  degreeNames: textList(100, 250).optional(),
  salaryMinCLP: z.number().int().min(0).nullable().optional(),
  salaryMaxCLP: z.number().int().min(0).nullable().optional(),
  salaryMinSource: z.union([z.number(), z.string().max(80)]).nullable().optional(),
  salaryMaxSource: z.union([z.number(), z.string().max(80)]).nullable().optional(),
  salaryRaw: z.string().max(2_000).optional(),
  salaryCurrency: z.string().max(12).optional(),
  salaryPeriod: z.string().max(32).optional(),
  salaryBasis: salaryBasis.optional(),
  salaryVisibility: z.enum(["disclosed", "reserved", "not_disclosed", "unknown"]).optional(),
  salaryComponents: z.array(z.record(z.string().max(100), z.unknown())).max(50).optional(),
  salaryEvidence: jsonMap.nullable().optional(),
  salaryIsDisclosed: z.boolean().optional(),
  description: z.string().max(120000).optional(),
  descriptionHtmlSanitized: z.string().max(120000).optional(),
  applicationUrl: z.string().max(2048).optional(),
  applicationMethod: z.string().max(255).optional(),
  requiredDocuments: textList(50, 250).optional(),
  recruitmentStages: textList(50, 250).optional(),
  responsibilities: z.array(z.string().max(2000)).max(50).optional(),
  requirements: z.array(z.string().max(2000)).max(100).optional(),
  mandatoryRequirements: z.array(z.string().max(500)).max(50).optional(),
  benefits: z.array(z.string().max(1000)).max(50).optional(),
  skills: z.array(z.string().max(160)).max(100).optional(),
  skillsExplicit: textList(100, 160).optional(),
  normalizedSkills: textList(100, 160).optional(),
  licenses: textList(50, 250).optional(),
  languages: textList(50, 100).optional(),
  sourceEvidence: evidenceMap.optional(),
  sourceObservedAt: z.union([z.string().max(40), z.date()]).nullable().optional(),
  recordUpdatedAt: z.union([z.string().max(40), z.date()]).nullable().optional(),
  sourceStatus: z.string().max(64).optional(),
  availabilityConfidence: z.number().int().min(0).max(100).nullable().optional(),
  dataCompleteness: z.number().int().min(0).max(100).nullable().optional(),
  sourceCodes: z.array(z.string().max(64)).max(20).optional(),
  sourceExternalIds: z.array(z.string().max(255)).max(50).optional(),
  allSourceUrls: z.array(z.string().max(2048)).max(100).optional(),
  companyBoardId: z.string().max(255).optional(),
  canonicalUrl: z.string().max(2048).nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  lastVerifiedAt: z.string().datetime().nullable().optional(),
  verificationStatus: z
    .enum(["vigente", "por_verificar", "vencido", "archivado"])
    .optional(),
  active: z.boolean().optional(),
  provenance: z.string().max(2000).optional(),
});

const candidateFields = z.object({
  displayName: z.string().trim().min(1).max(180),
  communeName: z.string().max(100).nullable().optional(),
  regionCode: z.string().max(4).nullable().optional(),
  regionName: z.string().max(100).nullable().optional(),
  communeCode: z.string().max(8).nullable().optional(),
  regionsAvailable: z.array(z.string().max(100)).max(16).optional(),
  willingToRelocate: z.boolean().optional(),
  preferredTitles: z.array(z.string().max(120)).max(30).optional(),
  compatibleTitles: z.array(z.string().max(120)).max(30).optional(),
  sectors: z.array(z.string().max(120)).max(30).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  experienceYearsKnown: z.boolean().optional(),
  education: z.array(z.string().max(250)).max(30).optional(),
  educationKnown: z.boolean().optional(),
  certifications: z.array(z.string().max(250)).max(50).optional(),
  licenses: z.array(z.string().max(250)).max(30).optional(),
  credentialsKnown: z.boolean().optional(),
  hardSkills: z.array(z.string().max(160)).max(100).optional(),
  softSkills: z.array(z.string().max(160)).max(100).optional(),
  languages: z.array(z.string().max(100)).max(20).optional(),
  seniority: z.string().max(64).nullable().optional(),
  acceptedModalities: z.array(modality).max(4).optional(),
  acceptedSchedules: z.array(z.string().max(64)).max(20).optional(),
  preferredContracts: z.array(z.string().max(64)).max(20).optional(),
  salaryTargetCLP: z.number().int().min(0).nullable().optional(),
  salaryBasisPreference: salaryBasis.optional(),
  privateNotes: z.string().max(10000).optional(),
  consentGiven: z.boolean().optional(),
  consentAt: z.string().datetime().optional(),
  experience: z
    .array(
      z.object({
        companyName: z.string().max(180).optional(),
        role: z.string().max(180),
        startedAt: z.string().max(24).optional(),
        endedAt: z.string().max(24).optional(),
        achievements: z.string().max(3000).optional(),
      })
    )
    .max(30)
    .optional(),
});

const rowsSchema = z
  .array(z.record(z.string().max(256), z.unknown()))
  .min(1)
  .max(2000)
  .superRefine((rows, context) => {
    const bytes = new TextEncoder().encode(JSON.stringify(rows)).byteLength;
    if (bytes > 5 * 1024 * 1024)
      context.addIssue({
        code: "custom",
        message: "El lote supera el límite de 5 MB.",
      });
    rows.forEach((row, index) => {
      if (
        new TextEncoder().encode(JSON.stringify(row)).byteLength > 100_000
      )
        context.addIssue({
          code: "custom",
          path: [index],
          message: `La fila ${index + 1} supera el límite de 100 KB.`,
        });
    });
  });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  jobs: router({
    list: protectedProcedure
      .input(jobFilters.default({}))
      .query(({ input, ctx }) => listJobs(input as JobFilters, ctx.user.id)),
    facets: protectedProcedure.query(({ ctx }) => getFacets(ctx.user.id)),
    detail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .query(({ input, ctx }) => getJob(input.id, ctx.user.id)),
    create: adminProcedure
      .input(jobFields)
      .mutation(({ input, ctx }) =>
        upsertJob(
          input as Record<string, unknown>,
          ctx.user.id,
          input.sourceCodes?.[0] ?? "manual"
        )
      ),
    update: adminProcedure
      .input(
        z.object({ id: z.string().min(1).max(32), patch: jobFields.partial() })
      )
      .mutation(({ input, ctx }) =>
        updateJob(input.id, input.patch as Record<string, unknown>, ctx.user.id)
      ),
    archive: adminProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => archiveJob(input.id, ctx.user.id)),
  }),
  saved: router({
    list: protectedProcedure
      .input(z.object({ includeDiscarded: z.boolean().optional() }).optional())
      .query(({ input, ctx }) =>
        listSavedJobs(ctx.user.id, input?.includeDiscarded ?? false)
      ),
    toggle: protectedProcedure
      .input(z.object({ jobId: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => toggleSavedJob(input.jobId, ctx.user.id)),
    note: protectedProcedure
      .input(
        z.object({
          jobId: z.string().min(1).max(32),
          note: z.string().max(5000),
        })
      )
      .mutation(({ input, ctx }) =>
        setJobNote(input.jobId, input.note, ctx.user.id)
      ),
    update: protectedProcedure
      .input(
        z.object({
          jobId: z.string().min(1).max(32),
          tags: z.array(z.string().max(40)).max(10).optional(),
          discarded: z.boolean().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateSavedJob(input.jobId, ctx.user.id, input)
      ),
  }),
  searches: router({
    list: protectedProcedure.query(({ ctx }) => listSearches(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(150),
          filters: jobFilters,
        })
      )
      .mutation(({ input, ctx }) =>
        createSearch(
          ctx.user.id,
          input.name,
          input.filters as Record<string, unknown>
        )
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          name: z.string().trim().min(1).max(150).optional(),
          filters: jobFilters.optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateSearch(ctx.user.id, input.id, {
          name: input.name,
          filters: input.filters as Record<string, unknown> | undefined,
        })
      ),
    execute: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => executeSearch(ctx.user.id, input.id)),
    delete: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => deleteSearch(ctx.user.id, input.id)),
  }),
  candidates: router({
    list: protectedProcedure.query(({ ctx }) => listCandidates(ctx.user.id)),
    detail: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .query(({ input, ctx }) => getCandidate(input.id, ctx.user.id)),
    create: protectedProcedure
      .input(
        candidateFields.extend({
          consentGiven: z.literal(true),
          consentAt: z.string().datetime(),
        })
      )
      .mutation(({ input, ctx }) =>
        createCandidate(input as Record<string, unknown>, ctx.user.id)
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          patch: candidateFields.partial(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateCandidate(
          input.id,
          input.patch as Record<string, unknown>,
          ctx.user.id
        )
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => deleteCandidate(input.id, ctx.user.id)),
    uploadCv: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().max(120),
          base64: z.string().min(1).max(11_200_000),
        })
      )
      .mutation(({ input, ctx }) =>
        uploadCandidateCv(input.id, ctx.user.id, input)
      ),
    correctCvText: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          documentId: z.string().min(1).max(32),
          extractedText: z.string().max(120000),
        })
      )
      .mutation(({ input, ctx }) =>
        correctCvText(
          input.id,
          input.documentId,
          input.extractedText,
          ctx.user.id
        )
      ),
    deleteCv: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          documentId: z.string().min(1).max(32),
        })
      )
      .mutation(({ input, ctx }) =>
        deleteCandidateCv(input.id, input.documentId, ctx.user.id)
      ),
    matches: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32),
          filters: jobFilters.optional(),
        })
      )
      .query(({ input, ctx }) =>
        candidateMatches(
          input.id,
          ctx.user.id,
          input.filters as JobFilters | undefined
        )
      ),
  }),
  administration: router({
    jobs: adminProcedure.query(() => listAdminJobs()),
    restoreJob: adminProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .mutation(({ input, ctx }) => restoreJob(input.id, ctx.user.id)),
    exportJobs: adminProcedure.query(() => exportJobs()),
    importPreview: adminProcedure
      .input(z.object({ rows: rowsSchema }))
      .mutation(({ input }) => importPreview(input.rows)),
    importCommit: adminProcedure
      .input(
        z.object({
          rows: rowsSchema,
          fileName: z.string().min(1).max(255),
          format: z.enum(["csv", "json"]),
        })
      )
      .mutation(({ input, ctx }) =>
        commitImport(input.rows, input.fileName, input.format, ctx.user.id)
      ),
    imports: adminProcedure.query(({ ctx }) => listImportBatches(ctx.user.id)),
    importErrors: adminProcedure
      .input(z.object({ id: z.string().min(1).max(32) }))
      .query(({ input, ctx }) => getImportErrors(input.id, ctx.user.id)),
    sources: adminProcedure.query(() => listSources()),
    sourceStatus: adminProcedure
      .input(z.object({ id: z.string().min(1).max(64) }))
      .query(({ input }) => getSourceStatus(input.id)),
    atsBoards: adminProcedure.query(() => listAtsCompanyBoards()),
    saveAtsBoard: adminProcedure
      .input(
        z.object({
          id: z.string().min(1).max(32).optional(),
          companyId: z.string().min(1).max(32).optional(),
          companyName: z.string().trim().min(1).max(255),
          provider: z.enum([
            "greenhouse",
            "lever",
            "ashby",
            "smartrecruiters",
            "workable",
            "recruitee",
            "other_ats",
          ]),
          boardId: z.string().trim().min(1).max(255),
          countryCode: z.literal("CL").optional(),
          physicalLocationSummary: z.string().max(255).optional(),
          chilePhysicalSiteVerified: z.boolean().optional(),
          workplaceEvidence: z.string().max(2_000).optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        saveAtsCompanyBoard(input as Record<string, unknown>, ctx.user.id)
      ),
    weights: adminProcedure.query(() => getMatchWeights()),
    updateWeights: adminProcedure
      .input(
        z.object({
          function: z.number().int().min(0).max(100),
          skills: z.number().int().min(0).max(100),
          experience: z.number().int().min(0).max(100),
          education: z.number().int().min(0).max(100),
          geography: z.number().int().min(0).max(100),
          conditions: z.number().int().min(0).max(100),
        })
      )
      .mutation(({ input, ctx }) => setMatchWeights(input, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
