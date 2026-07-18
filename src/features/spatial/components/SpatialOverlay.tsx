import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import { DeviceMotion } from "expo-sensors";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowHelper,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  QuadraticBezierCurve3,
  Scene,
  SphereGeometry,
  Vector3,
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
  createWorldLockedCameraOrientation,
  type DeviceRotation,
  type WorldLockedCameraOrientation,
} from "../lib/device-orientation";
import {
  parseSpatialOverlayPrimitives,
  type SpatialOverlayPrimitive,
} from "../lib/overlay-primitives";
import type { WireframeGeometry } from "../../model-preview";

const cameraFovDegrees = 55;
const overlayColor = 0xff3347;
const defaultAnchorDistance = 2;

type SceneInputs = {
  primitives: SpatialOverlayPrimitive[];
  wireframe: WireframeGeometry | null;
  alignmentSquare?: AlignmentSquare;
  anchorDistance: number;
};

type WorldLabel = {
  key: string;
  text: string;
  position: Vector3;
};

type ProjectedLabel = {
  key: string;
  text: string;
  x: number;
  y: number;
};

type OverlaySceneState = {
  gl: ExpoWebGLRenderingContext;
  renderer: Renderer;
  scene: Scene;
  camera: PerspectiveCamera;
  overlayGroup: Group;
  labels: WorldLabel[];
  viewport: ViewportSize;
  animationFrame: number | null;
};

type DisposableObject = {
  geometry?: { dispose(): void };
  material?: { dispose(): void } | { dispose(): void }[];
};

export type SpatialOverlayProps = {
  /** Untrusted tool-call payloads are accepted and invalid primitives are ignored. */
  primitives?: readonly unknown[];
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

function createLine(
  points: Vector3[],
  opacity = 0.95,
): Line<BufferGeometry, LineBasicMaterial> {
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({
    color: overlayColor,
    transparent: true,
    opacity,
  });

  return new Line(geometry, material);
}

function addArrow(group: Group, from: Vector3, to: Vector3): void {
  const direction = to.clone().sub(from);
  const length = direction.length();

  if (length <= Number.EPSILON) {
    return;
  }

  const headLength = Math.min(0.18, Math.max(0.06, length * 0.24));
  const arrow = new ArrowHelper(
    direction.normalize(),
    from,
    length,
    overlayColor,
    headLength,
    headLength * 0.62,
  );
  group.add(arrow);
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
    .add(perpendicular.multiplyScalar(Math.min(0.28, length * 0.32)));
  const curve = new QuadraticBezierCurve3(from, control, to);
  const points = curve.getPoints(24);
  group.add(createLine(points));

  const arrowOrigin = curve.getPoint(0.8);
  const arrowEnd = curve.getPoint(0.98);
  addArrow(group, arrowOrigin, arrowEnd);
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
      color: 0x7ce7ff,
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
      const from = toWorld(primitive.from);
      const to = toWorld(primitive.to);

      if (!from.equals(to)) {
        state.overlayGroup.add(createLine([from, to], 0.8));
      }
      return;
    }

    if (primitive.type === "dot") {
      const dot = new Mesh(
        new SphereGeometry(0.035, 12, 10),
        new MeshBasicMaterial({ color: overlayColor }),
      );
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
        position: toWorld(primitive.at),
      });
    }
  });
}

function projectLabels(state: OverlaySceneState): ProjectedLabel[] {
  return state.labels.flatMap((label) => {
    const screenPoint = worldPointToScreenPoint(
      label.position,
      state.camera,
      state.viewport,
    );

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

function updateViewport(
  state: OverlaySceneState,
  viewport: ViewportSize,
): void {
  state.viewport = viewport;
  state.camera.aspect = viewport.width / viewport.height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(state.gl.drawingBufferWidth, state.gl.drawingBufferHeight);
}

function startRenderLoop(state: OverlaySceneState): void {
  const renderFrame = () => {
    state.renderer.render(state.scene, state.camera);
    state.gl.endFrameEXP();
    state.animationFrame = requestAnimationFrame(renderFrame);
  };

  renderFrame();
}

function disposeScene(state: OverlaySceneState): void {
  if (state.animationFrame !== null) {
    cancelAnimationFrame(state.animationFrame);
  }

  disposeOverlayGroup(state.overlayGroup);
  state.renderer.dispose();
}

/**
 * Transparent world-locked annotation layer for a live CameraView.
 *
 * Geometry sits on an initial world plane, while DeviceMotion updates only the
 * Three camera. Native text is projected from that same world plane into a
 * React Native label layer because GLView cannot render device fonts directly.
 */
export function SpatialOverlay({
  primitives = [],
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
      alignmentSquare,
      anchorDistance: normalizedAnchorDistance(anchorDistance),
    }),
    [alignmentSquare, anchorDistance, parsedPrimitives, wireframe],
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

  const handleContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      const previousState = rendererStateRef.current;

      if (previousState) {
        disposeScene(previousState);
      }

      const viewport = viewportRef.current;
      const renderer = new Renderer({ gl, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      const scene = new Scene();
      const camera = new PerspectiveCamera(
        cameraFovDegrees,
        hasUsableViewport(viewport) ? viewport.width / viewport.height : 1,
        0.01,
        20,
      );
      const overlayGroup = new Group();
      scene.add(overlayGroup);

      const state: OverlaySceneState = {
        gl,
        renderer,
        scene,
        camera,
        overlayGroup,
        labels: [],
        viewport,
        animationFrame: null,
      };

      rendererStateRef.current = state;

      if (hasUsableViewport(viewport)) {
        updateViewport(state, viewport);
      }

      buildOverlayGeometry(state, inputs);
      applyLatestRotation();
      state.camera.updateMatrixWorld(true);
      setProjectedLabels(projectLabels(state));
      startRenderLoop(state);
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
  }, [applyLatestRotation, onMotionAvailabilityChange]);

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
      <GLView pointerEvents="none" style={styles.glView} onContextCreate={handleContextCreate} />
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
    ...StyleSheet.absoluteFill,
  },
  glView: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  labelLayer: {
    ...StyleSheet.absoluteFill,
  },
  label: {
    position: "absolute",
    transform: [{ translateX: "-50%" }, { translateY: -28 }],
    maxWidth: 180,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(20, 8, 10, 0.76)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ff7180",
  },
  labelText: {
    color: "#ffe9ec",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
