import * as THREE from "three";
import {
	type Clickable,
	type Draggable,
	InteractionType,
	type Scrollable,
} from "../utils/helpers";

type MouseHandlerIntersection = {
	obj: Clickable<THREE.Object3D> | Draggable<THREE.Object3D>;
	distance: number;
	point: THREE.Vector3;
};

type MouseHandlerIntersectionWithScrollable = {
	obj:
		| Clickable<THREE.Object3D>
		| Draggable<THREE.Object3D>
		| Scrollable<THREE.Object3D>;
	distance: number;
	point: THREE.Vector3;
};

class MouseHandler {
	#canvas: HTMLCanvasElement;
	#raycaster: THREE.Raycaster;
	#camera: THREE.Camera;
	#mousePos: THREE.Vector2;
	#objects: Clickable<THREE.Object3D>[];
	#draggableObjects: Draggable<THREE.Object3D>[];
	#scrollableObjects: Scrollable<THREE.Object3D>[];
	#hoveredScrollable: Scrollable<THREE.Object3D> | null = null;
	#hoveredObj: Clickable<THREE.Object3D> | Draggable<THREE.Object3D> | null =
		null;
	#draggedObj: Draggable<THREE.Object3D> | null = null;
	#bindedHandleMove: (ev: MouseEvent) => void;
	#bindedHandleDown: () => void;
	#bindedHandleUp: (
		clickedObj: Clickable<THREE.Object3D> | Draggable<THREE.Object3D>,
	) => void;
	#bindedHandleWheel: (ev: WheelEvent) => void;

	setControlsEnabled: (enabled: boolean) => void;
	setControlsEnabledZoom: (enabled: boolean) => void;

	constructor(
		camera: THREE.Camera,
		canvas: HTMLCanvasElement,
		setControlsEnabled?: (enabled: boolean) => void,
		setControlsEnabledZoom?: (enabled: boolean) => void,
	) {
		this.#canvas = canvas;
		this.#raycaster = new THREE.Raycaster();
		this.#camera = camera;
		this.#mousePos = new THREE.Vector2(0, 0);
		this.#raycaster.setFromCamera(this.#mousePos, camera);
		this.setControlsEnabled = setControlsEnabled ?? (() => {});
		this.setControlsEnabledZoom = setControlsEnabledZoom ?? (() => {});

		this.#objects = [];
		this.#draggableObjects = [];
		this.#scrollableObjects = [];

		this.#bindedHandleMove = this.handleMouseMove.bind(this);
		this.#bindedHandleDown = this.handleMouseDown.bind(this);
		this.#bindedHandleUp = this.handleMouseUp.bind(this);
		this.#bindedHandleWheel = this.handleWheel.bind(this);
		document.addEventListener("mousemove", this.#bindedHandleMove);
		document.addEventListener("mousedown", this.#bindedHandleDown);
		document.addEventListener("wheel", this.#bindedHandleWheel);
	}

	handleMouseMove(ev: MouseEvent) {
		const normalized = normalizeMouse(ev.clientX, ev.clientY, this.#canvas);
		if (!normalized) {
			return;
		}
		this.#mousePos.set(normalized[0], normalized[1]);
		this.#raycaster.setFromCamera(this.#mousePos, this.#camera);

		if (this.#draggedObj !== null) {
			const plane = this.#draggedObj.getPlane();

			if (
				this.#raycaster.ray.intersectPlane(
					plane,
					this.#draggedObj.intersection,
				) !== null
			) {
				this.#draggedObj.onDrag?.(this.#draggedObj.intersection);

				return;
			}
		}

		const intersections: MouseHandlerIntersectionWithScrollable[] = [];

		for (const obj of this.#objects) {
			const intersection = this.#raycaster.intersectObject(obj.obj);
			if (intersection.length > 0) {
				intersections.push({
					obj,
					distance: intersection[0].distance,
					point: intersection[0].point,
				});
			}
		}

		for (const obj of this.#draggableObjects) {
			const intersection = this.#raycaster.intersectObject(obj.obj);
			if (intersection.length > 0) {
				intersections.push({
					obj,
					distance: intersection[0].distance,
					point: intersection[0].point,
				});
			}
		}

		for (const obj of this.#scrollableObjects) {
			const intersection = this.#raycaster.intersectObject(obj.obj, false);
			if (intersection.length > 0) {
				intersections.push({
					obj,
					distance: intersection[0].distance,
					point: intersection[0].point,
				});
			}
		}

		intersections.sort((a, b) => a.distance - b.distance);

		// Check intersections until the first real intersection (handling clipping planes)
		const visibleIntersection = findVisibleIntersection(intersections);

		// @ts-expect-error filter ensures that obj is Scrollable
		const scrollableIntersections: {
			obj: Scrollable<THREE.Object3D>;
			distance: number;
			point: THREE.Vector3;
		}[] = intersections.filter(
			(x) => x.obj.type === InteractionType.Scrollable,
		);

		if (visibleIntersection !== null) {
			const visibleIntersectedObj = visibleIntersection.obj;

			if (visibleIntersectedObj !== this.#hoveredObj) {
				this.#hoveredObj?.onBlur?.();

				if (visibleIntersectedObj.type === InteractionType.Scrollable) {
					this.#hoveredObj = null;

					if (this.#hoveredScrollable !== visibleIntersectedObj) {
						this.#hoveredScrollable = visibleIntersectedObj;
						this.setControlsEnabledZoom(false);
					}

					document.body.style.cursor = "default";

					return;
				}

				this.#hoveredScrollable = null;
				this.setControlsEnabledZoom(true);
				for (const x of scrollableIntersections) {
					let isChild = false;
					x.obj.obj.traverse((obj) => {
						if (obj === visibleIntersectedObj.obj) {
							isChild = true;
						}
					});

					if (isChild) {
						this.#hoveredScrollable = x.obj;
						this.setControlsEnabledZoom(false);

						break;
					}
				}

				document.body.style.cursor =
					visibleIntersectedObj.hovercursor ?? "pointer";

				this.#hoveredObj = visibleIntersectedObj;
				if (this.#hoveredObj.intersection) {
					this.#hoveredObj.intersection.copy(visibleIntersection.point);
					this.#hoveredObj.onHover?.(this.#hoveredObj.intersection);

					return;
				}
				this.#hoveredObj.onHover?.();
			}

			return;
		}

		document.body.style.cursor = "default";

		if (this.#hoveredScrollable !== null) {
			this.#hoveredScrollable = null;
			this.setControlsEnabledZoom(true);
		}

		if (this.#hoveredObj !== null) {
			this.#hoveredObj.onBlur?.();

			this.#hoveredObj = null;
		}
	}

	handleMouseDown() {
		const intersections: MouseHandlerIntersection[] = [];

		for (const obj of this.#objects) {
			const intersection = this.#raycaster.intersectObject(obj.obj);
			if (intersection.length > 0) {
				intersections.push({
					obj,
					distance: intersection[0].distance,
					point: intersection[0].point,
				});
			}
		}

		for (const obj of this.#draggableObjects) {
			const intersection = this.#raycaster.intersectObject(obj.obj);
			if (intersection.length > 0) {
				intersections.push({
					obj,
					distance: intersection[0].distance,
					point: intersection[0].point,
				});
			}
		}

		intersections.sort((a, b) => a.distance - b.distance);

		if (intersections.length === 0) {
			return;
		}

		const visibleIntersection = findVisibleIntersection(intersections);

		if (visibleIntersection === null) {
			return;
		}

		const visibleIntersectedObj = visibleIntersection.obj;

		document.addEventListener(
			"mouseup",
			() => this.#bindedHandleUp(visibleIntersectedObj),
			{ once: true },
		);

		this.setControlsEnabled(false);

		if (visibleIntersectedObj.intersection) {
			visibleIntersectedObj.intersection.copy(visibleIntersection.point);
			visibleIntersectedObj.onMouseDown?.(visibleIntersectedObj.intersection);
		} else {
			visibleIntersectedObj.onMouseDown?.();
		}

		if (visibleIntersectedObj.type === InteractionType.Draggable) {
			this.#draggedObj = visibleIntersectedObj;
		}
	}

	handleMouseUp(
		clickedObj: Clickable<THREE.Object3D> | Draggable<THREE.Object3D>,
	) {
		const intersections = [];

		const intersection = this.#raycaster.intersectObject(clickedObj.obj);
		if (intersection.length > 0) {
			intersections.push({
				obj: clickedObj,
				distance: intersection[0].distance,
				point: intersection[0].point,
			});
		}

		const visibleIntersection = findVisibleIntersection(intersections);
		const visibleIntersectedObj = visibleIntersection?.obj;

		if (visibleIntersectedObj !== undefined) {
			clickedObj.onMouseUp?.();
		}

		this.setControlsEnabled(true);

		if (clickedObj.type === InteractionType.Draggable) {
			this.#draggedObj = null;
		}
	}

	handleWheel(ev: WheelEvent) {
		this.#hoveredScrollable?.onScroll?.(ev.deltaY);
	}

	stop() {
		document.body.style.cursor = "default";

		document.removeEventListener("mousemove", this.#bindedHandleMove);
		document.removeEventListener("mousedown", this.#bindedHandleDown);
		document.removeEventListener("wheel", this.#bindedHandleWheel);
	}

	start() {
		this.stop();

		document.addEventListener("mousemove", this.#bindedHandleMove);
		document.addEventListener("mousedown", this.#bindedHandleDown);
		document.addEventListener("wheel", this.#bindedHandleWheel);
	}

	checkObj(obj: THREE.Object3D) {
		const intersections = this.#raycaster.intersectObject(obj);

		if (intersections.length > 0) {
			return true;
		}

		return false;
	}

	add(obj: Clickable<THREE.Object3D>) {
		this.#objects.push(obj);
	}

	remove(obj: Clickable<THREE.Object3D>) {
		this.#objects = this.#objects.filter((x) => x !== obj);
	}

	addDraggable(obj: Draggable<THREE.Object3D>) {
		this.#draggableObjects.push(obj);
	}

	addScrollable(obj: Scrollable<THREE.Object3D>) {
		this.#scrollableObjects.push(obj);
	}
}

function normalizeMouse(
	x: number,
	y: number,
	canvas: HTMLCanvasElement,
): [number, number] | null {
	const newX = (2 * x) / canvas.clientWidth - 1;
	const newY = (2 * (canvas.clientHeight - y)) / canvas.clientHeight - 1;

	return [newX, newY];
}

function isInVisiblePart(point: THREE.Vector3, planes: THREE.Plane[]) {
	for (const plane of planes) {
		const dist = plane.distanceToPoint(point);
		if (dist < 0) {
			return false;
		}
	}

	return true;
}

function findVisibleIntersection<
	T extends MouseHandlerIntersection | MouseHandlerIntersectionWithScrollable,
>(intersections: T[]): null | T {
	let found: null | T = null;
	for (const inter of intersections) {
		inter.obj.obj.traverse((o) => {
			if (found !== null) {
				return;
			}

			const obj = o as (THREE.Object3D & { isMesh: false }) | THREE.Mesh;

			if (obj.isMesh) {
				if (Array.isArray(obj.material)) {
					// TODO: Handle this case
					console.error("Not handling material arrays yet");
				} else {
					const hasClippingPlanes =
						obj.material.clippingPlanes !== null &&
						obj.material.clippingPlanes.length > 0;
					if (hasClippingPlanes) {
						if (
							isInVisiblePart(
								inter.point,
								obj.material.clippingPlanes as unknown as THREE.Plane[],
							)
						) {
							found = inter;

							return;
						}
					} else {
						found = inter;

						return;
					}
				}
			}
		});

		if (found !== null) {
			break;
		}
	}

	return found;
}

export { MouseHandler };
