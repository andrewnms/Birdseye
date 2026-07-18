import { Euler, MathUtils, Quaternion, Vector3 } from "three";

/**
 * Expo SDK 57 DeviceMotion reports its orientation as alpha (Z), beta (X),
 * and gamma (Y). Values are radians on the native platforms.
 */
export type DeviceRotation = {
  alpha: number;
  beta: number;
  gamma: number;
  screenOrientation: number;
};

export type WorldLockedCameraOrientation = {
  /**
   * Returns the Three.js camera quaternion relative to the calibrated pose.
   * A world-space annotation remains fixed while this quaternion changes.
   */
  cameraQuaternionFor(rotation: DeviceRotation): Quaternion;
};

const cameraForwardCorrection = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);
const screenAxis = new Vector3(0, 0, 1);

function assertFiniteRotation({
  alpha,
  beta,
  gamma,
  screenOrientation,
}: DeviceRotation): void {
  if (![alpha, beta, gamma, screenOrientation].every(Number.isFinite)) {
    throw new RangeError("device rotation values must be finite numbers");
  }
}

/**
 * Converts Expo DeviceMotion's documented Euler angles to the coordinate
 * system Three.js uses for a device camera.
 */
export function deviceRotationToThreeOrientation(
  rotation: DeviceRotation,
): Quaternion {
  assertFiniteRotation(rotation);

  return new Quaternion()
    .setFromEuler(new Euler(rotation.beta, rotation.alpha, -rotation.gamma, "YXZ"))
    .multiply(cameraForwardCorrection)
    .multiply(
      new Quaternion().setFromAxisAngle(
        screenAxis,
        -MathUtils.degToRad(rotation.screenOrientation),
      ),
    )
    .normalize();
}

/**
 * Calibrates the world to the device's current pose. The returned module has
 * one small interface while retaining all device-to-Three coordinate handling
 * internally, so callers only need to update their camera quaternion.
 */
export function createWorldLockedCameraOrientation(
  calibratedRotation: DeviceRotation,
): WorldLockedCameraOrientation {
  const calibratedInverse = deviceRotationToThreeOrientation(calibratedRotation)
    .invert()
    .clone();

  return {
    cameraQuaternionFor(rotation: DeviceRotation): Quaternion {
      return deviceRotationToThreeOrientation(rotation)
        .multiply(calibratedInverse)
        .normalize();
    },
  };
}
