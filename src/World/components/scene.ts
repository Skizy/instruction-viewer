import { Color, Fog, Scene } from "three";

function createScene(): Scene {
	const scene = new Scene();

	scene.background = new Color("skyblue");
	// scene.fog = new Fog("indigo", 90, 140);

	return scene;
}

export { createScene };
