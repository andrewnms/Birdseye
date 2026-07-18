import { Vector3 } from "three";

import {
  createWorldLockedCameraOrientation,
  type DeviceRotation,
} from "./device-orientation";

const neutralRotation: DeviceRotation = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  screenOrientation: 0,
};

describe("world-locked camera orientation", () => {
  it("keeps the overlay centered until the phone rotates from its calibrated pose", () => {
    const orientation = createWorldLockedCameraOrientation(neutralRotation);

    expect(orientation.cameraQuaternionFor(neutralRotation).toArray()).toEqual([
      0,
      0,
      0,
      1,
    ]);
  });

  it("turns the three camera when the phone yaws after calibration", () => {
    const orientation = createWorldLockedCameraOrientation(neutralRotation);
    const cameraDirection = new Vector3(0, 0, -1).applyQuaternion(
      orientation.cameraQuaternionFor({
        ...neutralRotation,
        alpha: Math.PI / 2,
      }),
    );

    expect(cameraDirection.x).toBeCloseTo(-1);
    expect(cameraDirection.y).toBeCloseTo(0);
    expect(cameraDirection.z).toBeCloseTo(0);
  });

  it("accounts for a screen-orientation change without recalibrating the world", () => {
    const orientation = createWorldLockedCameraOrientation(neutralRotation);
    const cameraDirection = new Vector3(0, 0, -1).applyQuaternion(
      orientation.cameraQuaternionFor({
        ...neutralRotation,
        screenOrientation: 90,
      }),
    );

    expect(cameraDirection.x).toBeCloseTo(1);
    expect(cameraDirection.y).toBeCloseTo(0);
    expect(cameraDirection.z).toBeCloseTo(0);
  });
});
