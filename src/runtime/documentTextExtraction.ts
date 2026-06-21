import * as FileSystem from "expo-file-system/legacy";
import { unzlibSync, inflateSync } from "fflate";
import { toByteArray } from "react-native-quick-base64";

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function decodePdfHex(hex: string) {
  const cleaned = hex.replace(/\s+/g, "");
  if (!cleaned) return "";
  const even = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`;
  let out = "";
  for (let index = 0; index < even.length; index += 2) {
    const code = Number.parseInt(even.slice(index, index + 2), 16);
    if (!Number.isFinite(code)) continue;
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function bytesToLatin1(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  if (needle.length === 0) return from;
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function tryInflate(data: Uint8Array): Uint8Array | null {
  try {
    return unzlibSync(data);
  } catch {
    try {
      return inflateSync(data);
    } catch {
      return null;
    }
  }
}

function extractPdfOperatorText(source: string) {
  const chunks: string[] = [];
  const literalPatterns = [
    /\((?:\\.|[^\\)]){1,800}\)\s*(?:Tj|'|")/g,
    /\[(.*?)\]\s*TJ/g,
  ];

  for (const pattern of literalPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const raw = match[1] ?? match[0];
      if (raw.startsWith("(")) {
        const inner = raw.slice(1, raw.lastIndexOf(")"));
        const decoded = decodePdfLiteral(inner);
        if (decoded.trim()) chunks.push(decoded);
      } else if (raw.includes("(")) {
        const parts = raw.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
        for (const part of parts) {
          const decoded = decodePdfLiteral(part.slice(1, -1));
          if (decoded.trim()) chunks.push(decoded);
        }
      }
    }
  }

  const hexPattern = /<([0-9A-Fa-f\s]{2,800})>\s*(?:Tj|'|")/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexPattern.exec(source)) !== null) {
    const decoded = decodePdfHex(hexMatch[1] ?? "");
    if (decoded.trim()) chunks.push(decoded);
  }

  return chunks;
}

function isPdfStructureNoise(text: string) {
  return /endstream|endobj|\bstream\b|\bxref\b|trailer|startxref|\/FlateDecode|\/Length\b|\/Filter\b|\d+\s+\d+\s+obj/i.test(
    text,
  );
}

function isValidTextChunk(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isPdfStructureNoise(trimmed)) return false;
  if (/<<\s*\//.test(trimmed)) return false;
  const printable = (trimmed.match(/[\x20-\x7E\n\r\t]/g) ?? []).length;
  if (printable / Math.max(trimmed.length, 1) < 0.82) return false;
  const letters = (trimmed.match(/[a-zA-Z]/g) ?? []).length;
  if (letters < 2) return false;
  return true;
}

function isReadablePdfContent(text: string) {
  const sample = text.slice(0, 4000);
  if (!sample.trim()) return false;
  const printable = (sample.match(/[\x20-\x7E\n\r\t]/g) ?? []).length;
  if (printable / Math.max(sample.length, 1) < 0.82) return false;
  if (/\b(BT|ET|Tj|TJ|Tm|Td|Tf)\b/.test(sample)) return true;
  if (/\([^\)]{2,}\)\s*Tj/.test(sample)) return true;
  return /[a-zA-Z]{4,}/.test(sample) && printable > 80;
}

function collectReadablePdfChunks(text: string) {
  const operator = extractPdfOperatorText(text);
  const ascii = extractReadableAsciiRuns(text);
  return [...operator, ...ascii].filter((chunk) => isValidTextChunk(chunk));
}

function extractReadableAsciiRuns(source: string) {
  const runs = source.match(/[\x20-\x7E\n\r\t]{5,}/g) ?? [];
  return runs
    .map((run) => run.replace(/\s+/g, " ").trim())
    .filter((run) => run.length >= 5)
    .filter((run) => isValidTextChunk(run))
    .filter((run) => !/^(%PDF|obj|endobj|stream|xref|trailer|startxref)/i.test(run))
    .filter((run) => !/^\/[A-Za-z0-9]+/.test(run));
}

function extractDecompressedStreamText(pdfBytes: Uint8Array): string[] {
  const chunks: string[] = [];
  const streamToken = new TextEncoder().encode("stream");
  const endToken = new TextEncoder().encode("endstream");
  let cursor = 0;

  while (cursor < pdfBytes.length) {
    const streamIdx = indexOfBytes(pdfBytes, streamToken, cursor);
    if (streamIdx < 0) break;

    let dataStart = streamIdx + streamToken.length;
    if (pdfBytes[dataStart] === 0x0d && pdfBytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (pdfBytes[dataStart] === 0x0a) dataStart += 1;

    const endIdx = indexOfBytes(pdfBytes, endToken, dataStart);
    if (endIdx < 0) break;

    let dataEnd = endIdx;
    if (dataEnd > 0 && pdfBytes[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (dataEnd > 0 && pdfBytes[dataEnd - 1] === 0x0d) dataEnd -= 1;

    const contextStart = Math.max(0, streamIdx - 480);
    const context = bytesToLatin1(pdfBytes.subarray(contextStart, streamIdx));
    const raw = pdfBytes.subarray(dataStart, dataEnd);
    const isFlate = /\/FlateDecode/i.test(context);
    const isDct = /\/DCTDecode/i.test(context);

    if (isFlate && raw.length > 8) {
      const inflated = tryInflate(raw);
      if (inflated?.length) {
        const text = bytesToLatin1(inflated);
        if (isReadablePdfContent(text)) {
          chunks.push(...collectReadablePdfChunks(text));
        }
      }
    } else if (!isDct && raw.length > 0 && raw.length < 500_000) {
      const text = bytesToLatin1(raw);
      if (isReadablePdfContent(text)) {
        chunks.push(...collectReadablePdfChunks(text));
      }
    }

    cursor = endIdx + endToken.length;
  }

  return chunks;
}

async function readFileAsBytes(uri: string, maxBytes = 6_000_000): Promise<Uint8Array> {
  const info = await FileSystem.getInfoAsync(uri);
  const size = "size" in info && typeof info.size === "number" ? info.size : maxBytes;
  if (size > maxBytes) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: maxBytes,
      position: 0,
    });
    return toByteArray(base64);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return toByteArray(base64);
}

async function readFileAsLatin1(uri: string, maxBytes = 6_000_000) {
  const bytes = await readFileAsBytes(uri, maxBytes);
  return bytesToLatin1(bytes);
}

function mergeExtractedText(parts: string[]) {
  const cleaned = parts
    .map((part) => part.replace(/\r/g, "\n").replace(/[^\S\n]+/g, " ").trim())
    .filter((part) => isValidTextChunk(part));
  const unique: string[] = [];
  for (const part of cleaned) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique.join("\n");
}

/** Fast embedded-text scrape for common PDFs (lab reports, statements). */
export async function extractPdfText(uri: string): Promise<string> {
  const pdfBytes = await readFileAsBytes(uri);
  const streamText = extractDecompressedStreamText(pdfBytes);
  let merged = mergeExtractedText(streamText);

  if (merged.trim().length < 40) {
    const latin1 = bytesToLatin1(pdfBytes);
    merged = mergeExtractedText(collectReadablePdfChunks(latin1));
  }

  return merged.slice(0, 120_000);
}

/** 0-10 quality score; low scores mean binary/font noise rather than readable report text. */
export function measureExtractedTextQuality(text: string) {
  if (!text.trim()) return 0;
  const sample = `${text.slice(0, 6000)}${text.slice(-6000)}`;
  const printable = (sample.match(/[\x20-\x7E\n\r\t]/g) ?? []).length;
  const ratio = printable / Math.max(sample.length, 1);
  if (ratio < 0.72) return 0;
  const words = sample.match(/\b[a-zA-Z]{3,}\b/g) ?? [];
  const medical = /\b(cholesterol|glucose|hemoglobin|patient|laboratory|clinical|mg\/dl|reference range|triglyceride|creatinine|iron)\b/i.test(
    sample,
  );
  return Math.min(10, Math.round(ratio * 4 + words.length / 18 + (medical ? 3 : 0)));
}

export function isGarbagePdfExtract(text: string) {
  return measureExtractedTextQuality(text) < 2;
}

async function extractPdfEmbeddedImages(uri: string): Promise<string[]> {
  const pdfBytes = await readFileAsBytes(uri);
  const streamToken = new TextEncoder().encode("stream");
  const endToken = new TextEncoder().encode("endstream");
  const cacheDir = `${FileSystem.cacheDirectory ?? ""}pdf-ocr/`;
  await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => undefined);

  const imageUris: string[] = [];
  let cursor = 0;
  let imageIndex = 0;

  while (cursor < pdfBytes.length && imageIndex < 24) {
    const streamIdx = indexOfBytes(pdfBytes, streamToken, cursor);
    if (streamIdx < 0) break;

    const contextStart = Math.max(0, streamIdx - 480);
    const context = bytesToLatin1(pdfBytes.subarray(contextStart, streamIdx));
    if (!/\/DCTDecode|\/JPXDecode|\/Subtype\s*\/Image/i.test(context)) {
      cursor = streamIdx + streamToken.length;
      continue;
    }

    let dataStart = streamIdx + streamToken.length;
    if (pdfBytes[dataStart] === 0x0d && pdfBytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (pdfBytes[dataStart] === 0x0a) dataStart += 1;

    const endIdx = indexOfBytes(pdfBytes, endToken, dataStart);
    if (endIdx < 0) break;

    let dataEnd = endIdx;
    if (dataEnd > 0 && pdfBytes[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (dataEnd > 0 && pdfBytes[dataEnd - 1] === 0x0d) dataEnd -= 1;

    const raw = pdfBytes.subarray(dataStart, dataEnd);
    if (raw.length > 1024 && raw.length < 8_000_000) {
      const target = `${cacheDir}page-${imageIndex}.jpg`;
      const base64 = uint8ToBase64(raw);
      await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
      imageUris.push(target);
      imageIndex += 1;
    }

    cursor = endIdx + endToken.length;
  }

  return imageUris;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof btoa === "function") return btoa(binary);
  return (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer?.from(
    binary,
    "binary",
  )?.toString("base64") ?? "";
}

/** OCR fallback for image-only PDFs: extract embedded page images and run ML Kit. */
export async function extractPdfTextViaOcr(
  uri: string,
  options?: { useQvacOcr?: boolean; onPageProgress?: (current: number, total: number) => void },
): Promise<string> {
  const imageUris = await extractPdfEmbeddedImages(uri);
  const chunks: string[] = [];
  for (let index = 0; index < imageUris.length; index += 1) {
    const imageUri = imageUris[index] ?? "";
    options?.onPageProgress?.(index + 1, imageUris.length);
    const text = await extractImageText(imageUri, { preferMlKit: true, useQvacOcr: options?.useQvacOcr });
    if (text.trim()) chunks.push(text);
    await new Promise<void>((resolve) => setTimeout(resolve, 16));
  }
  return mergeExtractedText(chunks);
}

export async function extractImageText(uri: string, options?: { preferMlKit?: boolean; useQvacOcr?: boolean }) {
  const preferMlKit = options?.preferMlKit !== false;
  if (preferMlKit) {
    try {
      const { runMlKitVisionPreview } = await import("./toolRuntime");
      const vision = await runMlKitVisionPreview(uri);
      const parsed = safeJsonParse(vision);
      const ocrText =
        parsed && typeof parsed === "object" && "ocrText" in parsed
          ? String((parsed as { ocrText?: string }).ocrText ?? "")
          : vision;
      if (ocrText.trim() && !/no text recognized/i.test(ocrText)) {
        return ocrText;
      }
    } catch {
      // Fall through to QVAC OCR when configured.
    }
  }

  if (options?.useQvacOcr) {
    const { runQvacOcrPreview } = await import("./qvacOcr");
    const ocr = await runQvacOcrPreview(uri);
    const parsed = safeJsonParse(ocr);
    if (parsed && typeof parsed === "object") {
      if ("ocrText" in parsed) return String((parsed as { ocrText?: string }).ocrText ?? "");
      if ("text" in parsed) return String((parsed as { text?: string }).text ?? "");
    }
    return typeof ocr === "string" ? ocr : JSON.stringify(parsed ?? ocr);
  }

  return "";
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
