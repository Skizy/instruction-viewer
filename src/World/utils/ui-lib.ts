import * as THREE from "three";
import { Text } from "troika-three-text";
import type { MouseHandler } from "../systems/MouseHandler";
import {
	type Clickable,
	type Draggable,
	InteractionType,
	min,
	removeObjWithChildren,
} from "./helpers";

type BlockOptions = {
	width: number;
	height: number;
	borderRadius?: number;
	offset?: number;
	backgroundColor?: THREE.ColorRepresentation;
	material?:
		| THREE.MeshStandardMaterial
		| THREE.MeshBasicMaterial
		| THREE.MeshLambertMaterial
		| THREE.MeshPhongMaterial
		| THREE.MeshToonMaterial;
};

type ShapeOptions = {
	width: number;
	height: number;
	borderRadius?: number;
};

type ButtonColors = {
	background?: THREE.ColorRepresentation;
	hover?: THREE.ColorRepresentation;
	active?: THREE.ColorRepresentation;
	text?: THREE.ColorRepresentation;
	outline?: {
		normal?: THREE.ColorRepresentation;
		hover?: THREE.ColorRepresentation;
		active?: THREE.ColorRepresentation;
	};
	inactive?: {
		background?: THREE.ColorRepresentation;
		text?: THREE.ColorRepresentation;
		outline?: THREE.ColorRepresentation;
	};
};

type ButtonOptions = Omit<BlockOptions, "backgroundColor"> & {
	mouseHandler: MouseHandler;
	text: string;
	textYOffset?: number;
	fontSize?: number;
	fontWeight?: "normal" | "bold";
	font?: string;
	colors?: ButtonColors;
	bottomBlockOpts?: Omit<BlockOptions, "width" | "height"> & {
		width?: number;
		height?: number;
	};
	onMouseDown?: () => void;
	onMouseUp?: () => void;
	onHover?: () => void;
	onBlur?: () => void;
};

type FlexBoxOptions = {
	spacing?: number;
};

type SliderOptions = {
	mouseHandler: MouseHandler;
	onChange?: (val: number) => void;
	width?: number;
	height?: number;
	value?: number;
	backgroundColor?: THREE.ColorRepresentation;
	handleOpts?: HandleOptions;
	edge?: "center" | "end";
};

type HandleOptions = {
	width?: number;
	height?: number;
	borderRadius?: number;
	color?: THREE.ColorRepresentation;
};

type OverflowOptions = {
	width: number;
	height: number;
	visible?: boolean;
};

type CheckboxColors = {
	active?: {
		background?: THREE.ColorRepresentation;
		foreground?: THREE.ColorRepresentation;
		outline?: THREE.ColorRepresentation;
	};
	inactive?: {
		background?: THREE.ColorRepresentation;
		foreground?: THREE.ColorRepresentation;
		outline?: THREE.ColorRepresentation;
	};
};

type CheckboxOptions = {
	mouseHandler: MouseHandler;
	height: number;
	width: number;
	borderRadius?: number;
	borderWidth?: number;
	colors?: CheckboxColors;
	onClick?: () => void;
};

enum ButtonState {
	Normal = 0,
	Hovered = 1,
	Active = 2,
}

class Block {
	#group: THREE.Group;
	#mesh: THREE.Mesh;
	#width: number;
	#height: number;
	readonly borderRadius: number;

	constructor(options: BlockOptions) {
		const opts = { ...options };
		if (!opts.offset) {
			opts.offset = 0.0001;
		}
		if (!opts.backgroundColor) {
			opts.backgroundColor = "#000000";
		}
		const material =
			opts.material ??
			new THREE.MeshStandardMaterial({
				color: opts.backgroundColor,
				// depthTest: false,
				transparent: true,
				opacity: 0.8,
			});

		const geometry = new THREE.ShapeGeometry(createShape({ ...opts }));

		this.#mesh = new THREE.Mesh(geometry, material);
		this.#mesh.name = "ui_block";
		this.#mesh.position.z = opts.offset;
		this.#mesh.renderOrder = -1;
		this.#group = new THREE.Group();
		this.#group.name = "ui_block_group";
		this.#group.add(this.#mesh);
		this.#width = opts.width;
		this.#height = opts.height;
		this.borderRadius = opts.borderRadius ?? 10;
	}

	obj() {
		return this.#group;
	}

	position() {
		return this.#group.position;
	}

	rotation() {
		return this.#group.rotation;
	}

	width() {
		return this.#width;
	}

	height() {
		return this.#height;
	}

	setRotation(x: number, y: number, z: number, order?: THREE.EulerOrder) {
		this.#group.rotation.set(x, y, z, order);
	}

	setBackgroundColor(color: THREE.ColorRepresentation) {
		(this.#mesh.material as THREE.MeshStandardMaterial).color.set(color);
	}

	backgroundColor() {
		return "#".concat(
			(this.#mesh.material as THREE.MeshStandardMaterial).color.getHexString(),
		);
	}

	setOffset(offset: number) {
		this.#mesh.position.z = offset + 0.0001;
	}

	setWidth(width: number) {
		this.#width = width;
		const toBeDisposed = this.#mesh.geometry;
		const newGeometry = new THREE.ShapeGeometry(
			createShape({
				width,
				height: this.#height,
				borderRadius: this.borderRadius,
			}),
		);
		this.#mesh.geometry = newGeometry;
		toBeDisposed.dispose();
	}

	setHeight(height: number) {
		this.#height = height;
		const toBeDisposed = this.#mesh.geometry;
		const newGeometry = new THREE.ShapeGeometry(
			createShape({
				width: this.#width,
				height,
				borderRadius: this.borderRadius,
			}),
		);
		this.#mesh.geometry = newGeometry;
		toBeDisposed.dispose();
	}

	add(object: THREE.Object3D) {
		this.#mesh.add(object);
	}
}

// TODO: Remove blocks in Button implementation ?
class Button {
	#bottomBlock: Block;
	#block: Block;
	#text: Text;
	#colors: {
		background: THREE.ColorRepresentation;
		hover: THREE.ColorRepresentation;
		active: THREE.ColorRepresentation;
		text: THREE.ColorRepresentation;
		outline: {
			normal: THREE.ColorRepresentation;
			hover: THREE.ColorRepresentation;
			active: THREE.ColorRepresentation;
		};
	};
	#inactiveColors: {
		background: THREE.ColorRepresentation;
		text: THREE.ColorRepresentation;
		outline: THREE.ColorRepresentation;
	};
	#inactive = false;
	#state: ButtonState = ButtonState.Normal;
	readonly clickable: Clickable<THREE.Group>;
	onMouseDown?: () => void;
	onMouseUp?: () => void;
	onHover?: () => void;
	onBlur?: () => void;

	constructor(opts: ButtonOptions) {
		/* eslint-disable no-mixed-spaces-and-tabs */
		this.#colors = {
			background: "#4f4fbe",
			hover: "#3f3fce",
			active: "#2f2f9e",
			text: "#ffffff",
			...opts.colors,

			outline: {
				normal: "#000000",
				hover: "#000000",
				active: "#000000",
				...opts.colors?.outline,
			},
		};
		this.#inactiveColors = {
			background: this.#colors.background,
			text: this.#colors.text,
			outline: this.#colors.outline.normal,
			...opts.colors?.inactive,
		};
		/* eslint-enable no-mixed-spaces-and-tabs */
		const localOpts = {
			material: new THREE.MeshBasicMaterial({
				color: this.#colors.background,
				// depthTest: false,
			}),
			...opts,
		};
		this.#block = new Block(localOpts);
		this.#block.obj().children[0].name = "ui_button_top";
		const bottomBlockOpts = {
			width: localOpts.width + localOpts.height * 0.07,
			height: localOpts.height * 1.07,
			borderRadius: localOpts.borderRadius
				? localOpts.borderRadius * 1.1
				: undefined,

			...localOpts.bottomBlockOpts,
		};
		if (bottomBlockOpts.material === undefined) {
			bottomBlockOpts.material = new THREE.MeshBasicMaterial({
				color: this.#colors.outline.normal,
			});
		}
		this.#bottomBlock = new Block(bottomBlockOpts);
		this.#bottomBlock.obj().children[0].name = "ui_button_bottom";
		this.onMouseDown = localOpts.onMouseDown;
		this.onMouseUp = localOpts.onMouseUp;
		this.onHover = localOpts.onHover;
		this.onBlur = localOpts.onBlur;

		const clickable: Clickable<THREE.Group> = {
			obj: this.#block.obj(),
			type: InteractionType.Clickable,
		};
		clickable.onHover = () => {
			this.#state = ButtonState.Hovered;

			if (this.#inactive) {
				return;
			}

			this.#block.setBackgroundColor(this.#colors.hover);
			this.#bottomBlock.setBackgroundColor(this.#colors.outline.hover);
			this.onHover?.();
		};
		clickable.onBlur = () => {
			this.#state = ButtonState.Normal;

			if (this.#inactive) {
				return;
			}

			this.#block.setOffset(localOpts.offset ?? 0.02);
			this.#block.setBackgroundColor(this.#colors.background);
			this.#bottomBlock.setBackgroundColor(this.#colors.outline.normal);
			this.onBlur?.();
		};
		clickable.onMouseDown = () => {
			this.#state = ButtonState.Active;

			if (this.#inactive) {
				return;
			}

			this.#block.setOffset(0);
			this.#block.setBackgroundColor(this.#colors.active);
			this.#bottomBlock.setBackgroundColor(this.#colors.outline.active);
			this.onMouseDown?.();
		};
		clickable.onMouseUp = () => {
			this.#state = ButtonState.Hovered;

			if (this.#inactive) {
				return;
			}

			this.#block.setOffset(localOpts.offset ?? 0.02);
			this.#block.setBackgroundColor(this.#colors.hover);
			this.#bottomBlock.setBackgroundColor(this.#colors.outline.hover);
			this.onMouseUp?.();
		};

		this.clickable = clickable;

		localOpts.mouseHandler.add(clickable);

		const text = new Text();

		this.#block.add(text);

		text.name = "Button text";

		text.text = localOpts.text;
		text.fontSize = localOpts.fontSize ?? 0.1;
		if (localOpts.font) {
			text.font = localOpts.font;
		}
		text.color = this.#colors.text;
		text.anchorX = "center";
		text.anchorY = "middle";
		if (localOpts.fontWeight) {
			text.fontWeight = localOpts.fontWeight;
		}
		if (localOpts.textYOffset !== undefined) {
			text.position.y = localOpts.textYOffset;
		}
		// text.position.z += 0.001;

		// text.renderOrder = -1;

		text.sync();
		this.#text = text;

		this.#bottomBlock.add(this.#block.obj());
	}

	dispose() {
		removeObjWithChildren(this.#bottomBlock.obj());
	}

	get colors() {
		return { ...this.#colors };
	}

	set colors(colors: ButtonColors) {
		if (colors.text) {
			this.#text.color = colors.text;
			this.#text.sync();
		}

		if (this.#state === ButtonState.Normal) {
			if (colors.background) {
				this.#block.setBackgroundColor(colors.background);
			}
			if (colors.outline) {
				if (colors.outline.normal) {
					this.#bottomBlock.setBackgroundColor(colors.outline.normal);
				}
			}
		} else if (this.#state === ButtonState.Hovered) {
			if (colors.hover) {
				this.#block.setBackgroundColor(colors.hover);
			}
			if (colors.outline) {
				if (colors.outline.hover) {
					this.#bottomBlock.setBackgroundColor(colors.outline.hover);
				}
			}
		} else if (this.#state === ButtonState.Active) {
			if (colors.active) {
				this.#block.setBackgroundColor(colors.active);
			}
			if (colors.outline) {
				if (colors.outline.active) {
					this.#bottomBlock.setBackgroundColor(colors.outline.active);
				}
			}
		}

		this.#colors = {
			...this.#colors,
			...colors,
			outline: { ...this.#colors.outline, ...colors.outline },
		};
	}

	block() {
		return this.#bottomBlock;
	}

	obj() {
		return this.#bottomBlock.obj();
	}

	get inactive() {
		return this.#inactive;
	}

	set inactive(val: boolean) {
		this.#inactive = val;

		if (val) {
			this.#block.setBackgroundColor(this.#inactiveColors.background);
			this.#bottomBlock.setBackgroundColor(this.#inactiveColors.outline);
			this.#text.color = this.#inactiveColors.text;

			this.clickable.hovercursor = "default";
		} else {
			this.#text.color = this.#colors.text;

			if (this.#state === ButtonState.Normal) {
				this.#block.setBackgroundColor(this.#colors.background);
				this.#bottomBlock.setBackgroundColor(this.#colors.outline.normal);
			} else if (this.#state === ButtonState.Hovered) {
				this.#block.setBackgroundColor(this.#colors.hover);
				this.#bottomBlock.setBackgroundColor(this.#colors.outline.hover);
			} else if (this.#state === ButtonState.Active) {
				this.#block.setBackgroundColor(this.#colors.active);
				this.#bottomBlock.setBackgroundColor(this.#colors.outline.active);
			}

			this.clickable.hovercursor = "pointer";
		}

		this.#text.sync();
	}
}

class ToggleableButton<T> extends Button {
	state: T;

	constructor(opts: ButtonOptions & { initialState: T }) {
		super(opts);

		this.state = opts.initialState;
	}
}

class FlexBox {
	#spacing: number;
	#group: THREE.Group;
	#children: Block[];

	constructor(opts: FlexBoxOptions) {
		this.#spacing = opts.spacing ?? 0.05;

		this.#group = new THREE.Group();

		// const plane = new THREE.Mesh(
		// 	new THREE.PlaneGeometry(1, 1),
		// 	new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
		// );
		// plane.rotateX(-Math.PI / 2);
		// this.#group.add(plane);

		this.#children = [];
	}

	add(block: Block) {
		this.#children.push(block);
		this.#group.add(block.obj());

		this.recalculateSize();
	}

	/** Only removes the block from `FlexBox`'s children.
	 *  Doesn't dispose of the geometry or material */
	remove(block: Block) {
		this.#children = this.#children.filter((x) => x !== block);
		this.#group.children = this.#group.children.filter(
			(x) => x !== block.obj(),
		);

		this.recalculateSize();
	}

	recalculateSize() {
		let newHeight = this.#children
			.map((x) => x.height() + this.#spacing)
			.reduce((sum, cur) => sum + cur, 0);

		if (this.#children.length > 0) {
			newHeight -= this.#spacing;
		}

		for (let i = 0; i < this.#children.length; i += 1) {
			const obj = this.#group.children.find(
				(x) => x.uuid === this.#children[i].obj().uuid,
			);
			if (!obj) {
				console.error("Couldn't find the object");
				continue;
			}

			obj.position.y =
				newHeight / 2 -
				this.#children
					.slice(0, i)
					.map((x) => x.height() + this.#spacing)
					.reduce((sum, cur) => sum + cur, 0) -
				this.#children[i].height() / 2;
		}
	}

	children() {
		return this.#children;
	}

	height() {
		return this.#children
			.map((x) => x.height() + this.#spacing)
			.reduce((sum, cur) => sum + cur, 0);
	}

	obj() {
		return this.#group;
	}
}

class Slider {
	#group: THREE.Group;
	#trough: THREE.Mesh;
	#handle: THREE.Mesh;
	#handleOpts: { width: number; height: number; borderRadius?: number };
	#edge: "center" | "end";
	#width: number;
	#height: number;
	// #height: number;
	#plane: THREE.Plane;
	#value: number;
	onChange?: (val: number) => void;

	/** Value is 0 - 100 */
	constructor(opts: SliderOptions) {
		const {
			mouseHandler,
			width = 0.8,
			height = 0.05,
			value = 0,
			onChange,
		} = opts;
		this.#value = value;
		this.onChange = onChange;

		this.#trough = new THREE.Mesh(
			new THREE.PlaneGeometry(width - height, height),
			new THREE.MeshBasicMaterial({ color: opts.backgroundColor ?? "grey" }),
		);
		this.#trough.name = "ui_slider_trough";

		const leftEnd = new THREE.Mesh(
			new THREE.CircleGeometry(height / 2, 32, Math.PI / 2, Math.PI),
			new THREE.MeshBasicMaterial({ color: opts.backgroundColor ?? "grey" }),
		);
		leftEnd.name = "ui_trough_left_end";
		const rightEnd = new THREE.Mesh(
			new THREE.CircleGeometry(height / 2, 32, -Math.PI / 2, Math.PI),
			new THREE.MeshBasicMaterial({ color: opts.backgroundColor ?? "grey" }),
		);
		rightEnd.name = "ui_trough_right_end";

		leftEnd.position.setX(-width / 2 + height / 2);
		rightEnd.position.setX(width / 2 - height / 2);

		this.#trough.add(leftEnd, rightEnd);

		const handleOptsProps = opts.handleOpts;
		const handleOpts: {
			height: number;
			width?: number;
			borderRadius?: number;
			color?: THREE.ColorRepresentation;
		} =
			handleOptsProps !== undefined
				? handleOptsProps.height !== undefined
					? (handleOptsProps as unknown as {
							height: number;
							width?: number;
							borderRadius?: number;
							color?: THREE.ColorRepresentation;
							// eslint-disable-next-line no-mixed-spaces-and-tabs
						})
					: { ...handleOptsProps, height: height * 2 }
				: { height: height * 2 };

		this.#edge = opts.edge ?? "center";
		this.#handleOpts = { width: 0.05, ...handleOpts };

		this.#handle = new THREE.Mesh(
			createSliderHandleGeometry(handleOpts),
			new THREE.MeshBasicMaterial({ color: handleOpts.color ?? "white" }),
		);
		this.#handle.name = "ui_slider_handle";

		this.#handle.position.setX(
			((this.#edge === "center" ? width : width - this.#handleOpts.width) *
				(value - 50)) /
				100,
		);

		this.#trough.add(this.#handle);

		this.#group = new THREE.Group();
		this.#group.add(this.#trough);
		this.#group.name = "ui_slider_group";

		this.#plane = new THREE.Plane();
		const points = [
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(-1, 1, 0),
			new THREE.Vector3(-1, 0, 0),
		].map((x) => this.#trough.localToWorld(x));
		this.#plane.setFromCoplanarPoints(points[0], points[1], points[2]);

		const draggable: Draggable<THREE.Mesh> = {
			obj: this.#trough,
			type: InteractionType.Draggable,
			getPlane: () => this.#plane,
			intersection: new THREE.Vector3(),
		};

		draggable.onMouseDown = (intersection) => {
			points[0].set(0, 1, 0);
			points[1].set(-1, 1, 0);
			points[2].set(-1, 0, 0);

			// biome-ignore lint/complexity/noForEach: stupid lint
			points.forEach((x) => this.#trough.localToWorld(x));
			this.#plane.setFromCoplanarPoints(points[0], points[1], points[2]);

			this.#trough.worldToLocal(intersection);

			let val =
				(100 * intersection.x) /
					(this.#edge === "center"
						? this.#width
						: this.#width - this.#handleOpts.width) +
				50;

			if (val > 100) {
				val = 100;
			} else if (val < 0) {
				val = 0;
			}

			this.onChange?.(val);
		};

		this.#width = width;
		this.#height = height;

		draggable.onDrag = (intersection) => {
			this.#trough.worldToLocal(intersection);

			let val =
				(100 * intersection.x) /
					(this.#edge === "center"
						? this.#width
						: this.#width - this.#handleOpts.width) +
				50;

			if (val > 100) {
				val = 100;
			} else if (val < 0) {
				val = 0;
			}

			this.onChange?.(val);
		};

		mouseHandler.addDraggable(draggable);
	}

	obj() {
		return this.#group;
	}

	height() {
		return this.#height;
	}

	width() {
		return this.#width;
	}

	getValue() {
		return this.#value;
	}

	setValue(val: number) {
		this.#value = val;

		this.#handle.position.setX(
			((this.#edge === "center"
				? this.#width
				: this.#width - this.#handleOpts.width) *
				(val - 50)) /
				100,
		);
	}

	setWidth(width: number) {
		const leftEnd = this.#trough.getObjectByName("ui_trough_left_end");
		const rightEnd = this.#trough.getObjectByName("ui_trough_right_end");

		if (leftEnd === undefined || rightEnd === undefined) {
			console.error("couldn't find trough ends");
			return;
		}

		const newGeometry = new THREE.PlaneGeometry(
			width - this.#height,
			this.#height,
		);
		const toBeDisposed = this.#trough.geometry;
		this.#trough.geometry = newGeometry;
		toBeDisposed.dispose();

		leftEnd.position.setX(-width / 2 + this.#height / 2);
		rightEnd.position.setX(width / 2 - this.#height / 2);

		this.#handle.position.setX(
			((this.#edge === "center" ? width : width - this.#handleOpts.width) *
				(this.#value - 50)) /
				100,
		);

		this.#width = width;
	}

	setHandleWidth(width: number) {
		const toBeDisposed = this.#handle.geometry;

		this.#handleOpts.width = width;

		this.#handle.geometry = createSliderHandleGeometry(this.#handleOpts);

		toBeDisposed.dispose();

		this.setValue(this.#value);
	}

	hideHandle() {
		if (this.#handle.visible) {
			this.#handle.visible = false;
		}
	}

	showHandle() {
		if (!this.#handle.visible) {
			this.#handle.visible = true;
		}
	}
}

/** Needs to be updated to keep clipping planes in sync */
class Overflow {
	#group: THREE.Group;
	#block: Block;
	#clippingPlanes: THREE.Plane[];
	#planeMeshes: THREE.Mesh[];

	/** Needs to be updated to keep clipping planes in sync */
	constructor(opts: OverflowOptions) {
		this.#group = new THREE.Group();
		this.#group.name = "ui_overflow_group";
		let material = undefined;
		if (opts.visible === false) {
			material = new THREE.MeshBasicMaterial({ visible: false });
		}

		this.#block = new Block({ ...opts, borderRadius: 0, material });
		this.#block.obj().children[0].name = "ui_overflow_block";

		const plane = new THREE.Plane();
		this.#clippingPlanes = [plane, plane.clone(), plane.clone(), plane.clone()];
		const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry());
		planeMesh.visible = false;
		this.#planeMeshes = [
			planeMesh,
			planeMesh.clone(),
			planeMesh.clone(),
			planeMesh.clone(),
		];

		for (let i = 0; i < 4; i += 1) {
			this.#planeMeshes[i].name = `ui_overflow_plane_${i}`;
		}

		this.#planeMeshes[0].rotation.set(-Math.PI / 2, 0, 0);
		this.#planeMeshes[0].position.set(0, this.#block.height() / 2, 0);
		this.#planeMeshes[0].updateMatrixWorld(true);

		this.#planeMeshes[1].rotation.set(0, Math.PI / 2, 0);
		this.#planeMeshes[1].position.set(this.#block.width() / 2, 0, 0);
		this.#planeMeshes[1].updateMatrixWorld(true);

		this.#planeMeshes[2].rotation.set(Math.PI / 2, 0, 0);
		this.#planeMeshes[2].position.set(0, -this.#block.height() / 2, 0);
		this.#planeMeshes[2].updateMatrixWorld(true);

		this.#planeMeshes[3].rotation.set(0, -Math.PI / 2, 0);
		this.#planeMeshes[3].position.set(-this.#block.width() / 2, 0, 0);
		this.#planeMeshes[3].updateMatrixWorld(true);

		const blockObj = this.#block.obj();
		blockObj.add(...this.#planeMeshes);
		this.#group.add(blockObj);

		this.update();
	}

	obj() {
		return this.#group;
	}

	height() {
		return this.#block.height();
	}

	width() {
		return this.#block.width();
	}

	add(object: THREE.Object3D) {
		object.traverse((o) => {
			const obj = o as (THREE.Object3D & { isMesh: false }) | THREE.Mesh;
			if (obj.isMesh) {
				if (Array.isArray(obj.material)) {
					console.error("not handling material array right now");
				} else {
					if (Array.isArray(obj.material.clippingPlanes)) {
						obj.material.clippingPlanes = obj.material.clippingPlanes.concat(
							this.#clippingPlanes,
						);
					} else {
						obj.material.clippingPlanes = this.#clippingPlanes;
					}
				}
			}
		});

		this.#block.add(object);
	}

	update() {
		for (const plane of this.#clippingPlanes) {
			plane.normal.set(0, 0, -1);
			plane.constant = 0;
		}

		this.#clippingPlanes[0].applyMatrix4(this.#planeMeshes[0].matrixWorld);
		this.#clippingPlanes[1].applyMatrix4(this.#planeMeshes[1].matrixWorld);
		this.#clippingPlanes[2].applyMatrix4(this.#planeMeshes[2].matrixWorld);
		this.#clippingPlanes[3].applyMatrix4(this.#planeMeshes[3].matrixWorld);
	}

	updateClippingPlanes() {
		this.#block.obj().traverse((o) => {
			const obj = o as (THREE.Object3D & { isMesh: false }) | THREE.Mesh;
			if (obj.isMesh) {
				if (Array.isArray(obj.material)) {
					console.error("not handling material array right now");
				} else {
					if (Array.isArray(obj.material.clippingPlanes)) {
						const existingClippingPlanes = obj.material.clippingPlanes;
						const concatSet = new Set(existingClippingPlanes);
						for (const plane of this.#clippingPlanes) {
							concatSet.add(plane);
						}
						obj.material.clippingPlanes = Array.from(concatSet);
					} else {
						obj.material.clippingPlanes = this.#clippingPlanes;
					}
				}
			}
		});
	}
}

class Checkbox {
	#outerMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
	#colors: {
		active: {
			background: THREE.ColorRepresentation;
			foreground: THREE.ColorRepresentation;
			outline: THREE.ColorRepresentation;
		};
		inactive: {
			background: THREE.ColorRepresentation;
			foreground: THREE.ColorRepresentation;
			outline: THREE.ColorRepresentation;
		};
	};
	#obj: THREE.Group;
	#checked = false;
	onClick?: () => void;

	/** Border radius in cm */
	constructor(opts: CheckboxOptions) {
		const colors = {
			active: {
				background: "#ffffff",
				foreground: "#000000",
				outline: "#ffffff",
				...opts.colors?.active,
			},
			inactive: {
				background: "#000000",
				foreground: "#ffffff",
				outline: "#ffffff",
				...opts.colors?.inactive,
			},
		};
		this.#colors = colors;
		this.onClick = opts.onClick;

		const borderWidth = opts.borderWidth ?? min(opts.height, opts.width) * 0.04;
		const shape = createShape({
			height: opts.height,
			width: opts.width,
			borderRadius: opts.borderRadius ?? opts.width * 5,
		});
		const outlineShape = createShape({
			height: opts.height + borderWidth,
			width: opts.width + borderWidth,
			borderRadius: opts.borderRadius ?? opts.width * 5,
		});
		const outlineMesh = new THREE.Mesh(
			new THREE.ShapeGeometry(outlineShape),
			new THREE.MeshBasicMaterial({ color: colors.inactive.outline }),
		);
		const mainMesh = new THREE.Mesh(
			new THREE.ShapeGeometry(shape),
			new THREE.MeshBasicMaterial({ color: colors.inactive.background }),
		);
		outlineMesh.add(mainMesh);

		const checkmark = new THREE.Mesh(
			createCheckmarkGeometry({
				height: opts.height * 0.5,
				lineWidth: opts.height * 0.05,
			}),
			new THREE.MeshBasicMaterial({ color: colors.inactive.foreground }),
		);
		mainMesh.add(checkmark);

		this.#outerMesh = outlineMesh;

		this.#obj = new THREE.Group();

		this.#obj.add(outlineMesh);

		const clickable: Clickable<THREE.Mesh> = {
			obj: outlineMesh,
			type: InteractionType.Clickable,
			onMouseUp: () => {
				this.onClick?.();
			},
		};

		opts.mouseHandler.add(clickable);
	}

	obj() {
		return this.#obj;
	}

	checked() {
		return this.#checked;
	}

	setChecked(checked: boolean) {
		this.#checked = checked;

		if (checked) {
			this.#outerMesh.material.color.set(this.#colors.active.outline);
			(
				this.#outerMesh.children[0] as THREE.Mesh<
					THREE.BufferGeometry,
					THREE.MeshBasicMaterial
				>
			).material.color.set(this.#colors.active.background);
			(
				this.#outerMesh.children[0].children[0] as THREE.Mesh<
					THREE.BufferGeometry,
					THREE.MeshBasicMaterial
				>
			).material.color.set(this.#colors.active.foreground);
		} else {
			this.#outerMesh.material.color.set(this.#colors.inactive.outline);
			(
				this.#outerMesh.children[0] as THREE.Mesh<
					THREE.BufferGeometry,
					THREE.MeshBasicMaterial
				>
			).material.color.set(this.#colors.inactive.background);
			(
				this.#outerMesh.children[0].children[0] as THREE.Mesh<
					THREE.BufferGeometry,
					THREE.MeshBasicMaterial
				>
			).material.color.set(this.#colors.inactive.foreground);
		}
	}
}

/** Border radius in cm */
function createShape(options: ShapeOptions) {
	const opts = { ...options };
	if (opts.borderRadius === undefined) {
		opts.borderRadius = 10;
	}

	const width = opts.width;
	const height = opts.height;
	let borderRadius = opts.borderRadius / 100;

	if (borderRadius > min(width, height) / 2) {
		borderRadius = min(width, height) / 2;
	}

	const shape = new THREE.Shape();

	shape.moveTo(-width / 2, height / 2 - borderRadius);

	shape.lineTo(-width / 2, -height / 2 + borderRadius);

	shape.arc(borderRadius, 0, borderRadius, Math.PI, (Math.PI * 3) / 2);

	shape.lineTo(width / 2 - borderRadius, -height / 2);

	shape.arc(0, borderRadius, borderRadius, (Math.PI * 3) / 2, 0);

	shape.lineTo(width / 2, height / 2 - borderRadius);

	shape.arc(-borderRadius, 0, borderRadius, 0, Math.PI / 2);

	shape.lineTo(-width / 2 + borderRadius, height / 2);

	shape.arc(0, -borderRadius, borderRadius, Math.PI / 2, Math.PI);

	return shape;
}

function createCheckmarkGeometry(opts: {
	height: number;
	lineWidth: number;
}) {
	const h = opts.height;
	const w = opts.lineWidth;

	const f = 1.5 * (h - w * (3 * Math.SQRT1_2));

	const s2 = Math.SQRT2;

	const points = [
		[f / 3, w * s2],
		[f - w / s2, h],
		[f, h - w / s2],
		[f / 3, 0],
		[0, f / 3],
		[w / s2, f / 3 + w / s2],
	]
		.map((p) => [p[0] - f / 2, p[1] - h / 2])
		.map((point) => new THREE.Vector2(point[0], point[1]));

	const shape = new THREE.Shape(points);

	return new THREE.ShapeGeometry(shape);
}

function createSliderHandleGeometry(options: {
	height: number;
	width?: number;
	borderRadius?: number;
}) {
	const borderRadius = (options.borderRadius ?? 0.05) * 100;
	const width = options.width ?? 0.1;

	const shape = createShape({ height: options.height, width, borderRadius });

	return new THREE.ShapeGeometry(shape);
}

export type { BlockOptions };
export { Block, Button, ToggleableButton, FlexBox, Slider, Overflow, Checkbox };
