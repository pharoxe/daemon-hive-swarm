import * as FileSystem from "expo-file-system/legacy";
import { InteractionManager } from "react-native";
import type { RuntimeModel } from "./modelManifest";
import { extractImageText, extractPdfText, extractPdfTextViaOcr, isGarbagePdfExtract, measureExtractedTextQuality } from "./documentTextExtraction";
import type { MedicalShareFile, MedicalShareFinding, MedicalSharePreview, MedicalAnalysisProgress } from "../components/MedicalShareWizard";

export type { MedicalAnalysisProgress };

export function formatMedicalFinding(finding: MedicalShareFinding) {
  const label = finding.category.replace(/-/g, " ");
  const valuePart = finding.value ? `${finding.value}${finding.unit ? ` ${finding.unit}` : ""}` : null;
  const status = finding.rangeBucket.replace(/-/g, " ");
  return [label, valuePart, status].filter(Boolean).join(" · ");
}

function buildFinding(category: string, value: number | undefined, context: string): MedicalShareFinding {
  const unitMatch = context.match(/\b(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)\b/i);
  return {
    category,
    value: value !== undefined ? String(value) : undefined,
    unit: unitMatch?.[1]?.toLowerCase(),
    rangeBucket: classifyLabValue(value, context),
  };
}

function mergeFindingRecords(current: MedicalShareFinding | undefined, incoming: MedicalShareFinding) {
  if (!current) return incoming;
  if (!current.value && incoming.value) return incoming;
  if (current.value && incoming.value && !current.unit && incoming.unit) return incoming;
  return current;
}

function splitTextIntoChunks(text: string, chunkSize = 5200, overlap = 700) {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += chunkSize - overlap) {
    chunks.push(text.slice(start, start + chunkSize));
    if (start + chunkSize >= text.length) break;
  }
  return chunks;
}

function yieldToUi(pauseMs = 48) {
  return new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, pauseMs);
    });
  });
}

const BLOCKED_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi },
  { id: "phone", pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { id: "iso-date", pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { id: "us-date", pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g },
  { id: "mrn-label", pattern: /(mrn|patient\s*id|medical\s*record)[\s:#-]*[A-Z0-9-]{4,}/gi },
];

const PLACEHOLDER_PATTERNS = [
  /preview unavailable/i,
  /text was not embedded/i,
  /use ocr on exported images/i,
  /ml kit vision is not available/i,
];

const MEDICAL_SIGNAL_PATTERNS = [
  /\b(patient|diagnosis|laboratory|lab result|clinical|physician|prescription|medication|dosage)\b/i,
  /\b(hemoglobin|hematocrit|glucose|creatinine|platelet|wbc|rbc|cbc|lipid panel|a1c|hba1c)\b/i,
  /\b(mri|ct scan|x-?ray|ultrasound|radiology|pathology|biopsy|histology)\b/i,
  /\b(vital signs|blood pressure|heart rate|spo2|temperature)\b/i,
  /\b(urinalysis|specimen|reference range|mg\/dl|mmol\/l|iu\/l)\b/i,
  /\b(cholesterol|triglyceride|iron|uibc|transferrin)\b/i,
];

type AnalyteDef = {
  category: string;
  pattern: RegExp;
};

const ANALYTE_DEFS: AnalyteDef[] = [
  { category: "total-cholesterol", pattern: /\b(?:total\s*)?cholesterol\b/i },
  { category: "ldl-cholesterol", pattern: /\b(?:ldl(?:-c)?|low density lipoprotein)\b/i },
  { category: "hdl-cholesterol", pattern: /\b(?:hdl(?:-c)?|high density lipoprotein)\b/i },
  { category: "triglycerides", pattern: /\btriglycerides?\b/i },
  { category: "hemoglobin", pattern: /\b(?:hemoglobin|hgb)\b/i },
  { category: "hematocrit", pattern: /\bhematocrit\b/i },
  { category: "wbc-count", pattern: /\b(?:wbc|white blood cell(?: count)?)\b/i },
  { category: "rbc-count", pattern: /\b(?:rbc|red blood cell(?: count)?)\b/i },
  { category: "platelet-count", pattern: /\b(?:platelet(?: count)?|plt)\b/i },
  { category: "glucose", pattern: /\b(?:glucose|fasting sugar|blood sugar)\b/i },
  { category: "a1c", pattern: /\b(?:a1c|hba1c|hemoglobin a1c)\b/i },
  { category: "creatinine", pattern: /\bcreatinine\b/i },
  { category: "iron", pattern: /\b(?:serum\s*)?iron\b/i },
  { category: "uibc", pattern: /\b(?:uibc|unsaturated iron[- ]binding capacity)\b/i },
  { category: "transferrin-saturation", pattern: /\btransferrin\s*(?:sat(?:uration)?|sat\.?)\b/i },
  { category: "vitamin-d", pattern: /\b(?:vitamin\s*d|25[- ]oh)\b/i },
  { category: "vitamin-b12", pattern: /\b(?:vitamin\s*b[- ]?12|b12)\b/i },
  { category: "ferritin", pattern: /\bferritin\b/i },
  { category: "tsh", pattern: /\btsh\b/i },
  { category: "alt", pattern: /\b(?:alt|alanine aminotransferase)\b/i },
  { category: "ast", pattern: /\b(?:ast|aspartate aminotransferase)\b/i },
  { category: "albumin", pattern: /\balbumin\b/i },
  { category: "bun", pattern: /\b(?:bun|blood urea nitrogen)\b/i },
  { category: "egfr", pattern: /\b(?:egfr|gfr)\b/i },
  { category: "potassium", pattern: /\bpotassium\b/i },
  { category: "sodium", pattern: /\bsodium\b/i },
  { category: "calcium", pattern: /\bcalcium\b/i },
  { category: "mcv", pattern: /\bmcv\b/i },
  { category: "mch", pattern: /\bmch\b/i },
  { category: "mchc", pattern: /\bmchc\b/i },
  { category: "rdw", pattern: /\brdw(?:-cv)?\b/i },
  { category: "mpv", pattern: /\bmpv\b/i },
  { category: "neutrophils", pattern: /\bneutrophils?\b/i },
  { category: "lymphocytes", pattern: /\blymphocytes?\b/i },
  { category: "monocytes", pattern: /\bmonocytes?\b/i },
  { category: "eosinophils", pattern: /\beosinophils?\b/i },
  { category: "basophils", pattern: /\bbasophils?\b/i },
  { category: "bilirubin", pattern: /\bbilirubin\b/i },
  { category: "alkaline-phosphatase", pattern: /\b(?:alkaline phosphatase|alp)\b/i },
  { category: "urinalysis", pattern: /\b(?:urine|urinalysis)\b/i },
  { category: "pathology", pattern: /\b(?:pathology|biopsy|histology)\b/i },
];

const UNIT_PATTERN = /(?:mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)/i;
const VALUE_PATTERN = /(\d+(?:\.\d+)?)/;

function redactString(value: string) {
  let result = value;
  for (const rule of BLOCKED_PATTERNS) {
    result = result.replace(rule.pattern, `[REDACTED:${rule.id}]`);
  }
  return result;
}

function isPlaceholderExtract(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function scoreMedicalWindow(sample: string) {
  let score = 0;
  for (const pattern of MEDICAL_SIGNAL_PATTERNS) {
    if (pattern.test(sample)) score += 1;
  }
  for (const analyte of ANALYTE_DEFS) {
    if (analyte.pattern.test(sample)) score += 2;
  }
  if (/\b\d+(\.\d+)?\s*(mg\/dl|mmol\/l|g\/dl|iu\/l|meq\/l|ng\/ml|%)\b/i.test(sample)) score += 2;
  if (/\b(reference range|ref\.?\s*range|normal range|flag:)\b/i.test(sample)) score += 2;
  return score;
}

/** Scan head, tail, and sliding windows so lab tables buried after PDF boilerplate still score. */
function scoreMedicalContent(text: string) {
  const capped = text.slice(0, 120_000);
  if (!capped.trim()) return 0;

  const windowSize = 5000;
  const scores = [scoreMedicalWindow(capped.slice(0, windowSize))];
  if (capped.length > windowSize) {
    scores.push(scoreMedicalWindow(capped.slice(-windowSize)));
  }
  for (let start = 0; start < capped.length; start += 3500) {
    scores.push(scoreMedicalWindow(capped.slice(start, start + windowSize)));
    if (scores.length >= 10) break;
  }
  return Math.max(...scores);
}

/** Pull the most lab-dense sections out of long PDF extracts. */
function focusLabRichText(text: string) {
  const capped = text.slice(0, 120_000);
  if (capped.length <= 16_000) return capped;

  const windowSize = 7000;
  const step = 4500;
  const ranked: Array<{ start: number; score: number }> = [];
  for (let start = 0; start < capped.length; start += step) {
    ranked.push({ start, score: scoreMedicalWindow(capped.slice(start, start + windowSize)) });
  }
  ranked.sort((a, b) => b.score - a.score);

  const parts: string[] = [];
  const usedStarts = new Set<number>();
  for (const entry of ranked) {
    if (entry.score < 2 || parts.length >= 5) continue;
    if (usedStarts.has(entry.start)) continue;
    usedStarts.add(entry.start);
    parts.push(capped.slice(entry.start, entry.start + windowSize));
  }

  parts.push(capped.slice(-12_000));
  return parts.join("\n\n");
}

function logMedicalAnalysis(message: string, detail?: Record<string, unknown>) {
  if (detail) {
    console.log(`[MedicalAnalysis] ${message}`, detail);
    return;
  }
  console.log(`[MedicalAnalysis] ${message}`);
}

function normalizeOcrLines(text: string) {
  const rawLines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const lines = [...rawLines];
  for (const line of rawLines) {
    if (line.length > 90) {
      line
        .split(/(?<=[a-z])(?=[A-Z])|(?<=\d)\s+(?=[A-Za-z])/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter((part) => part.length >= 4)
        .forEach((part) => {
          if (!lines.includes(part)) lines.push(part);
        });
    }
  }
  return lines;
}

function extractNumericValue(context: string, analyteMatchIndex: number) {
  const tail = context.slice(analyteMatchIndex).replace(/^[^0-9%]+/i, "");
  const valueMatch = tail.match(/(\d+(?:\.\d+)?)/);
  if (!valueMatch) return undefined;
  const value = Number.parseFloat(valueMatch[1] ?? "");
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function extractValueFromNearbyLines(lines: string[], index: number) {
  const window = [lines[index - 1], lines[index], lines[index + 1], lines[index + 2]]
    .filter(Boolean)
    .join(" ");
  const inline = extractNumericValue(window, 0);
  if (inline !== undefined) return inline;
  for (const offset of [1, 2]) {
    const candidate = lines[index + offset] ?? "";
    const match = candidate.match(/^(\d+(?:\.\d+)?)\s*(?:mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|%)?/i);
    if (match) return Number.parseFloat(match[1] ?? "");
  }
  return undefined;
}

function classifyLabValue(value: number | undefined, context: string): string {
  const sample = context.replace(/\s+/g, " ");
  if (/\b(high|elevated|above|critical high|↑|\bH\b|\(\s*H\s*\))/i.test(sample)) return "above-reference";
  if (/\b(low|decreased|below|critical low|↓|\bL\b|\(\s*L\s*\))/i.test(sample)) return "below-reference";
  if (/\b(normal|within\s*range|wnl|non-?reactive)\b/i.test(sample)) return "normal";

  if (value !== undefined) {
    const lessThan = sample.match(/(?:ref(?:erence)?\.?\s*range[^0-9]{0,24})?(?:<|≤|under)\s*(\d+(?:\.\d+)?)/i)
      ?? sample.match(/(?:<|≤)\s*(\d+(?:\.\d+)?)/);
    if (lessThan) {
      const ref = Number.parseFloat(lessThan[1] ?? "");
      if (Number.isFinite(ref)) {
        if (value > ref) return "above-reference";
        return "normal";
      }
    }

    const greaterThan = sample.match(/(?:>|≥|over)\s*(\d+(?:\.\d+)?)/i);
    if (greaterThan) {
      const ref = Number.parseFloat(greaterThan[1] ?? "");
      if (Number.isFinite(ref)) {
        if (value < ref) return "below-reference";
        return "normal";
      }
    }

    const range = sample.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/);
    if (range) {
      const low = Number.parseFloat(range[1] ?? "");
      const high = Number.parseFloat(range[2] ?? "");
      if (Number.isFinite(low) && Number.isFinite(high)) {
        if (value < low) return "below-reference";
        if (value > high) return "above-reference";
        return "normal";
      }
    }
  }

  if (value !== undefined) return "measured";
  return "present";
}

function isPdfStructureNoise(text: string) {
  return /endstream|endobj|\bstream\b|\bxref\b|trailer|startxref|\/FlateDecode|\/Length\b|\/Filter\b|\d+\s+\d+\s+obj/i.test(
    text,
  );
}

function slugifyAnalyte(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isValidAnalyteCategory(category: string, label: string) {
  if (!category || category.length < 3) return false;
  if (/endstream|endobj|encoding|differences|glyph|font|matrix|width|height/i.test(category)) return false;
  if (/endstream|endobj/i.test(label)) return false;
  const words = label.match(/[a-zA-Z]{3,}/g) ?? [];
  if (!words.length) return false;
  if (words.every((word) => /^(stream|obj|endstream|endobj|type|font|null)$/i.test(word))) return false;
  const letters = (label.match(/[a-zA-Z]/g) ?? []).length;
  if (letters < 3) return false;
  return true;
}

function sanitizeFindings(findings: MedicalShareFinding[]) {
  return findings.filter((finding) =>
    isValidAnalyteCategory(finding.category, finding.category.replace(/-/g, " ")),
  );
}

function parseInlineAnalyteValue(line: string, matchIndex: number, matchLength: number) {
  const tail = line.slice(matchIndex + matchLength).replace(/^[\s:.-]+/, "");
  const inline = tail.match(/^(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?/i);
  if (inline) return Number.parseFloat(inline[1] ?? "");
  const spaced = tail.match(/[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?/i);
  if (spaced) return Number.parseFloat(spaced[1] ?? "");
  return undefined;
}

function parseColumnDelimitedLines(lines: string[]) {
  const findings: MedicalShareFinding[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (isPdfStructureNoise(line)) continue;
    const cols = line.split(/\t+| {2,}/).map((part) => part.trim()).filter(Boolean);
    if (cols.length < 2) continue;

    const label = cols[0] ?? "";
    if (/^(test|result|value|unit|reference|range|flag|date|page|lab|patient)/i.test(label)) continue;

    let value: number | undefined;
    let unit: string | undefined;
    for (let colIndex = 1; colIndex < cols.length; colIndex += 1) {
      const col = cols[colIndex] ?? "";
      const valueMatch = col.match(/^(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?$/i);
      if (valueMatch) {
        value = Number.parseFloat(valueMatch[1] ?? "");
        unit = valueMatch[2]?.toLowerCase();
        break;
      }
    }
    if (value === undefined || !Number.isFinite(value)) continue;

    const category = slugifyAnalyte(label);
    if (!isValidAnalyteCategory(category, label) || seen.has(category)) continue;
    const hasSignal =
      Boolean(unit) ||
      ANALYTE_DEFS.some((analyte) => analyte.pattern.test(label)) ||
      MEDICAL_SIGNAL_PATTERNS.some((pattern) => pattern.test(label));
    if (!hasSignal) continue;

    seen.add(category);
    const finding = buildFinding(category, value, `${line} ${lines[index + 1] ?? ""}`);
    if (unit) finding.unit = unit;
    findings.push(finding);
  }

  return findings;
}

function parseTabularLines(lines: string[]) {
  const findings: MedicalShareFinding[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const nextLine = lines[index + 1] ?? "";
    const nextValue = nextLine.match(/^(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?/i);
    if (!nextValue) continue;

    for (const analyte of ANALYTE_DEFS) {
      if (!analyte.pattern.test(line) || seen.has(analyte.category)) continue;

      const match = line.match(analyte.pattern);
      if (!match || match.index === undefined) continue;
      let value = parseInlineAnalyteValue(line, match.index, match[0].length);
      if (value === undefined && nextValue) {
        value = Number.parseFloat(nextValue[1] ?? "");
      }
      if (!Number.isFinite(value)) continue;
      const context = `${line} ${nextLine} ${lines[index + 2] ?? ""}`;
      seen.add(analyte.category);
      const finding = buildFinding(analyte.category, value, context);
      if (nextValue?.[2]) finding.unit = nextValue[2].toLowerCase();
      findings.push(finding);
    }

    const labelMatch = line.match(/^([A-Za-z][A-Za-z0-9\s,./\-()%]{2,48})$/);
    if (labelMatch) {
      const label = labelMatch[1]?.trim() ?? "";
      const value = Number.parseFloat(nextValue[1] ?? "");
      const category = slugifyAnalyte(label);
      if (!isValidAnalyteCategory(category, label) || seen.has(category) || !Number.isFinite(value)) continue;
      const context = `${line} ${nextLine}`;
      const hasSignal =
        UNIT_PATTERN.test(context) ||
        ANALYTE_DEFS.some((analyte) => analyte.pattern.test(label)) ||
        MEDICAL_SIGNAL_PATTERNS.some((pattern) => pattern.test(label));
      if (!hasSignal) continue;
      seen.add(category);
      findings.push(buildFinding(category, value, context));
    }
  }

  return findings;
}

function parseGenericLabLines(lines: string[]) {
  const findings: MedicalShareFinding[] = [];
  const seen = new Set<string>();
  const genericPattern =
    /^([A-Za-z][A-Za-z0-9\s,./\-()%]{2,48}?)(?:[\s:.-]+|\s+)(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const nextLine = lines[index + 1] ?? "";
    if (isPdfStructureNoise(line)) continue;
    const match = line.match(genericPattern);
    if (!match) continue;
    const label = match[1]?.trim() ?? "";
    const value = Number.parseFloat(match[2] ?? "");
    const unit = match[3]?.toLowerCase();
    if (!label || !Number.isFinite(value)) continue;
    if (/^(date|time|page|lab|patient|doctor|physician|report|result|test|value|unit|ref)/i.test(label)) continue;

    const category = slugifyAnalyte(label);
    if (!isValidAnalyteCategory(category, label) || seen.has(category)) continue;
    const context = `${line} ${nextLine}`;
    const hasUnit = UNIT_PATTERN.test(context) || Boolean(unit);
    const hasKnownTerm = ANALYTE_DEFS.some((analyte) => analyte.pattern.test(label)) || MEDICAL_SIGNAL_PATTERNS.some((p) => p.test(label));
    if (!hasUnit && !hasKnownTerm && value > 250) continue;

    seen.add(category);
    const finding = buildFinding(category, value, context);
    if (unit) finding.unit = unit;
    findings.push(finding);
  }
  return findings;
}

function parseAnalyteFromFullText(redacted: string) {
  const findings: MedicalShareFinding[] = [];
  const seen = new Set<string>();
  const fullTextPattern =
    /\b(total cholesterol|ldl(?:-c)?|hdl(?:-c)?|triglycerides?|hemoglobin|hematocrit|wbc|rbc|platelets?|glucose|creatinine|iron|uibc|transferrin saturation|ferritin|vitamin d|vitamin b-?12|tsh|alt|ast|albumin|bun|egfr|gfr|potassium|sodium|calcium|a1c|hba1c|mcv|mch|mchc|rdw|mpv|neutrophils?|lymphocytes?|monocytes?|eosinophils?|basophils?|bilirubin|alkaline phosphatase|alp)\b[^0-9\n]{0,48}(\d+(?:\.\d+)?)\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|ng\/ml|mcg\/dl|ug\/dl|meq\/l|pg\/ml|pmol\/l|fl|%)?/gi;

  let match: RegExpExecArray | null;
  while ((match = fullTextPattern.exec(redacted)) !== null) {
    const label = match[1] ?? "";
    const value = Number.parseFloat(match[2] ?? "");
    if (!label || !Number.isFinite(value)) continue;
    const category = slugifyAnalyte(label);
    if (!category || seen.has(category)) continue;
    const tail = redacted.slice(match.index, match.index + 160);
    seen.add(category);
    const finding = buildFinding(category, value, tail);
    if (match[3]) finding.unit = match[3].toLowerCase();
    findings.push(finding);
  }
  return findings;
}

function parseFindings(text: string) {
  const redacted = redactString(text);
  const lines = normalizeOcrLines(redacted).filter((line) => !isPdfStructureNoise(line));
  const findings: MedicalShareFinding[] = [];
  const seen = new Set<string>();

  const addFinding = (finding: MedicalShareFinding) => {
    if (!isValidAnalyteCategory(finding.category, finding.category.replace(/-/g, " "))) return;
    const merged = mergeFindingRecords(
      seen.has(finding.category) ? findings.find((item) => item.category === finding.category) : undefined,
      finding,
    );
    if (!seen.has(finding.category)) {
      seen.add(finding.category);
      findings.push(merged);
      return;
    }
    const index = findings.findIndex((item) => item.category === finding.category);
    if (index >= 0) findings[index] = merged;
  };

  for (const finding of parseAnalyteFromFullText(redacted)) addFinding(finding);
  for (const finding of parseColumnDelimitedLines(lines)) addFinding(finding);
  for (const finding of parseTabularLines(lines)) addFinding(finding);

  for (const analyte of ANALYTE_DEFS) {
    if (seen.has(analyte.category)) continue;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const match = line.match(analyte.pattern);
      if (!match || match.index === undefined) continue;

      const prevLine = lines[index - 1] ?? "";
      const nextLine = lines[index + 1] ?? "";
      const context = `${prevLine} ${line} ${nextLine} ${lines[index + 2] ?? ""}`.replace(/\s+/g, " ").trim();
      const value =
        parseInlineAnalyteValue(line, match.index, match[0].length) ??
        extractNumericValue(`${line} ${nextLine}`, line.toLowerCase().indexOf(match[0].toLowerCase())) ??
        extractValueFromNearbyLines(lines, index);

      addFinding(buildFinding(analyte.category, value, context));
      break;
    }
  }

  for (const finding of parseGenericLabLines(lines)) addFinding(finding);

  return { redacted, findings: sanitizeFindings(findings).slice(0, 64) };
}

function inferReportType(text: string): string {
  const joined = text.toLowerCase();
  if (/pathology|biopsy|histology|gene/.test(joined)) return "pathology-summary";
  if (/urine|urinalysis/.test(joined)) return "urinalysis";
  if (/x-?ray|radiology|mri|ct scan|ultrasound/.test(joined)) return "imaging-summary";
  if (/prescription|medication|rx\b/.test(joined)) return "medication-summary";
  if (/\b(cbc|hemoglobin|hematocrit|platelet|wbc|glucose|creatinine|cholesterol|iron|lipid)\b/.test(joined)) {
    return "blood-panel";
  }
  return "structured-medical";
}

async function extractTextFromFile(
  file: MedicalShareFile,
  options: { useQvacOcr: boolean; onProgress?: (status: string) => void },
): Promise<string> {
  const report = (status: string) => {
    options.onProgress?.(status);
  };
  const mimeType = file.mimeType ?? "";
  const lowerName = file.name.toLowerCase();

  if (mimeType.startsWith("text/") || lowerName.endsWith(".json") || lowerName.endsWith(".md") || lowerName.endsWith(".txt")) {
    try {
      return await FileSystem.readAsStringAsync(file.uri);
    } catch {
      return "";
    }
  }

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    try {
      report(`Scraping text from ${file.name}`);
      await yieldToUi(16);
      let text = await extractPdfText(file.uri);
      let quality = measureExtractedTextQuality(text);
      let findingCount = sanitizeFindings(parseFindings(text).findings).length;
      logMedicalAnalysis("pdf text scrape", {
        file: file.name,
        chars: text.length,
        quality,
        findingCount,
        head: text.slice(0, 180).replace(/\s+/g, " "),
        tail: text.slice(-180).replace(/\s+/g, " "),
      });

      const needsOcr = text.trim().length < 40 || isGarbagePdfExtract(text) || findingCount === 0;
      const partialOcr = !needsOcr && findingCount < 8;
      if (needsOcr || partialOcr) {
        report(partialOcr ? `Supplementing ${file.name} with OCR for more analytes` : `Running OCR on embedded pages in ${file.name}`);
        await yieldToUi(16);
        const ocrText = await extractPdfTextViaOcr(file.uri, {
          useQvacOcr: options.useQvacOcr,
          onPageProgress: (current, total) => report(`OCR page ${current} of ${total} · ${file.name}`),
        });
        const ocrQuality = measureExtractedTextQuality(ocrText);
        const ocrFindingCount = sanitizeFindings(parseFindings(ocrText).findings).length;
        logMedicalAnalysis("pdf OCR fallback", {
          file: file.name,
          scrapeChars: text.length,
          ocrChars: ocrText.length,
          scrapeQuality: quality,
          ocrQuality,
          scrapeFindings: findingCount,
          ocrFindings: ocrFindingCount,
        });
        if (ocrText.trim() && (ocrQuality > quality || ocrFindingCount > findingCount || isGarbagePdfExtract(text) || partialOcr)) {
          text = partialOcr && text.trim() && !isGarbagePdfExtract(text) ? `${text}\n\n${ocrText}` : ocrText;
          quality = Math.max(quality, ocrQuality);
          findingCount = sanitizeFindings(parseFindings(text).findings).length;
        } else if (ocrText.trim() && text.trim() && !isGarbagePdfExtract(text)) {
          text = `${text}\n\n${ocrText}`;
          quality = Math.max(quality, ocrQuality);
          findingCount = sanitizeFindings(parseFindings(text).findings).length;
        }
      }

      return text;
    } catch (error) {
      logMedicalAnalysis("pdf extract failed", {
        file: file.name,
        detail: error instanceof Error ? error.message : String(error),
      });
      return "";
    }
  }

  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(lowerName)) {
    try {
      report(`Running OCR on ${file.name}`);
      await yieldToUi(16);
      return await extractImageText(file.uri, { preferMlKit: true, useQvacOcr: options.useQvacOcr });
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  return "";
}

async function validateMedicalContentWithModel(model: RuntimeModel, excerpt: string): Promise<boolean> {
  const focused = focusLabRichText(excerpt);
  const sample = focused.slice(0, 2400);
  const prompt = [
    "Is this excerpt from a medical/clinical/lab document?",
    "Reply YES or NO only.",
    sample,
  ].join("\n\n");
  try {
    const { sendLocalAgentMessage } = await import("./qvacClient");
    const result = await Promise.race([
      sendLocalAgentMessage(model, prompt, "Reply YES or NO only."),
      new Promise<{ ok: false; detail: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, detail: "timeout" }), 8000),
      ),
    ]);
    if (!result.ok) return false;
    return result.detail.trim().toUpperCase().startsWith("YES");
  } catch {
    return false;
  }
}

async function assertMedicalDocument(
  combined: string,
  options: { model?: RuntimeModel | null; findingsCount?: number },
) {
  if (options.findingsCount && options.findingsCount > 0) return;

  if (isPlaceholderExtract(combined)) {
    throw new Error(
      "Could not read medical content from this file. Try a clearer scan or a PDF with selectable text.",
    );
  }

  const focused = focusLabRichText(combined);
  const score = Math.max(scoreMedicalContent(combined), scoreMedicalContent(focused));
  logMedicalAnalysis("validation score", {
    combinedChars: combined.length,
    focusedChars: focused.length,
    score,
    findingsCount: options.findingsCount ?? 0,
    focusedHead: focused.slice(0, 160).replace(/\s+/g, " "),
  });

  if (score >= 3) return;

  if (options.model && score >= 1) {
    const modelSaysMedical = await validateMedicalContentWithModel(options.model, combined);
    logMedicalAnalysis("model medical validation", { accepted: modelSaysMedical, score });
    if (modelSaysMedical) return;
  }

  throw new Error(
    "This file does not appear to contain medical information. Upload a lab report, prescription summary, imaging report, or clinical note.",
  );
}

export async function analyzeMedicalFiles(
  files: MedicalShareFile[],
  options: { useQvacOcr: boolean; model?: RuntimeModel | null },
  onProgress?: (progress: MedicalAnalysisProgress) => void,
): Promise<MedicalSharePreview> {
  if (!files.length) {
    throw new Error("Pick at least one medical document before analysis.");
  }

  const chunks: string[] = [];
  for (const [fileIndex, file] of files.entries()) {
    onProgress?.({
      chunkIndex: fileIndex,
      chunkTotal: files.length,
      findings: [],
      status: `Reading ${file.name}`,
    });
    await yieldToUi(16);
    const text = await extractTextFromFile(file, {
      ...options,
      onProgress: (status) => {
        onProgress?.({
          chunkIndex: fileIndex,
          chunkTotal: files.length,
          findings: [],
          status,
        });
      },
    });
    if (text.trim() && !isPlaceholderExtract(text)) {
      chunks.push(`--- ${file.name} ---\n${text.slice(0, 120_000)}`);
    }
  }

  const combined = chunks.join("\n\n");
  if (!combined.trim()) {
    throw new Error(
      "Could not extract readable text from the selected files. For scanned PDFs, try exporting a screenshot or image with visible clinical text.",
    );
  }

  const focused = focusLabRichText(combined);
  const combinedChunks = splitTextIntoChunks(combined);
  const focusedChunks = focused !== combined ? splitTextIntoChunks(focused) : [];
  const parseChunks = [...combinedChunks, ...focusedChunks];
  const findingsMap = new Map<string, MedicalShareFinding>();

  onProgress?.({
    chunkIndex: 0,
    chunkTotal: parseChunks.length,
    findings: [],
    status: `Parsing ${parseChunks.length} text section${parseChunks.length === 1 ? "" : "s"}`,
  });
  await yieldToUi(16);

  for (let index = 0; index < parseChunks.length; index += 1) {
    const chunkFindings = parseFindings(parseChunks[index] ?? "").findings;
    for (const finding of chunkFindings) {
      findingsMap.set(finding.category, mergeFindingRecords(findingsMap.get(finding.category), finding));
    }
    onProgress?.({
      chunkIndex: index + 1,
      chunkTotal: parseChunks.length,
      findings: [...findingsMap.values()],
      status: `Analyzed section ${index + 1} of ${parseChunks.length} · ${findingsMap.size} analyte${findingsMap.size === 1 ? "" : "s"}`,
    });
    await yieldToUi(onProgress ? 40 : 0);
  }

  for (const finding of parseFindings(`${combined}\n\n${focused}`).findings) {
    findingsMap.set(finding.category, mergeFindingRecords(findingsMap.get(finding.category), finding));
  }

  let findings = [...findingsMap.values()].slice(0, 64);

  logMedicalAnalysis("parse summary", {
    combinedChars: combined.length,
    focusedChars: focused.length,
    chunks: parseChunks.length,
    findings: findings.length,
    categories: findings.map((finding) => finding.category),
  });

  await assertMedicalDocument(combined, { model: options.model, findingsCount: findings.length });

  const { redacted } = parseFindings(focused.length > 0 ? `${combined}\n\n${focused}` : combined);
  if (!findings.length) {
    throw new Error(
      "The document was read locally but no structured medical findings could be extracted. Try a lab report or clinical summary with test names and values.",
    );
  }

  const reportType = inferReportType(redacted);
  const blockedHit = BLOCKED_PATTERNS.some((rule) => rule.pattern.test(combined));
  const summaryParts = [
    `Extracted from ${files.length} file${files.length === 1 ? "" : "s"} locally.`,
    `Structured ${findings.length} analyte${findings.length === 1 ? "" : "s"} from document text.`,
    blockedHit ? "Personal identifiers were redacted before review." : "No obvious identifier patterns detected in extracted text.",
    "Names, IDs, exact dates, clinicians, and facilities are excluded from Hive shares.",
  ];

  return {
    reportType,
    findings,
    summary: summaryParts.join(" "),
  };
}

export type MedicalSharePayload = {
  reportType: string;
  findings: MedicalSharePreview["findings"];
  summary: string;
  sourceFileCount: number;
  sourceFileNames: string[];
  redactedExcerpt: string;
};

export function buildMedicalSharePayload(files: MedicalShareFile[], preview: MedicalSharePreview): MedicalSharePayload {
  const safeNames = files.map((file) => redactString(file.name));
  return {
    reportType: preview.reportType,
    findings: preview.findings,
    summary: preview.summary,
    sourceFileCount: files.length,
    sourceFileNames: safeNames,
    redactedExcerpt: preview.summary.slice(0, 512),
  };
}
