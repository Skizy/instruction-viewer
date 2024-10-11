import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { World } from "./World/World";

async function threeMain(
	modelData: ArrayBuffer,
	assets: Record<string, Blob | File>,
	returnToMainMenu: () => void,
	container?: HTMLElement,
	debugChanges?: (obj: GLTF) => void,
) {
	const containerLocal = container ?? document.getElementById("main-canvas");

	if (!containerLocal) {
		console.error("Couldn't find the main canvas div");
		return;
	}

	const world = new World(containerLocal, returnToMainMenu);

	await world.loadModel(modelData, assets, debugChanges);
}

export { threeMain };
