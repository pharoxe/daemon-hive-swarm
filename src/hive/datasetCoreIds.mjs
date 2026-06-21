/** Hive dataset ids — one Hypercore per id under Corestore. */
export const HIVE_DATASET_IDS = [
  "motion-imu",
  "activity-pedometer",
  "environment-context",
  "network-quality",
  "device-performance",
  "app-usage-preferences",
  "medical-reports",
];

export function datasetCoreName(datasetId) {
  return `hive-dataset-${datasetId}`;
}
