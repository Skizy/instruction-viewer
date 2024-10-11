import {
	type Group,
	type Mesh,
	type Object3D,
	type PerspectiveCamera,
	Raycaster,
	Vector3,
} from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

class FocusPoint {
	#camera: PerspectiveCamera;
	#scene: Object3D;
	#raycaster: Raycaster;
	#helperVectors: Vector3[];
	#intersectionModel: Mesh | Group;
	#controls: OrbitControls;

	constructor(
		camera: PerspectiveCamera,
		scene: Object3D,
		controls: OrbitControls,
		intersectionModel: Mesh | Group,
	) {
		this.#camera = camera;
		this.#scene = scene;
		this.#controls = controls;

		this.#helperVectors = [new Vector3(), new Vector3()];
		this.#raycaster = new Raycaster(undefined, undefined, 0, 1.5);

		this.#intersectionModel = intersectionModel;
		this.#intersectionModel.visible = false;

		controls.addEventListener("start", () => {
			this.#intersectionModel.visible = true;

			this.checkIntersection();
		});
		controls.addEventListener("end", () => {
			this.#intersectionModel.visible = false;
		});

		this.#scene.add(this.#intersectionModel);
		this.#intersectionModel.position.copy(
			this.#intersectionModel.parent!.worldToLocal(
				this.#controls.target.clone(),
			),
		);
	}

	checkIntersection() {
		this.#raycaster.set(
			this.#camera.getWorldPosition(this.#helperVectors[0]),
			this.#camera.getWorldDirection(this.#helperVectors[1]),
		);

		if (this.#intersectionModel.parent === null) {
			return;
		}

		const intersections = this.#raycaster.intersectObject(this.#scene, true);

		let hasIntersection = false;
		for (const intersection of intersections) {
			let isIntersectionModel = false;
			this.#intersectionModel.traverse((obj) => {
				if (obj === intersection.object) {
					isIntersectionModel = true;
				}
			});

			if (isIntersectionModel) {
				continue;
			}

			hasIntersection = true;

			this.#intersectionModel.position.copy(
				this.#intersectionModel.parent.worldToLocal(intersection.point.clone()),
			);

			this.#controls.target.copy(intersection.point);

			break;
		}

		if (!hasIntersection) {
			this.#intersectionModel.position.copy(
				this.#intersectionModel.parent.worldToLocal(
					this.#controls.target.clone(),
				),
			);
		}
	}
}

export { FocusPoint };
