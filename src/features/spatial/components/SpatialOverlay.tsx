import { Canvas, type RootState } from "@react-three/fiber/native";
import { DeviceMotion } from "expo-sensors";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  QuadraticBezierCurve3,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  createCenteredAlignmentSquare,
  normalizedPointToWorldPoint,
  worldPointToScreenPoint,
  type AlignmentSquare,
  type ViewportSize,
} from "../lib/alignment";
import {
  resolveLabelScreenPoint,
  type SpatialOverlayAnchorMode,
} from "../lib/anchor-mode";
import {
  createWorldLockedCameraOrientation,
  type DeviceRotation,
  type WorldLockedCameraOrientation,
} from "../lib/device-orientation";
import {
  type NormalizedPoint,
  parseSpatialOverlayPrimitives,
  type SpatialOverlayPrimitive,
} from "../lib/overlay-primitives";
import type { WireframeGeometry } from "../../model-preview";

const cameraFovDegrees = 55;
// design.md AR annotations: teal guide strokes, legible over any camera feed.
const overlayColor = 0x3ed0b4;
const defaultAnchorDistance = 2;

type SceneInputs = {
  primitives: SpatialOverlayPrimitive[];
  wireframe: WireframeGeometry | null;
  alignmentSquare?: AlignmentSquare;
  anchorDistance: number;
  anchorMode: SpatialOverlayAnchorMode;
};

type WorldLabel = {
  key: string;
  text: string;
  point: NormalizedPoint;
  position: Vector3;
};

type ProjectedLabel = {
  key: string;
  text: string;
  x: number;
  y: number;
};

type OverlaySceneState = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  overlayGroup: Group;
  labels: WorldLabel[];
  viewport: ViewportSize;
  alignmentSquare: AlignmentSquare;
  anchorMode: SpatialOverlayAnchorMode;
};

type DisposableObject = {
  geometry?: { dispose(): void };
  material?: { dispose(): void } | { dispose(): void }[];
};

export type SpatialOverlayProps = {
  /** Untrusted tool-call payloads are accepted and invalid primitives are ignored. */
  primitives?: readonly unknown[];
  /** `world` uses DeviceMotion, while `screen` stays fixed to camera pixels. */
  anchorMode?: SpatialOverlayAnchorMode;
  /** Optional validated local shape from the planner, rendered as transparent lines. */
  wireframe?: WireframeGeometry | null;
  /** Local coordinates of the visible square the learner aligns their work to. */
  alignmentSquare?: AlignmentSquare;
  /** Distance from the initial camera pose to the fixed annotation plane. */
  anchorDistance?: number;
  style?: StyleProp<ViewStyle>;
  onMotionAvailabilityChange?: (available: boolean) => void;
};

function hasUsableViewport({ width, height }: ViewportSize): boolean {
  return width > 0 && height > 0;
}

function normalizedAnchorDistance(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : defaultAnchorDistance;
}

function disposeOverlayGroup(group: Group): void {
  group.traverse((object) => {
    const disposable = object as typeof object & DisposableObject;
    disposable.geometry?.dispose();

    if (Array.isArray(disposable.material)) {
      disposable.material.forEach((material) => material.dispose());
    } else {
      disposable.material?.dispose();
    }
  });

  group.clear();
}

function applyAnchorMode(
  state: OverlaySceneState,
  anchorMode: SpatialOverlayAnchorMode,
): void {
  if (state.anchorMode === anchorMode) {
    return;
  }

  state.overlayGroup.removeFromParent();

  if (anchorMode === "screen") {
    state.camera.add(state.overlayGroup);
  } else {
    state.scene.add(state.overlayGroup);
  }

  state.anchorMode = anchorMode;
}

// GL renders classic lines at 1px regardless of linewidth, which is unreadable
// over a live camera feed. Strokes are therefore built from solid geometry.
const strokeRadius = 0.024;
const upAxis = new Vector3(0, 1, 0);

function overlayMaterial(opacity = 0.95): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: overlayColor, transparent: true, opacity });
}

function addStroke(group: Group, from: Vector3, to: Vector3, opacity = 0.95): void {
  const direction = to.clone().sub(from);
  const length = direction.length();

  if (length <= Number.EPSILON) {
    return;
  }

  const shaft = new Mesh(
    new CylinderGeometry(strokeRadius, strokeRadius, length, 10),
    overlayMaterial(opacity),
  );
  shaft.position.copy(from.clone().add(to).multiplyScalar(0.5));
  shaft.quaternion.setFromUnitVectors(upAxis, direction.normalize());
  group.add(shaft);
}

function addArrowHead(group: Group, tip: Vector3, direction: Vector3): void {
  const headLength = 0.18;
  const head = new Mesh(
    new ConeGeometry(headLength * 0.55, headLength, 14),
    overlayMaterial(),
  );
  head.position.copy(tip.clone().sub(direction.clone().multiplyScalar(headLength / 2)));
  head.quaternion.setFromUnitVectors(upAxis, direction);
  group.add(head);
}

function addArrow(group: Group, from: Vector3, to: Vector3): void {
  const direction = to.clone().sub(from);
  const length = direction.length();

  if (length <= Number.EPSILON) {
    return;
  }

  direction.normalize();
  const headLength = 0.18;
  const shaftEnd = to.clone().sub(direction.clone().multiplyScalar(headLength * 0.72));
  addStroke(group, from, shaftEnd);
  addArrowHead(group, to, direction);
}

function addFoldCurve(group: Group, from: Vector3, to: Vector3): void {
  const direction = to.clone().sub(from);
  const length = direction.length();

  if (length <= Number.EPSILON) {
    return;
  }

  const perpendicular = new Vector3(-direction.y, direction.x, 0).normalize();
  const control = from
    .clone()
    .add(to)
    .multiplyScalar(0.5)
    .add(perpendicular.multiplyScalar(Math.min(0.4, length * 0.4)));
  const curve = new QuadraticBezierCurve3(from, control, to);
  group.add(new Mesh(new TubeGeometry(curve, 24, strokeRadius, 8), overlayMaterial()));

  const tangent = curve.getTangent(1).normalize();
  addArrowHead(group, curve.getPoint(1), tangent);
}

function addWireframe(group: Group, wireframe: WireframeGeometry): void {
  if (wireframe.positions.length === 0) {
    return;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([...wireframe.positions], 3),
  );
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: 0x4c8dff,
      transparent: true,
      opacity: 0.72,
    }),
  );

  // The planner emits a rough local shape around its origin. Keep that subtle
  // preview inside the camera's world plane instead of covering the guidance.
  lines.scale.setScalar(0.32);
  lines.position.set(-0.16, -0.16, 0.04);
  group.add(lines);
}

function buildOverlayGeometry(state: OverlaySceneState, inputs: SceneInputs): void {
  disposeOverlayGroup(state.overlayGroup);
  state.labels = [];

  if (!hasUsableViewport(state.viewport)) {
    return;
  }

  const square =
    inputs.alignmentSquare ?? createCenteredAlignmentSquare(state.viewport);
  state.alignmentSquare = square;
  applyAnchorMode(state, inputs.anchorMode);

  if (inputs.anchorMode === "world") {
    // Latch new geometry to the camera pose it was authored against, so an
    // annotation appears where the learner is looking and then stays there.
    // ponytail: capture-time pose bookkeeping can replace this build-time
    // latch if vision latency makes the drift visible.
    state.overlayGroup.quaternion.copy(state.camera.quaternion);
  } else {
    state.overlayGroup.quaternion.identity();
  }
  state.overlayGroup.updateMatrixWorld(true);
  const distance = normalizedAnchorDistance(inputs.anchorDistance);
  const toWorld = (point: readonly [number, number]) =>
    normalizedPointToWorldPoint(
      point,
      square,
      state.viewport,
      distance,
      cameraFovDegrees,
    );

  if (inputs.wireframe) {
    addWireframe(state.overlayGroup, inputs.wireframe);
  }

  inputs.primitives.forEach((primitive, index) => {
    if (primitive.type === "arrow") {
      addArrow(state.overlayGroup, toWorld(primitive.from), toWorld(primitive.to));
      return;
    }

    if (primitive.type === "crease_line") {
      addStroke(state.overlayGroup, toWorld(primitive.from), toWorld(primitive.to), 0.85);
      return;
    }

    if (primitive.type === "dot") {
      const dot = new Mesh(new SphereGeometry(0.09, 14, 12), overlayMaterial(1));
      dot.position.copy(toWorld(primitive.at));
      state.overlayGroup.add(dot);
      return;
    }

    if (primitive.type === "fold_curve") {
      addFoldCurve(state.overlayGroup, toWorld(primitive.from), toWorld(primitive.to));
      return;
    }

    if (primitive.type === "label") {
      state.labels.push({
        key: `label-${index}`,
        text: primitive.text,
        point: primitive.at,
        position: toWorld(primitive.at),
      });
    }
  });
}

function projectLabels(state: OverlaySceneState): ProjectedLabel[] {
  return state.labels.flatMap((label) => {
    const screenPoint = resolveLabelScreenPoint({
      anchorMode: state.anchorMode,
      point: label.point,
      square: state.alignmentSquare,
      projectWorldPoint: () =>
        worldPointToScreenPoint(
          state.overlayGroup.localToWorld(label.position.clone()),
          state.camera,
          state.viewport,
        ),
    });

    return screenPoint
      ? [
          {
            key: label.key,
            text: label.text,
            ...screenPoint,
          },
        ]
      : [];
  });
}

function updateViewport(state: OverlaySceneState, viewport: ViewportSize): void {
  state.viewport = viewport;
  state.camera.aspect = viewport.width / viewport.height;
  state.camera.updateProjectionMatrix();
}

function disposeScene(state: OverlaySceneState): void {
  disposeOverlayGroup(state.overlayGroup);
  state.overlayGroup.removeFromParent();
}

/**
 * Transparent annotation layer for a live CameraView.
 *
 * `world` geometry sits on an initial world plane while DeviceMotion updates
 * only the Three camera. `screen` geometry becomes a camera child, preserving
 * its normalized position in the live image while the phone moves. Native text
 * uses the matching world projection or screen-coordinate label layer because
 * GLView cannot render device fonts directly.
 */
export function SpatialOverlay({
  primitives = [],
  anchorMode = "world",
  wireframe = null,
  alignmentSquare,
  anchorDistance = defaultAnchorDistance,
  style,
  onMotionAvailabilityChange,
}: SpatialOverlayProps) {
  const rendererStateRef = useRef<OverlaySceneState | null>(null);
  const viewportRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const orientationRef = useRef<WorldLockedCameraOrientation | null>(null);
  const latestRotationRef = useRef<DeviceRotation | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const parsedPrimitives = useMemo(
    () => parseSpatialOverlayPrimitives(primitives),
    [primitives],
  );
  const inputs = useMemo<SceneInputs>(
    () => ({
      primitives: parsedPrimitives,
      wireframe,
      anchorMode,
      alignmentSquare,
      anchorDistance: normalizedAnchorDistance(anchorDistance),
    }),
    [alignmentSquare, anchorDistance, anchorMode, parsedPrimitives, wireframe],
  );

  const refreshGeometry = useCallback(() => {
    const state = rendererStateRef.current;

    if (!state) {
      return;
    }

    buildOverlayGeometry(state, inputs);
    state.camera.updateMatrixWorld(true);
    setProjectedLabels(projectLabels(state));
  }, [inputs]);

  const applyLatestRotation = useCallback(() => {
    const state = rendererStateRef.current;
    const orientation = orientationRef.current;
    const rotation = latestRotationRef.current;

    if (!state || !orientation || !rotation) {
      return;
    }

    state.camera.quaternion.copy(orientation.cameraQuaternionFor(rotation));
    state.camera.updateMatrixWorld(true);
    setProjectedLabels(projectLabels(state));
  }, []);

  const handleCanvasCreated = useCallback(
    (canvasState: RootState) => {
      const previousState = rendererStateRef.current;

      if (previousState) {
        disposeScene(previousState);
      }

      const viewport = viewportRef.current;
      const renderer = canvasState.gl;
      renderer.setClearColor(0x000000, 0);
      const scene = canvasState.scene;
      const camera = canvasState.camera as PerspectiveCamera;
      camera.fov = cameraFovDegrees;
      camera.near = 0.01;
      camera.far = 20;
      camera.updateProjectionMatrix();
      const overlayGroup = new Group();
      scene.add(overlayGroup);

      const state: OverlaySceneState = {
        renderer,
        scene,
        camera,
        overlayGroup,
        labels: [],
        viewport,
        alignmentSquare: createCenteredAlignmentSquare(viewport),
        anchorMode: "world",
      };

      rendererStateRef.current = state;

      if (hasUsableViewport(viewport)) {
        updateViewport(state, viewport);
      }

      buildOverlayGeometry(state, inputs);
      applyLatestRotation();
      state.camera.updateMatrixWorld(true);
      setProjectedLabels(projectLabels(state));
    },
    [applyLatestRotation, inputs],
  );

  const handleLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const viewport = { width: layout.width, height: layout.height };
      viewportRef.current = viewport;
      const state = rendererStateRef.current;

      if (!state || !hasUsableViewport(viewport)) {
        return;
      }

      updateViewport(state, viewport);
      refreshGeometry();
      applyLatestRotation();
    },
    [applyLatestRotation, refreshGeometry],
  );

  useEffect(() => {
    refreshGeometry();
  }, [refreshGeometry]);

  useEffect(() => {
    if (anchorMode === "screen") {
      return;
    }

    let active = true;
    let subscription: { remove(): void } | null = null;

    const startMotion = async () => {
      const available = await DeviceMotion.isAvailableAsync();

      if (!active) {
        return;
      }

      onMotionAvailabilityChange?.(available);

      if (!available) {
        return;
      }

      const permission = await DeviceMotion.requestPermissionsAsync();

      if (!active) {
        return;
      }

      if (!permission.granted) {
        onMotionAvailabilityChange?.(false);
        return;
      }

      DeviceMotion.setUpdateInterval(16);
      subscription = DeviceMotion.addListener((measurement) => {
        const rotation: DeviceRotation = {
          alpha: measurement.rotation.alpha,
          beta: measurement.rotation.beta,
          gamma: measurement.rotation.gamma,
          screenOrientation: measurement.orientation,
        };

        latestRotationRef.current = rotation;
        orientationRef.current ??= createWorldLockedCameraOrientation(rotation);
        applyLatestRotation();
      });
    };

    void startMotion();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [anchorMode, applyLatestRotation, onMotionAvailabilityChange]);

  useEffect(
    () => () => {
      const state = rendererStateRef.current;

      if (state) {
        disposeScene(state);
        rendererStateRef.current = null;
      }
    },
    [],
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.container, style]}
      onLayout={handleLayout}
    >
      <Canvas
        pointerEvents="none"
        style={styles.glView}
        camera={{ fov: cameraFovDegrees, near: 0.01, far: 20 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={handleCanvasCreated}
      />
      <View pointerEvents="none" style={styles.labelLayer}>
        {projectedLabels.map((label) => (
          <View
            key={label.key}
            style={[styles.label, { left: label.x, top: label.y }]}
          >
            <Text style={styles.labelText}>{label.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  glView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  labelLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  label: {
    position: "absolute",
    transform: [{ translateX: "-50%" }, { translateY: -44 }],
    maxWidth: 290,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16213E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 6,
  },
  labelText: {
    color: "#16213E",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
});
