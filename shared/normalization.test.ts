import { describe, expect, it } from "vitest";
import type { JobRecord } from "./domain";
import {
  filterJobs,
  normalizeImportedCountry,
  normalizeText,
  parseCLPAmount,
  scoreMatch,
} from "./normalization";
import { mapImportRows } from "../client/src/lib/importData";

const fixtures: JobRecord[] = [
  {
    id: "a",
    title: "Analista de Gestión",
    companyName: "Empresa A",
    countryCode: "CL",
    regionName: "Metropolitana de Santiago",
    communeName: "Santiago",
    modality: "presencial",
    description: "Control y análisis",
    category: "Administración",
    verificationStatus: "vigente",
    active: true,
    salaryMinCLP: 800000,
    salaryMaxCLP: 1000000,
    salaryBasis: "gross",
    salaryIsDisclosed: true,
    skills: ["Excel"],
  },
  {
    id: "b",
    title: "Analista Comercial",
    companyName: "Empresa B",
    countryCode: "CL",
    regionName: "Valparaíso",
    communeName: "Viña del Mar",
    modality: "hibrida",
    description: "Ventas",
    category: "Comercial",
    verificationStatus: "por_verificar",
    active: true,
  },
  {
    id: "c",
    title: "Cargo remoto",
    companyName: "Empresa C",
    countryCode: "CL",
    modality: "remota",
    description: "Global",
    active: true,
  },
  {
    id: "d",
    title: "Analista",
    companyName: "Empresa D",
    countryCode: "AR",
    modality: "presencial",
    description: "Fuera de Chile",
    active: true,
  },
];

describe("normalización y facetas", () => {
  it("ignora mayúsculas y tildes", () =>
    expect(normalizeText("Administración Pública")).toBe(
      "administracion publica"
    ));
  it("no presume Chile cuando la fila no informa país ni ubicación verificada", () => {
    expect(normalizeImportedCountry("", false)).toBe("");
    expect(normalizeImportedCountry("", true)).toBe("CL");
    expect(normalizeImportedCountry("Chile", false)).toBe("CL");
    expect(normalizeImportedCountry("AR", true)).toBe("AR");
    expect(
      mapImportRows([{ cargo: "Analista" }], { title: "cargo" })[0].countryCode
    ).toBeUndefined();
  });
  it("interpreta montos CLP con separadores chilenos e internacionales", () => {
    expect(parseCLPAmount("$ 1.200.000")).toBe(1_200_000);
    expect(parseCLPAmount("1,200,000")).toBe(1_200_000);
    expect(parseCLPAmount("CLP 1.200.000,00")).toBe(1_200_000);
    expect(parseCLPAmount(850_000)).toBe(850_000);
    expect(parseCLPAmount("")).toBeNull();
    const mapped = mapImportRows(
      [{ cargo: "Analista", sueldo: "$ 1.200.000" }],
      { title: "cargo", salaryMinCLP: "sueldo" }
    );
    expect(mapped[0].salaryMinCLP).toBe(1_200_000);
  });
  it("distingue sueldo reservado, informado y no publicado al mapear columnas", () => {
    const rows = mapImportRows(
      [
        { visibilidad: "Informado" },
        { visibilidad: "Reservado" },
        { visibilidad: "No publicado" },
      ],
      { salaryVisibility: "visibilidad" }
    );
    expect(rows.map(row => row.salaryVisibility)).toEqual([
      "disclosed",
      "reserved",
      "not_disclosed",
    ]);
  });
  it("por defecto mantiene ofertas presenciales de Chile", () => {
    expect(filterJobs(fixtures, {}).map(job => job.id)).toEqual(["a"]);
  });
  it("aplica OR dentro de una faceta y AND entre dimensiones", () => {
    const result = filterJobs(fixtures, {
      modalities: ["presencial", "hibrida"],
      categories: ["Administración", "Comercial"],
      regions: ["Valparaíso"],
    });
    expect(result.map(job => job.id)).toEqual(["b"]);
  });
  it("no trata modalidad desconocida como presencial y admite híbrida solo de forma explícita", () => {
    const unknown = {
      ...fixtures[0],
      id: "unknown",
      modality: "no_informada" as const,
    };
    expect(filterJobs([unknown], {})).toHaveLength(0);
    expect(
      filterJobs([unknown], {
        modalities: ["presencial"],
        includeUnknownModality: true,
      })
    ).toHaveLength(1);
    expect(filterJobs([fixtures[1]], { modalities: ["hibrida"] })).toHaveLength(
      1
    );
  });
  it("aplica rangos de sueldo sin homologar base", () => {
    expect(
      filterJobs(fixtures, {
        salaryMin: 900000,
        salaryBasis: "gross",
        includeUndisclosedSalary: false,
      }).map(job => job.id)
    ).toEqual(["a"]);
    expect(
      filterJobs([{ ...fixtures[0], salaryBasis: "net" }], {
        salaryMin: 900000,
        salaryBasis: "gross",
      })
    ).toHaveLength(0);
    const noSalary = {
      ...fixtures[1],
      salaryBasis: "unknown" as const,
      salaryIsDisclosed: false,
    };
    expect(
      filterJobs([noSalary], {
        modalities: ["hibrida"],
        salaryBasis: "gross",
        includeUndisclosedSalary: true,
      })
    ).toHaveLength(1);
    expect(
      filterJobs([noSalary], {
        modalities: ["hibrida"],
        salaryBasis: "gross",
        includeUndisclosedSalary: false,
      })
    ).toHaveLength(0);

    const reservedLegacy = {
      ...fixtures[1],
      salaryVisibility: "reserved" as const,
      salaryBasis: "unknown" as const,
      salaryIsDisclosed: true,
    };
    expect(
      filterJobs([reservedLegacy], {
        modalities: ["hibrida"],
        salaryBasis: "gross",
        includeUndisclosedSalary: false,
      })
    ).toHaveLength(0);
    expect(
      filterJobs([reservedLegacy], {
        modalities: ["hibrida"],
        salaryBasis: "gross",
        includeUndisclosedSalary: true,
      })
    ).toHaveLength(1);
  });
  it("evalúa el rango de fecha en Santiago y permite la fecha de verificación", () => {
    const job = {
      ...fixtures[0],
      publishedAt: "2026-10-23T02:00:00.000Z",
      lastVerifiedAt: "2026-10-23T16:00:00.000Z",
    };
    expect(
      filterJobs([job], { dateFrom: "2026-10-22", dateTo: "2026-10-22" })
    ).toHaveLength(1);
    expect(
      filterJobs([job], {
        dateBasis: "verification",
        dateFrom: "2026-10-23",
        dateTo: "2026-10-23",
      })
    ).toHaveLength(1);
  });
  it("excluye cierres pasados por defecto y los identifica al filtrarlos", () => {
    const expired = { ...fixtures[0], expiresAt: "2020-01-01T00:00:00.000Z" };
    expect(filterJobs([expired], {})).toHaveLength(0);
    expect(filterJobs([expired], { statuses: ["vencido"] })).toHaveLength(1);
  });
});

describe("compatibilidad", () => {
  it("explica si una credencial excluyente está ausente o no confirmada", () => {
    const candidate = {
      preferredTitles: ["Analista de Gestión"],
      compatibleTitles: [],
      sectors: ["Administración"],
      yearsExperience: 4,
      education: ["Técnico en administración"],
      certifications: [],
      licenses: [],
      credentialsKnown: true,
      hardSkills: ["Excel"],
      softSkills: [],
      acceptedModalities: ["presencial" as const],
      acceptedSchedules: [],
      preferredContracts: [],
      regionsAvailable: ["Metropolitana de Santiago"],
      communeName: "Santiago",
      willingToRelocate: false,
      salaryTargetCLP: 800000,
    };
    const job = { ...fixtures[0], mandatoryRequirements: ["licencia SEC"] };
    const first = scoreMatch(candidate, job);
    const second = scoreMatch(candidate, job);
    expect(first).toEqual(second);
    expect(first.isEligible).toBe(false);
    expect(first.eligibilityStatus).toBe("not_eligible");
    expect(first.exclusions).toContain("licencia SEC");
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);

    const pending = scoreMatch({ ...candidate, credentialsKnown: false }, job);
    expect(pending.isEligible).toBe(false);
    expect(pending.eligibilityStatus).toBe("insufficient");
    expect(pending.exclusions).not.toContain("licencia SEC");
    expect(pending.insufficient.join(" ")).toContain("licencia SEC");
  });
  it("solo bloquea formación ausente cuando la lista fue confirmada como completa", () => {
    const candidate = {
      preferredTitles: [],
      compatibleTitles: [],
      sectors: [],
      yearsExperience: 0,
      experienceYearsKnown: false,
      education: [],
      certifications: [],
      licenses: [],
      credentialsKnown: false,
      hardSkills: [],
      softSkills: [],
      acceptedModalities: ["presencial" as const],
      acceptedSchedules: [],
      preferredContracts: [],
      regionsAvailable: [],
      willingToRelocate: false,
    };
    const job = {
      ...fixtures[0],
      educationLevel: "Título universitario",
      mandatoryRequirements: ["Título universitario"],
    };

    const confirmed = scoreMatch({ ...candidate, educationKnown: true }, job);
    expect(confirmed.eligibilityStatus).toBe("not_eligible");
    expect(confirmed.exclusions).toContain("Título universitario");

    const unconfirmed = scoreMatch({ ...candidate, educationKnown: false }, job);
    expect(unconfirmed.eligibilityStatus).toBe("insufficient");
    expect(unconfirmed.exclusions).not.toContain("Título universitario");
    expect(unconfirmed.insufficient.join(" ")).toContain("Título universitario");
  });
  it("evalúa los años mínimos con la experiencia estructurada y no como credencial", () => {
    const candidate = {
      preferredTitles: ["Analista de Gestión"],
      compatibleTitles: [],
      sectors: ["Administración"],
      yearsExperience: 10,
      education: ["Técnico en administración"],
      certifications: [],
      licenses: [],
      hardSkills: ["Excel"],
      softSkills: [],
      acceptedModalities: ["presencial" as const],
      acceptedSchedules: [],
      preferredContracts: [],
      regionsAvailable: ["Metropolitana de Santiago"],
      communeName: "Santiago",
      willingToRelocate: false,
      salaryTargetCLP: 800000,
    };
    const job = {
      ...fixtures[0],
      mandatoryRequirements: ["Mínimo 5 años de experiencia"],
    };
    expect(scoreMatch(candidate, job).isEligible).toBe(true);

    const missingYears = scoreMatch({ ...candidate, yearsExperience: 0 }, job);
    expect(missingYears.isEligible).toBe(false);
    expect(missingYears.eligibilityStatus).toBe("insufficient");
    expect(missingYears.insufficient.join(" ")).toContain("no informados");

    expect(
      scoreMatch({ ...candidate, yearsExperience: 4 }, job).isEligible
    ).toBe(false);

    const structuredMinimumJob = {
      ...fixtures[0],
      experienceMinYears: 5,
      mandatoryRequirements: [],
    };
    const structuredYearsUnknown = scoreMatch(
      {
        ...candidate,
        yearsExperience: 0,
        experienceYearsKnown: false,
      },
      structuredMinimumJob
    );
    expect(structuredYearsUnknown.isEligible).toBe(false);
    expect(structuredYearsUnknown.eligibilityStatus).toBe("insufficient");
    expect(structuredYearsUnknown.insufficient.join(" ")).toContain("5");

    const reservedSalaryJob = {
      ...fixtures[0],
      salaryMinCLP: null,
      salaryMaxCLP: null,
      salaryVisibility: "reserved" as const,
      salaryIsDisclosed: true,
    };
    expect(
      scoreMatch(candidate, reservedSalaryJob).insufficient.join(" ")
    ).toContain("Remuneración no informada");
  });

  it("usa historial, habilidades explícitas y títulos requeridos sin tratar datos ausentes como cero", () => {
    const candidate = {
      preferredTitles: [],
      compatibleTitles: [],
      sectors: [],
      yearsExperience: 0,
      experienceYearsKnown: false,
      experience: [
        {
          role: "Analista de Abastecimiento",
          companyName: "Empresa de ejemplo",
          achievements: "Automatizó reportes de compra",
        },
      ],
      education: ["Técnico en Administración"],
      certifications: [],
      licenses: [],
      hardSkills: ["SAP", "Excel"],
      softSkills: [],
      acceptedModalities: ["presencial" as const],
      acceptedSchedules: [],
      preferredContracts: [],
      regionsAvailable: [],
      willingToRelocate: false,
    };
    const job = {
      ...fixtures[0],
      title: "Analista de Abastecimiento",
      originalTitle: "Analista compras",
      department: "Abastecimiento",
      experienceMinYears: null,
      experienceRaw: "Experiencia en compras y abastecimiento",
      educationLevel: "Técnico",
      degreeNames: ["Técnico en administración"],
      skillsExplicit: ["SAP", "Excel"],
    };
    const explanation = scoreMatch(candidate, job);
    const factors = Object.fromEntries(
      explanation.factors.map(factor => [factor.key, factor])
    );
    expect(factors.function.evidence.length).toBeGreaterThan(0);
    expect(factors.skills.evidence).toEqual(expect.arrayContaining(["sap", "excel"]));
    expect(factors.education.evidence).toContain("Técnico en administración");
    expect(factors.experience.insufficient.join(" ")).toContain(
      "no se interpretan como cero"
    );
    expect(explanation.isEligible).toBe(true);
  });
});
