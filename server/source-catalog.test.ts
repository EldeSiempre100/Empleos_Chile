import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG } from "./source-catalog";

describe("catálogo de fuentes del Anexo 02", () => {
  it("contiene los portales, ATS y fuentes de referencia de forma individual", () => {
    const ids = SOURCE_CATALOG.map(source => source.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of [
      "bne",
      "trabajando_cl",
      "chiletrabajos",
      "laborum_cl",
      "computrabajo_cl",
      "empleos_publicos",
      "getonbrd_cl",
    ])
      expect(SOURCE_CATALOG.find(source => source.id === id)?.category).toBe(
        "job_portal"
      );

    for (const id of [
      "greenhouse",
      "lever",
      "ashby",
      "smartrecruiters",
      "workable",
      "recruitee",
      "other_ats",
    ])
      expect(SOURCE_CATALOG.find(source => source.id === id)?.category).toBe(
        "ats"
      );

    for (const id of [
      "dpa",
      "sence_sabe_ciuo",
      "datos_abiertos_ckan",
      "chilecompra",
      "omil_municipios",
      "inversion_politicas_empleo",
    ])
      expect(
        SOURCE_CATALOG.find(source => source.id === id)?.sourceKind
      ).toBe("reference_data");
  });

  it("deja portales y ATS desconectados, sin fingir sincronizaciones", () => {
    const externalSources = SOURCE_CATALOG.filter(source =>
      ["job_portal", "ats"].includes(source.category)
    );
    expect(externalSources.length).toBeGreaterThanOrEqual(14);
    expect(externalSources.every(source => source.sourceStatus === "not_connected")).toBe(
      true
    );
    expect(
      SOURCE_CATALOG.find(source => source.id === "manual")?.accessMode
    ).toBe("manual_only");
    expect(
      SOURCE_CATALOG.find(source => source.id === "manual")?.sourceStatus
    ).toBe("available");
    expect(
      SOURCE_CATALOG.filter(source => source.category === "reference_data").every(
        source => source.sourceKind === "reference_data"
      )
    ).toBe(true);
  });
});
