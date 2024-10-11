import * as THREE from "three";

function createEnvironment(): THREE.Group {
	const environment = new THREE.Group();

	const objLoader = new THREE.ObjectLoader();
	fetch("/api/assets/room.json")
		// api["room.json"]
		// 	.get()
		.then(async (response) => {
			if (response.ok) {
				const data = await response.json();
				environment.add(objLoader.parse(data, (val) => environment.add(val)));
			}
		})
		.catch((e) => console.error("Something went wrong:", e));
	// objLoader.load("/room.json", (obj) => {
	// 	environment.add(obj);
	// });
	// fileLoader.load("/room.json", (data) => {
	// 	if (typeof data === "string") {
	// 		try {
	// 			const roomData = JSON.parse(data) as { scene: THREE.Object3D };
	// 			const room = objLoader.load(roomData, (obj) => {});
	// 		} catch (e) {
	// 			console.error("Couldn't parse the room file: ", e);
	// 		}
	// 	} else {
	// 		console.error("Room data is in binary");
	// 	}
	// });

	const canvas = THREE.createCanvasElement();
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const grad = ctx.createRadialGradient(150, 75, 10, 150, 75, 200);

		grad.addColorStop(0, "darkslateblue");
		grad.addColorStop(1, "mediumorchid");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 300, 150);
	} else {
		console.warn("Couldn't get the context");
	}

	const texture = new THREE.CanvasTexture(canvas);

	const sphere = new THREE.Mesh(
		new THREE.SphereGeometry(100, 300, 300),
		new THREE.MeshBasicMaterial({
			map: texture,
			side: THREE.DoubleSide,
		}),
	);
	sphere.castShadow = false;

	// const plane = new THREE.Mesh(
	// 	new THREE.PlaneGeometry(),
	// 	new THREE.ShadowMaterial({
	// 		color: 0x000000,
	// 		transparent: true,
	// 		opacity: 0.5,
	// 		side: THREE.DoubleSide,
	// 	}),
	// );
	// plane.rotation.x = -Math.PI / 2;
	// plane.scale.setScalar(10);
	// plane.receiveShadow = true;

	environment.add(sphere);
	return environment;
}

export { createEnvironment };
