import { normalizeText } from "./normalization";

export type SalaryVisibilityValue =
  | "disclosed"
  | "reserved"
  | "not_disclosed"
  | "unknown";

export function isSalaryPubliclyDisclosed(
  visibility: SalaryVisibilityValue,
  explicitlyDisclosed = false
): boolean {
  if (visibility === "reserved" || visibility === "not_disclosed") return false;
  return visibility === "disclosed" || explicitlyDisclosed;
}

export function classifySalaryVisibility(input: {
  visibility?: unknown;
  rawText?: unknown;
  hasAmount?: boolean;
  isDisclosedFlag?: boolean;
}): SalaryVisibilityValue {
  const visibility = normalizeText(input.visibility).replace(/[_-]+/g, " ");
  const rawText = normalizeText(input.rawText);
  const sourceText = `${visibility} ${rawText}`.trim();
  if (/\b(?:reserv\w*|confidencial)\b/.test(sourceText)) return "reserved";
  if (
    /(?:no informad\w*|no publicad\w*|no divulgad\w*|no especificad\w*|not disclosed|a convenir|negociable)/.test(
      sourceText
    ) ||
    visibility === "not disclosed"
  )
    return "not_disclosed";
  if (input.hasAmount === true || input.isDisclosedFlag === true)
    return "disclosed";
  if (["unknown", "desconocido", "no informado"].includes(visibility))
    return "unknown";
  if (["disclosed", "publicado", "informado", "visible"].some(value =>
    visibility.includes(value)
  ))
    return "disclosed";
  if (rawText) return "disclosed";
  return "unknown";
}
