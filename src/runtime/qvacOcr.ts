import { runtimeModels } from "./modelManifest";
import { loadQvacModel } from "./qvacClient";

function modelIdFromLoadDetail(detail: string) {
  return detail
    .replace("Loaded model instance: ", "")
    .split(/\s+(?:via|\()/i)[0]!
    .trim();
}

function fileUriToPath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

export async function runQvacOcrPreview(imageUri: string) {
  const model = runtimeModels.find((candidate) => candidate.id === "qvac-latin-ocr");
  if (!model) throw new Error("Missing QVAC OCR model manifest entry.");

  const loadResult = await loadQvacModel(model);
  if (!loadResult.ok) throw new Error(loadResult.detail);

  const { ocr } = await import("@qvac/sdk");
  const run = ocr({
    modelId: modelIdFromLoadDetail(loadResult.detail),
    image: fileUriToPath(imageUri),
    options: { paragraph: false },
  });
  const [blocks, stats] = await Promise.all([run.blocks, run.stats.catch(() => undefined)]);
  const text = blocks
    .map((block) => block.text)
    .filter(Boolean)
    .join("\n")
    .slice(0, 3000);

  return JSON.stringify(
    {
      provider: "QVAC OCR",
      ocrText: text || "No text recognized.",
      blocks: blocks.slice(0, 12).map((block) => ({
        text: block.text,
        confidence: block.confidence,
        bbox: block.bbox,
      })),
      stats,
    },
    null,
    2,
  );
}
