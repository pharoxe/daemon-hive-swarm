import {
  Accelerometer,
  Barometer,
  DeviceMotion,
  Gyroscope,
  LightSensor,
  Magnetometer,
  Pedometer,
} from "expo-sensors";

function roundBucket(value: number, step: number) {
  return Math.round(value / step) * step;
}

function subscribeSample<T>(
  sensor: {
    setUpdateInterval: (ms: number) => void;
    addListener: (callback: (data: T) => void) => { remove: () => void };
  },
  ms = 320,
): Promise<T | null> {
  return new Promise((resolve) => {
    let latest: T | null = null;
    sensor.setUpdateInterval(100);
    const subscription = sensor.addListener((data) => {
      latest = data;
    });
    setTimeout(() => {
      subscription.remove();
      resolve(latest);
    }, ms);
  });
}

async function available(check: () => Promise<boolean>) {
  try {
    return await check();
  } catch {
    return false;
  }
}

export async function collectSensorPayload(datasetId: string): Promise<Record<string, unknown> | undefined> {
  if (datasetId === "motion-imu") {
    const [accel, gyro, motion] = await Promise.all([
      available(() => Accelerometer.isAvailableAsync()).then((ok) => (ok ? subscribeSample(Accelerometer) : null)),
      available(() => Gyroscope.isAvailableAsync()).then((ok) => (ok ? subscribeSample(Gyroscope) : null)),
      available(() => DeviceMotion.isAvailableAsync()).then((ok) => (ok ? subscribeSample(DeviceMotion) : null)),
    ]);
    if (!accel && !gyro && !motion) return undefined;
    return {
      accelerationBucket: accel
        ? {
            x: roundBucket((accel as { x?: number }).x ?? 0, 0.05),
            y: roundBucket((accel as { y?: number }).y ?? 0, 0.05),
            z: roundBucket((accel as { z?: number }).z ?? 0, 0.05),
          }
        : null,
      rotationRateBucket: gyro
        ? {
            x: roundBucket((gyro as { x?: number }).x ?? 0, 0.02),
            y: roundBucket((gyro as { y?: number }).y ?? 0, 0.02),
            z: roundBucket((gyro as { z?: number }).z ?? 0, 0.02),
          }
        : null,
      orientationClass: motion ? "sampled" : "unknown",
      samplingQuality: accel || gyro ? "live-sample" : "unavailable",
    };
  }

  if (datasetId === "activity-pedometer") {
    const ok = await available(() => Pedometer.isAvailableAsync());
    if (!ok) return undefined;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      const steps = await Pedometer.getStepCountAsync(start, end);
      return {
        stepCountBucket: roundBucket(steps.steps ?? 0, 50),
        cadenceBucket: steps.steps && steps.steps > 200 ? "active" : "resting",
        hourBand: `${end.getUTCHours()}h-utc`,
      };
    } catch {
      return { stepCountBucket: 0, cadenceBucket: "unknown", hourBand: "unknown" };
    }
  }

  if (datasetId === "environment-context") {
    const [light, baro, mag] = await Promise.all([
      available(() => LightSensor.isAvailableAsync()).then((ok) => (ok ? subscribeSample(LightSensor) : null)),
      available(() => Barometer.isAvailableAsync()).then((ok) => (ok ? subscribeSample(Barometer) : null)),
      available(() => Magnetometer.isAvailableAsync()).then((ok) => (ok ? subscribeSample(Magnetometer) : null)),
    ]);
    if (!light && !baro && !mag) return undefined;
    return {
      lightBucket: light ? roundBucket((light as { illuminance?: number }).illuminance ?? 0, 50) : null,
      pressureTrend: baro ? roundBucket((baro as { pressure?: number }).pressure ?? 0, 5) : null,
      headingStability: mag ? "sampled" : "unknown",
    };
  }

  return undefined;
}
