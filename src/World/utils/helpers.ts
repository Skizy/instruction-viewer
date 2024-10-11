import type {
	AnimationAction,
	AnimationMixer,
	Mesh,
	Object3D,
	OrthographicCamera,
	PerspectiveCamera,
	Plane,
	Quaternion,
	Vector3,
} from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

type Updatable = {
	tick: (delta: number) => void;
};

enum InteractionType {
	Clickable = 0,
	Draggable = 1,
	Scrollable = 2,
}

/* eslint-disable no-mixed-spaces-and-tabs */
type Clickable<T> = {
	obj: T;
	type: InteractionType.Clickable;
	hovercursor?: string;
	onMouseUp?: () => void;
	onBlur?: () => void;
} & (
	| {
			intersection: Vector3;
			onMouseDown?: (intersection: Vector3) => void;
			onHover?: (intersection: Vector3) => void;
	  }
	| {
			intersection?: undefined;
			onMouseDown?: () => void;
			onHover?: () => void;
	  }
);
/* eslint-enable no-mixed-spaces-and-tabs */

type Draggable<T> = Omit<Clickable<T>, "type"> & {
	type: InteractionType.Draggable;
	getPlane: () => Plane;
	intersection: Vector3;
	onDrag?: (intersection: Vector3) => void;
};

type Scrollable<T> = {
	obj: T;
	type: InteractionType.Scrollable;
	onScroll?: (deltaY: number) => void;
};

type SunPosition = {
	elevation: number;
	azimuth: number;
};

type UpdatableOrbitControls = Updatable & OrbitControls;

type UpdatablePerspectiveCamera = Updatable & PerspectiveCamera;
type UpdatableOrthographicCamera = Updatable & OrthographicCamera;

type UpdatableAnimationMixer = Updatable & AnimationMixer;

type Transformation = {
	objName: string;
	position?: Vector3;
	quaternion?: Quaternion;
};

function enableShadows(obj: Object3D) {
	obj.castShadow = true;
	obj.receiveShadow = true;

	for (const child of obj.children) {
		enableShadows(child);
	}
}

function disableShadows(obj: Object3D) {
	obj.castShadow = false;
	obj.receiveShadow = false;

	for (const child of obj.children) {
		disableShadows(child);
	}
}

function removeObjWithChildren(obj: Object3D | Mesh) {
	for (const child of obj.children) {
		(child as Object3D & { isMesh: undefined }).isMesh = undefined;
		removeObjWithChildren(child as (Object3D & { isMesh: undefined }) | Mesh);
	}

	const o = obj as (Object3D & { isMesh: undefined }) | Mesh;
	if (o.isMesh) {
		o.geometry.dispose();
		if (Array.isArray(o.material)) {
			for (const mat of o.material) {
				mat.dispose();
			}
		} else {
			o.material.dispose();
		}
	}

	obj.parent?.remove(obj);
}

function applyTransformData(transformData: Transformation[], root: Object3D) {
	for (const transform of transformData) {
		const obj = root.getObjectByName(transform.objName);

		if (obj === undefined) {
			console.error(
				`Couldn't find object with name ${transform.objName} in descendents of root ${root}`,
			);

			continue;
		}

		if (transform.position !== undefined) {
			obj.position.copy(transform.position);
		}

		if (transform.quaternion !== undefined) {
			obj.quaternion.copy(transform.quaternion);
		}
	}
}

function getRotationAtTime(
	action: AnimationAction,
	time: number,
): null | Float32Array {
	const track = action
		.getClip()
		.tracks.find((track) => track.ValueTypeName === "quaternion");
	if (track === undefined) {
		return null;
	}
	const interpolant = track.createInterpolant();
	return interpolant.evaluate(time);
}

function range(size: number, startAt = 0): number[] {
	return [...Array(size).keys()].map((i) => i + startAt);
}

function min(arr: number[]): number | null;
function min(a: number, b: number): number;
function min(a: number[] | number, b?: number): number | null {
	if (Array.isArray(a)) {
		if (a.length === 0) return null;

		let min = a[0];
		for (const val of a.slice(1)) {
			if (val < min) {
				min = val;
			}
		}

		return min;
	}

	if (b === undefined) {
		throw new Error("`min` function takes either an array or two numbers");
	}

	if (a < b || a === b) {
		return a;
	}

	return b;
}

function max(arr: number[]): number | null;
function max(a: number, b: number): number;
function max(a: number[] | number, b?: number): number | null {
	if (Array.isArray(a)) {
		if (a.length === 0) return null;

		let max = a[0];
		for (const val of a.slice(1)) {
			if (val > max) {
				max = val;
			}
		}

		return max;
	}

	if (b === undefined) {
		throw new Error("`max` function takes either an array or two numbers");
	}

	if (a >= b) {
		return a;
	}

	return b;
}

export type {
	Updatable,
	Clickable,
	Draggable,
	Scrollable,
	SunPosition,
	UpdatableOrbitControls,
	UpdatablePerspectiveCamera,
	UpdatableOrthographicCamera,
	UpdatableAnimationMixer,
	Transformation,
};

export {
	InteractionType,
	enableShadows,
	disableShadows,
	removeObjWithChildren,
	applyTransformData,
	getRotationAtTime,
	range,
	min,
	max,
};
