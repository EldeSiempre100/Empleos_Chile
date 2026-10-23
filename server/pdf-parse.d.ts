declare module "pdf-parse" {
  type PdfParseOptions = { max?: number };
  type PdfParseResult = { text: string; numpages?: number; info?: Record<string, unknown> };
  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default pdfParse;
}
