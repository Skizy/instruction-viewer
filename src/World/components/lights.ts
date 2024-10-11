import {
	AmbientLight,
	DirectionalLight,
	HemisphereLight,
	type Light,
	PointLight,
	Vector2,
} from "three";

function createLights(): Light[] {
	const mainLight = new DirectionalLight("white", 2);
	mainLight.castShadow = true;
	// mainLight.shadow.bias = -0.0005;
	mainLight.shadow.radius = 3;
	mainLight.shadow.mapSize = new Vector2(2048, 2048);
	mainLight.position.set(5, 5, 5);

	const ambientLight = new HemisphereLight("white", "#bfd4d2", 1);

	const pointLight = new PointLight("white", 1);
	// pointLight.castShadow = true;

	pointLight.position.set(-1, 1.8, -1.8);

	return [mainLight, ambientLight, pointLight];
}

export { createLights };
