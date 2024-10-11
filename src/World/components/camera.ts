import { OrthographicCamera, PerspectiveCamera } from "three";
import type { UpdatableOrthographicCamera } from "../utils/helpers";

function createCamera(): PerspectiveCamera {
	const camera = new PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		0.01,
		10000,
	);
	camera.position.set(1.5, 1.5, 1.5);
	camera.lookAt(0, 1, 0);

	return camera;
}

function createUiCamera(): UpdatableOrthographicCamera {
	const cam = new OrthographicCamera(-2, 2, 2, -2, 0.2, 100);

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	(cam as UpdatableOrthographicCamera).tick = () => {};

	return cam as UpdatableOrthographicCamera;
}

export { createCamera, createUiCamera };
