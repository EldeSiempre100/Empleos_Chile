import { and, eq, isNull } from "drizzle-orm";
import { cvDocuments } from "../drizzle/schema";
import { getDb } from "./db";
import { addAudit, getCandidate } from "./employment-db";

export async function correctCvText(
  candidateId: string,
  documentId: string,
  extractedText: string,
  userId: number
) {
  const candidate = await getCandidate(candidateId, userId);
  if (!candidate) throw new Error("No se encontró el perfil.");
  const document = candidate.cvDocuments.find(item => item.id === documentId);
  if (!document) throw new Error("No se encontró la versión de CV.");
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const text = extractedText.replace(/\0/g, "").slice(0, 120_000).trim();
  await db
    .update(cvDocuments)
    .set({
      extractedText: text || null,
      extractionStatus: text.length > 20 ? "text_extracted" : "manual_review",
    })
    .where(
      and(
        eq(cvDocuments.id, documentId),
        eq(cvDocuments.candidateId, candidateId),
        isNull(cvDocuments.deletedAt)
      )
    );
  await addAudit(
    userId,
    "candidate.cv_text_corrected",
    "cv_document",
    documentId
  );
  return { success: true, characterCount: text.length };
}
