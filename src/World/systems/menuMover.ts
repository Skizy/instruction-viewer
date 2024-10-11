import * as THREE from "three";
import type { Block, Button } from "../utils/ui-lib";

function createMover(
	menu: Block,
	mainMenuButton: Button,
	camera: THREE.Camera,
) {
	camera.updateWorldMatrix(true, true);

	const helperPlane = new THREE.Plane();

	const coplanarPoints = [
		new THREE.Vector3(),
		new THREE.Vector3(),
		new THREE.Vector3(),
	];

	const raycaster = new THREE.Raycaster();
	const mousePos = new THREE.Vector2();

	raycaster.setFromCamera(mousePos, camera);

	const intersection = new THREE.Vector3();

	return {
		move: () => {
			const aspectRatio = window.innerWidth / window.innerHeight;
			mousePos.set(1 - 0.02 / aspectRatio, 1 - 0.02);

			raycaster.setFromCamera(mousePos, camera);

			coplanarPoints[0].set(0, 1, -2);
			coplanarPoints[1].set(-1, 0, -2);
			coplanarPoints[2].set(1, 0, -2);
			for (const point of coplanarPoints) {
				camera.localToWorld(point);
			}
			helperPlane.setFromCoplanarPoints(
				coplanarPoints[0],
				coplanarPoints[1],
				coplanarPoints[2],
			);

			const rightTopPos = raycaster.ray.intersectPlane(
				helperPlane,
				intersection,
			);

			if (!rightTopPos) {
				console.error("Shouldn't happen, there should be an intersection");
				return;
			}

			camera.worldToLocal(rightTopPos);
			const menuWidth = menu.width();
			const menuHeight = menu.height();

			menu
				.position()
				.set(rightTopPos.x - menuWidth / 2, rightTopPos.y - menuHeight / 2, -2);

			mousePos.set(-1 + 0.02 / aspectRatio, 1 - 0.02);

			raycaster.setFromCamera(mousePos, camera);

			const leftTopPos = raycaster.ray.intersectPlane(
				helperPlane,
				intersection,
			);

			if (!leftTopPos) {
				console.error("Shouldn't happen, there should be an intersection");
				return;
			}

			camera.worldToLocal(leftTopPos);
			const btnWidth = mainMenuButton.block().width();
			const btnHeight = mainMenuButton.block().height();

			mainMenuButton
				.block()
				.position()
				.set(leftTopPos.x + btnWidth / 2, leftTopPos.y - btnHeight / 2, -2);
		},
	};
}

export { createMover };
