import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { UpdatableAnimationMixer } from "./helpers";
// import { api } from "libs";

async function loadGltfFromStringRaw(
	gltf: string | ArrayBuffer,
	blobs: Record<string, Blob | File>,
): Promise<GLTF> {
	const manager = new THREE.LoadingManager();

	const loader = new GLTFLoader(manager);

	const urls: string[] = [];
	manager.setURLModifier((url) => {
		if (url.startsWith("data:application/octet-stream")) {
			return url;
		}
		const newUrl = URL.createObjectURL(blobs[url]);
		urls.push(newUrl);
		return newUrl;
	});

	const model = await loader.parseAsync(gltf, "");

	// biome-ignore lint/complexity/noForEach: <explanation>
	urls.forEach((url) => URL.revokeObjectURL(url));

	if (model.userData.manual_name) {
		console.log(model.userData.manual_name);
	} else if (model.scene.userData.manual_name) {
		console.log(model.scene.userData.manual_name);
	}

	// Example texts
	model.userData.descriptions = {
		1: "sup",
		2: "But let’s forget for a minute about UI component libraries and move closer to the real problem. Let’s take it bit by bit. Now, when I’m going to start my ReactJS project, what libraries do I need to import first? Tailwind? That is a generic library, so it works on SvelteJS. Oh, I know, a state management library. No one wants to use useReducer, so let’s get a better library. In ReactJS, there are so many options for state management: Redux Toolkit, Jotai, Zustand, MobX, and a lot more. In SvelteJS, we don’t have that many state management libraries, but we have svelte/store, a lightweight state management API that comes built-in with SvelteJS. From the start, we get a solution for a problem. Instead of searching for a solution, we can use that time to build something useful.",
		3: "sup again",
		4: "this is the last",
	};

	return model;
}

async function loadGltfFromString(
	gltf: string | ArrayBuffer,
	blobs: Record<string, Blob | File>,
) {
	const manager = new THREE.LoadingManager();

	const loader = new GLTFLoader(manager);

	const urls: string[] = [];
	manager.setURLModifier((url) => {
		if (url.startsWith("data:application/octet-stream")) {
			return url;
		}
		console.debug(url);
		const newUrl = URL.createObjectURL(blobs[url]);
		urls.push(newUrl);
		return newUrl;
	});

	const model = await loader.parseAsync(gltf, "");

	// biome-ignore lint/complexity/noForEach: <explanation>
	urls.forEach((url) => URL.revokeObjectURL(url));

	if (model.userData.manual_name) {
		console.log(model.userData.manual_name);
	} else if (model.scene.userData.manual_name) {
		console.log(model.scene.userData.manual_name);
	}

	model.scene.children[0].position.setX(0);

	const mixer = new THREE.AnimationMixer(
		model.scene,
	) as UpdatableAnimationMixer;
	mixer.tick = (delta) => mixer.update(delta);

	// Example texts
	model.userData.descriptions = {
		1: "sup",
		2: "But let’s forget for a minute about UI component libraries and move closer to the real problem. Let’s take it bit by bit. Now, when I’m going to start my ReactJS project, what libraries do I need to import first? Tailwind? That is a generic library, so it works on SvelteJS. Oh, I know, a state management library. No one wants to use useReducer, so let’s get a better library. In ReactJS, there are so many options for state management: Redux Toolkit, Jotai, Zustand, MobX, and a lot more. In SvelteJS, we don’t have that many state management libraries, but we have svelte/store, a lightweight state management API that comes built-in with SvelteJS. From the start, we get a solution for a problem. Instead of searching for a solution, we can use that time to build something useful.",
		3: "sup again",
		4: "this is the last",
	};

	return {
		model,
		mixer,
		actions: model.animations.map((x) => {
			const action = mixer.clipAction(x).setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
			return action;
		}),
	};
}

async function loadGltf(url: string) {
	const loader = new GLTFLoader();

	const model = await loader.loadAsync(url);

	return model;
}

export { loadGltf, loadGltfFromString, loadGltfFromStringRaw };
