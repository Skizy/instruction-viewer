import { ACESFilmicToneMapping, WebGLRenderer } from "three";

function createRenderer(): WebGLRenderer {
	const renderer = new WebGLRenderer({ antialias: true });

	renderer.shadowMap.enabled = true;

	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.63;

	renderer.localClippingEnabled = true;

	renderer.autoClear = false;

	renderer.xr.enabled = true;

	return renderer;
}

export { createRenderer };
