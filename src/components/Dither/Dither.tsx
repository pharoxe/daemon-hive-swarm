/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import { StyleSheet, View } from "react-native";
import { colors } from "../../theme";

export type VoiceOrbPhase = "initializing" | "listening" | "processing" | "speaking" | "idle";

type DitherProps = {
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: [number, number, number];
  colorNum?: number;
  pixelSize?: number;
  disableAnimation?: boolean;
  /** 0–1 microphone / speech energy for audio-reactive displacement */
  audioLevel?: number;
  /** Boot progress while voice models load (0–1). */
  initProgress?: number;
  phase?: VoiceOrbPhase;
};

const vertexShader = `
precision highp float;
varying vec3 vNormal;
varying vec2 vUv;
uniform float uTime;
uniform float uAudio;
uniform float uInit;
uniform float uWaveAmp;
uniform float uWaveFreq;

void main() {
  vNormal = normal;
  vUv = uv;
  float shell = 0.04 + uAudio * 0.22;
  float ripple = sin(uTime * 2.6 + position.y * uWaveFreq + position.x * 1.7) * shell;
  float breathe = sin(uTime * 1.1) * 0.03 * uInit;
  vec3 displaced = position + normal * (ripple + breathe) * uInit;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec3 vNormal;
varying vec2 vUv;
uniform float uTime;
uniform float uAudio;
uniform float uInit;
uniform vec3 uWaveColor;
uniform float uColorNum;
uniform float uPixelSize;
uniform vec2 uResolution;

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * uResolution / uPixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / max(uColorNum - 1.0, 1.0);
  color += threshold * step;
  color = clamp(color - 0.12, 0.0, 1.0);
  return floor(color * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
}

void main() {
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
  float band = 0.5 + 0.5 * sin(uTime * 1.8 + n.y * 8.0 + n.x * 5.0 + uAudio * 6.0);
  vec3 core = mix(vec3(0.02, 0.05, 0.12), uWaveColor, band * (0.55 + uAudio * 0.45));
  vec3 rim = mix(uWaveColor, vec3(0.92, 0.78, 0.62), fresnel);
  vec3 col = mix(core, rim, 0.35 + uAudio * 0.35) * (0.35 + uInit * 0.65);
  col = dither(gl_FragCoord.xy, col);
  gl_FragColor = vec4(col, 0.95);
}
`;

function SiriOrbMesh({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  colorNum,
  pixelSize,
  disableAnimation,
  audioLevel,
  initProgress,
  phase,
}: Required<
  Pick<
    DitherProps,
    | "waveSpeed"
    | "waveFrequency"
    | "waveAmplitude"
    | "waveColor"
    | "colorNum"
    | "pixelSize"
    | "disableAnimation"
    | "audioLevel"
    | "initProgress"
    | "phase"
  >
>) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uInit: { value: 0 },
      uWaveAmp: { value: waveAmplitude },
      uWaveFreq: { value: waveFrequency },
      uWaveColor: { value: new THREE.Color(...waveColor) },
      uColorNum: { value: colorNum },
      uPixelSize: { value: pixelSize },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    [colorNum, pixelSize, size.height, size.width, waveAmplitude, waveColor, waveFrequency],
  );

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat?.uniforms?.uResolution?.value) return;
    mat.uniforms.uResolution.value.set(size.width, size.height);
  }, [size.height, size.width]);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat?.uniforms) return;
    const u = mat.uniforms;
    const t = disableAnimation ? 0 : clock.getElapsedTime();
    if (u.uTime) u.uTime.value = t * (waveSpeed * 20 + (phase === "initializing" ? 0.8 : 0));
    if (u.uAudio) {
      u.uAudio.value = THREE.MathUtils.lerp(u.uAudio.value, audioLevel, 0.18);
    }
    const targetInit =
      phase === "initializing" ? Math.max(0.15, initProgress) : Math.min(1, 0.35 + initProgress * 0.65);
    if (u.uInit) {
      u.uInit.value = THREE.MathUtils.lerp(u.uInit.value, targetInit, 0.08);
    }
  });

  const scale =
    phase === "initializing"
      ? 0.55 + initProgress * 0.45
      : phase === "speaking"
        ? 1.02 + audioLevel * 0.12
        : 0.92 + audioLevel * 0.18;

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[1.35, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

function OrbScene(props: Required<
  Pick<
    DitherProps,
    | "waveSpeed"
    | "waveFrequency"
    | "waveAmplitude"
    | "waveColor"
    | "colorNum"
    | "pixelSize"
    | "disableAnimation"
    | "audioLevel"
    | "initProgress"
    | "phase"
  >
>) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 3, 4]} intensity={1.4} color="#c6b19b" />
      <pointLight position={[-3, -1, 2]} intensity={0.8} color="#8f3f24" />
      <SiriOrbMesh {...props} />
    </>
  );
}

export default function Dither({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.76, 0.42, 0.23],
  colorNum = 5,
  pixelSize = 2,
  disableAnimation = false,
  audioLevel = 0,
  initProgress = 1,
  phase = "idle",
}: DitherProps) {
  return (
    <View style={styles.container}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 42 }} gl={{ antialias: true }}>
        <OrbScene
          waveSpeed={waveSpeed}
          waveFrequency={waveFrequency}
          waveAmplitude={waveAmplitude}
          waveColor={waveColor}
          colorNum={colorNum}
          pixelSize={pixelSize}
          disableAnimation={disableAnimation}
          audioLevel={audioLevel}
          initProgress={initProgress}
          phase={phase}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
  },
});
