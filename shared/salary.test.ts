import { describe, expect, it } from "vitest";
import {
  classifySalaryVisibility,
  isSalaryPubliclyDisclosed,
} from "./salary";

describe("visibilidad salarial", () => {
  it("reconoce estados enumerados y texto fuente reservado/no publicado", () => {
    expect(classifySalaryVisibility({ visibility: "not_disclosed" })).toBe(
      "not_disclosed"
    );
    expect(
      classifySalaryVisibility({
        visibility: "disclosed",
        rawText: "Reservado por la empresa",
      })
    ).toBe("reserved");
    expect(
      classifySalaryVisibility({ rawText: "Remuneración no publicada" })
    ).toBe("not_disclosed");
    expect(classifySalaryVisibility({ visibility: "desconocido" })).toBe(
      "unknown"
    );
  });

  it("considera un monto estructurado como declarado salvo que el texto lo reserve", () => {
    expect(
      classifySalaryVisibility({ visibility: "unknown", hasAmount: true })
    ).toBe("disclosed");
    expect(
      classifySalaryVisibility({ visibility: "disclosed", hasAmount: true })
    ).toBe("disclosed");
    expect(
      classifySalaryVisibility({
        visibility: "disclosed",
        rawText: "Confidencial",
        hasAmount: true,
      })
    ).toBe("reserved");
  });

  it("mantiene desconocida una visibilidad no declarada y sin datos salariales", () => {
    expect(classifySalaryVisibility({})).toBe("unknown");
    expect(classifySalaryVisibility({ visibility: "unknown" })).toBe("unknown");
  });

  it("no marca como renta pública lo reservado/no publicado aunque exista un flag legado", () => {
    expect(isSalaryPubliclyDisclosed("reserved", true)).toBe(false);
    expect(isSalaryPubliclyDisclosed("not_disclosed", true)).toBe(false);
    expect(isSalaryPubliclyDisclosed("disclosed")).toBe(true);
    expect(isSalaryPubliclyDisclosed("unknown")).toBe(false);
  });
});
