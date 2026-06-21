import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { RuntimeModel } from "../runtime/modelManifest";
import { analyzeMedicalFiles, formatMedicalFinding } from "../runtime/medicalAnalysis";
import { confirmDaemonDialog } from "./daemonDialogHost";
import { InferenceDotMatrix } from "./InferenceDotMatrix";
import { TypewriterStatus } from "./TypewriterStatus";
import { colors, typography } from "../theme";
import { GlyphIcon } from "../icons";

export type MedicalShareFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type MedicalShareFinding = {
  category: string;
  value?: string;
  unit?: string;
  rangeBucket: string;
};

export type MedicalSharePreview = {
  reportType: string;
  findings: MedicalShareFinding[];
  summary: string;
};

export type MedicalAnalysisProgress = {
  chunkIndex: number;
  chunkTotal: number;
  findings: MedicalShareFinding[];
  status: string;
};

type MedicalShareWizardProps = {
  visible: boolean;
  busy?: boolean;
  useQvacOcr?: boolean;
  analysisModel?: RuntimeModel | null;
  onClose: () => void;
  onComplete: (files: MedicalShareFile[], preview: MedicalSharePreview) => boolean | void | Promise<boolean | void>;
};

const steps = ["Pick files", "Analyze", "Review", "Share"] as const;

const analysisStatusLines = [
  "Extracting text from your documents",
  "Running on-device OCR when needed",
  "Applying de-identification checks",
  "No raw document text leaves your phone",
];

export function MedicalShareWizard({
  visible,
  busy = false,
  useQvacOcr = false,
  analysisModel = null,
  onClose,
  onComplete,
}: MedicalShareWizardProps) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<MedicalShareFile[]>([]);
  const [preview, setPreview] = useState<MedicalSharePreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [partialFindings, setPartialFindings] = useState<MedicalSharePreview["findings"]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const showLiveProgress = Boolean(analysisProgress && analyzing);

  const reset = () => {
    setStep(0);
    setFiles([]);
    setPreview(null);
    setAnalyzing(false);
    setAnalysisError(null);
    setAnalysisProgress(null);
    setPartialFindings([]);
    setShareError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runAnalysis = async (source: MedicalShareFile[]) => {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress("Preparing document");
    setPartialFindings([]);
    try {
      const result = await analyzeMedicalFiles(source, { useQvacOcr, model: analysisModel }, (progress) => {
        setAnalysisProgress(progress.status);
        setPartialFindings(progress.findings);
      });
      setPreview(result);
      setPartialFindings(result.findings);
      setStep(2);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setAnalysisError(detail);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "text/plain"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const picked = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name ?? "document",
      mimeType: asset.mimeType,
      size: asset.size,
    }));
    setFiles(picked);
    setStep(1);
    await runAnalysis(picked);
  };

  const confirmShare = async () => {
    if (!preview) return;
    const confirmed = await confirmDaemonDialog(
      "Share Medical Record",
      `Share ${preview.findings.length} anonymized analyte${preview.findings.length === 1 ? "" : "s"} to the Hive medical-reports dataset? No raw document text will leave this device.`,
      "Share with Hive",
    );
    if (!confirmed) return;
    setShareError(null);
    try {
      const ok = await onComplete(files, preview);
      if (ok !== false) close();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setShareError(detail);
    }
  };

  const stepLabel = useMemo(() => steps[step] ?? steps[0], [step]);

  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  useEffect(() => {
    if (!analyzing) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [analysisProgress, partialFindings.length, analyzing]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.kicker}>MEDICAL DATA SHARE</Text>
            <Text style={styles.title}>{stepLabel}</Text>
            <View style={styles.stepRow}>
              {steps.map((label, index) => (
                <View key={label} style={[styles.stepDot, index <= step ? styles.stepDotActive : null]} />
              ))}
            </View>
          </View>

          <ScrollView ref={scrollRef} style={styles.body} showsVerticalScrollIndicator={false}>
            {step === 0 ? (
              <>
                <Text style={styles.copy}>
                  Select the medical documents your local agent should process. Files stay on-device until you approve the anonymized summary.
                </Text>
                <Pressable style={styles.pickBox} onPress={() => void pickFiles()}>
                  <GlyphIcon glyph="FS" color={colors.accent} size={16} />
                  <Text style={styles.pickLabel}>Choose PDF, image, or text reports</Text>
                </Pressable>
              </>
            ) : null}

            {step === 1 ? (
              <View style={styles.stepStack}>
                <Text style={styles.copy}>Analyzing locally with OCR when needed. Only structured, de-identified fields will be prepared for the swarm dataset.</Text>
                {files.map((file) => (
                  <View key={file.uri} style={styles.fileRow}>
                    <GlyphIcon glyph="FS" size={12} />
                    <Text style={styles.fileName}>{file.name}</Text>
                  </View>
                ))}
                {analyzing || busy ? (
                  <View style={styles.analysisPanel}>
                    <InferenceDotMatrix size={22} />
                    {showLiveProgress ? (
                      <Text style={styles.analysisStatusLive}>{analysisProgress}</Text>
                    ) : (
                      <TypewriterStatus lines={analysisStatusLines} style={styles.analysisStatus} charIntervalMs={28} holdMs={2400} />
                    )}
                  </View>
                ) : null}
                {partialFindings.length ? (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>
                      Extracted analytes ({partialFindings.length}{analyzing ? " · updating" : ""})
                    </Text>
                    {partialFindings.map((finding, findingIndex) => (
                      <View key={`${finding.category}-${findingIndex}`} style={styles.findingRow}>
                        <Text style={styles.findingCategory}>{formatMedicalFinding(finding)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {analysisError ? <Text style={styles.errorText}>{analysisError}</Text> : null}
              </View>
            ) : null}

            {step === 2 && preview ? (
              <>
                <Text style={styles.copy}>Review the anonymized fields extracted from your files before broadcasting to the Hive medical-reports dataset.</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>Report type</Text>
                  <Text style={styles.previewValue}>{preview.reportType}</Text>
                  {preview.findings.map((finding, findingIndex) => (
                    <View key={`${finding.category}-${findingIndex}`} style={styles.findingRow}>
                      <Text style={styles.findingCategory}>{formatMedicalFinding(finding)}</Text>
                    </View>
                  ))}
                  <Text style={styles.previewNote}>{preview.summary}</Text>
                </View>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={styles.copy}>Ready to broadcast de-identified records to the swarm. No raw document text will leave this device.</Text>
                {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}
                {busy ? (
                  <View style={styles.analysisPanel}>
                    <InferenceDotMatrix size={22} />
                    <Text style={styles.progressText}>Sharing with Hive…</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={close} style={styles.secondaryBtn}>
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
            {step === 0 ? null : step === 1 ? (
              <Pressable
                disabled={analyzing || busy || files.length === 0}
                onPress={() => void runAnalysis(files)}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryLabel}>{analyzing ? "Analyzing…" : analysisError ? "Retry analysis" : "Analyze locally"}</Text>
              </Pressable>
            ) : step === 2 ? (
              <Pressable onPress={() => setStep(3)} style={styles.primaryBtn}>
                <Text style={styles.primaryLabel}>Continue</Text>
              </Pressable>
            ) : (
              <Pressable disabled={busy} onPress={() => void confirmShare()} style={styles.primaryBtn}>
                <Text style={styles.primaryLabel}>{busy ? "Sharing…" : "Share with Hive"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "88%",
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kicker: {
    color: colors.accentTertiary,
    fontFamily: typography.mono,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.foreground,
    fontFamily: typography.heading,
    fontSize: 22,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  stepDot: {
    width: 28,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
  },
  body: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    maxHeight: 520,
  },
  stepStack: {
    gap: 16,
  },
  copy: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 20,
  },
  pickBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  pickLabel: {
    color: colors.foreground,
    fontFamily: typography.button,
    fontSize: 13,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fileName: {
    color: colors.foreground,
    fontFamily: typography.body,
    fontSize: 12,
    flex: 1,
  },
  analysisPanel: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  analysisStatus: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  analysisStatusLive: {
    color: colors.accent,
    fontFamily: typography.mono,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  progressText: {
    color: colors.accent,
    fontFamily: typography.mono,
    fontSize: 11,
    textAlign: "center",
  },
  errorText: {
    color: colors.destructive,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  previewLabel: {
    color: colors.mutedForeground,
    fontFamily: typography.mono,
    fontSize: 10,
  },
  previewValue: {
    color: colors.foreground,
    fontFamily: typography.heading,
    fontSize: 16,
    marginBottom: 6,
  },
  findingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  findingCategory: {
    color: colors.foreground,
    fontFamily: typography.body,
    fontSize: 12,
  },
  findingBucket: {
    color: colors.accent,
    fontFamily: typography.mono,
    fontSize: 11,
  },
  previewNote: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryLabel: {
    color: colors.mutedForeground,
    fontFamily: typography.button,
    fontSize: 13,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryLabel: {
    color: colors.background,
    fontFamily: typography.button,
    fontSize: 13,
  },
});
