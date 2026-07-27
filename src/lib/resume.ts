export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".txt") || name.endsWith(".md") || mime.startsWith("text/")) {
    const text = buf.toString("utf8").trim();
    if (text.length > 40) return text;
    throw new Error("Text resume is too short. Paste more content.");
  }

  const looksPdf =
    name.endsWith(".pdf") ||
    mime === "application/pdf" ||
    buf.subarray(0, 4).toString("utf8") === "%PDF";

  if (looksPdf) {
    const text = await extractPdfText(buf);
    if (text.length > 40) return text;
    throw new Error(
      "PDF had little readable text (possibly image-only/scanned). Paste resume text or upload a text-based PDF.",
    );
  }

  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) {
    throw new Error("DOCX not supported yet — upload PDF or TXT, or paste resume text.");
  }

  const asText = buf.toString("utf8").trim();
  if (asText.length > 40) return asText;
  throw new Error("Unsupported resume format. Use PDF or TXT.");
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const errors: string[] = [];

  // 1) unpdf — most reliable on Vercel/serverless
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const extracted = await extractText(pdf, { mergePages: true });
    const raw = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text || "");
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length > 40) return text;
    errors.push("unpdf returned empty text");
  } catch (error) {
    errors.push(`unpdf: ${error instanceof Error ? error.message : "failed"}`);
  }

  // 2) pdf-parse v2 fallback
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      const text = (result.text || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) return text;
      errors.push("pdf-parse returned empty text");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (error) {
    errors.push(`pdf-parse: ${error instanceof Error ? error.message : "failed"}`);
  }

  throw new Error(
    `Could not extract text from PDF. ${errors.join(" | ")}. Try a .txt resume or paste text.`,
  );
}
