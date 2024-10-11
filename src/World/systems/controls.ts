import type { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { UpdatableOrbitControls } from "../utils/helpers";

function createControls(
	camera: PerspectiveCamera,
	canvas: HTMLElement,
): UpdatableOrbitControls {
	const controls = new OrbitControls(camera, canvas);

	controls.target.set(0, 1.0, 0);

	// controls.maxPolarAngle = Math.PI / 2;
	// controls.minPolarAngle = Math.PI / 4;

	// controls.autoRotate = true;
	// controls.autoRotateSpeed = 15;

	// controls.enableDamping = true;

	(controls as UpdatableOrbitControls).tick = (delta) => {
		if (controls.enabled) {
			controls.update(delta);
		}
	};

	return controls as UpdatableOrbitControls;
}

export { createControls };
