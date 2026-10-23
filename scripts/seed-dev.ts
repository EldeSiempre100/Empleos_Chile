import "dotenv/config";
import { upsertJob } from "../server/employment-db";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "development" || process.env.SEED_DEV !== "1") {
    throw new Error("Seed bloqueado: requiere NODE_ENV=development y SEED_DEV=1.");
  }
  if (!connectionString) throw new Error("Seed bloqueado: falta DATABASE_URL local.");

  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    throw new Error("Seed bloqueado: DATABASE_URL no es una URL MySQL válida.");
  }
  if (!localHosts.has(hostname)) {
    throw new Error("Seed bloqueado: solo se permiten bases en localhost, 127.0.0.1 o ::1; nunca se escribe en recursos administrados/remotos.");
  }

  const result = await upsertJob({
    title: "Analista de planificación (dato sintético de desarrollo)",
    companyName: "Compañía Ficticia Local",
    companyConfidential: false,
    countryCode: "CL",
    regionName: "Metropolitana de Santiago",
    communeName: "Santiago",
    modality: "presencial",
    category: "Administración",
    schedule: "Completa",
    contractType: "Plazo fijo",
    salaryBasis: "unknown",
    salaryIsDisclosed: false,
    description: "AVISO SINTÉTICO: fixture local para validar la interfaz. No corresponde a una vacante real.",
    responsibilities: ["Dato sintético para pruebas visuales locales."],
    requirements: [],
    mandatoryRequirements: [],
    benefits: [],
    skills: ["Planificación"],
    sourceCodes: ["manual"],
    provenance: "Fixture sintético local; no exportar ni publicar.",
    verificationStatus: "por_verificar",
  }, 0, "manual");

  console.log(`Fixture sintético listo (idempotente): ${result.id}`);
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo aplicar el fixture sintético.");
  process.exit(1);
});
