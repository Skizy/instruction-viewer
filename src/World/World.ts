import { createCamera, createUiCamera } from "./components/camera";
import { createEnvironment } from "./components/environment";
import { createLights } from "./components/lights";
import { createScene } from "./components/scene";
import { loadGltf, loadGltfFromStringRaw } from "./utils/loadGltf";
import { SliderManager, UI } from "./utils/ui";

import { Animator } from "./systems/Animator";
import { FocusPoint } from "./systems/FocusPoint";
import { Loop } from "./systems/Loop";
import { MouseHandler } from "./systems/MouseHandler";
import { Resizer } from "./systems/Resizer";
import { createControls } from "./systems/controls";
import { createMover } from "./systems/menuMover";
import { createRenderer } from "./systems/renderer";

import type { UpdatableOrbitControls } from "./utils/helpers";

import {
	type Group,
	Object3D,
	type OrthographicCamera,
	type PerspectiveCamera,
	Scene,
	Vector3,
	type WebGLRenderer,
} from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

class World {
	#camera: PerspectiveCamera;
	#scene: Scene;
	#uiScene: Scene = new Scene();
	#uiCamera: OrthographicCamera;
	#renderer: WebGLRenderer;
	#loop: Loop;
	#controls: UpdatableOrbitControls;
	#resizer: Resizer;
	#mouseHandler: MouseHandler;

	#ui: UI;

	constructor(container: HTMLElement, returnToMenu: () => void) {
		this.#camera = createCamera();
		this.#uiCamera = createUiCamera();

		this.#scene = createScene();
		this.#renderer = createRenderer();
		container.append(this.#renderer.domElement);
		// if (isXRAvailable()) {
		container.appendChild(VRButton.createButton(this.#renderer));
		// }
		this.#resizer = new Resizer(
			container,
			this.#camera,
			this.#renderer,
			this.#uiCamera,
		);

		this.#loop = new Loop(
			this.#camera,
			this.#scene,
			this.#renderer,
			this.#uiScene,
			this.#uiCamera,
		);

		this.#controls = createControls(this.#camera, this.#renderer.domElement);
		this.#loop.updatables.push(this.#controls);

		this.#mouseHandler = new MouseHandler(
			this.#uiCamera,
			this.#renderer.domElement,
			undefined,
			(enabled) => {
				this.#controls.enableZoom = enabled;
			},
		);

		const lights = createLights();
		this.#scene.add(...lights);

		const environment = createEnvironment();
		this.#scene.add(environment);

		const ui = new UI(this.#mouseHandler, null, 1);
		this.#ui = ui;

		this.#loop.updatables.push({ tick: (delta) => this.#ui?.update(delta) });

		const mainUIBlock = ui.mainBlock;

		this.#uiScene.add(this.#uiCamera);
		this.#uiCamera.add(mainUIBlock.obj());

		this.#uiCamera.add(ui.buttons.mainMenu.obj());

		const mover = createMover(mainUIBlock, ui.buttons.mainMenu, this.#uiCamera);

		mover.move();

		this.#resizer.addCallback(mover.move);

		const bigSlider = ui.slider.block;
		bigSlider.position().set(-0.05, 1, -2);
		this.#uiCamera.add(bigSlider.obj());
		const sliderManager = SliderManager(
			bigSlider,
			ui.slider.slider,
			mainUIBlock.width() + this.#ui.buttons.play.block().width() + 0.06,
			ui.buttons.mainMenu.block().width() + 0.03,
			this.#uiCamera,
		);
		sliderManager.onResize();

		this.#resizer.addCallback(sliderManager.onResize);

		this.#ui.buttons.mainMenu.onMouseUp = () => {
			this.#mouseHandler.stop();
			this.stop();

			returnToMenu();
		};
	}

	async loadModel(
		modelData: ArrayBuffer,
		assets: Record<string, Blob | File>,
		debugChanges?: (obj: GLTF) => void,
	) {
		const model = await loadGltfFromStringRaw(modelData, assets);

		if (model.cameras.length > 0) {
			const cam = model.cameras[0] as PerspectiveCamera;

			this.#setupGLTFCamera(cam);

			await this.#setupFocusPoint(model.scene);
		} else {
			console.warn("no cameras found in gltf");
		}

		const animator = new Animator(
			model.animations,
			this.#ui,
			this.#controls,
			this.#loop,
			this.#camera,
			model.scene,
		);
		this.#mouseHandler.setControlsEnabled = (enabled) => {
			if (!enabled) {
				this.#controls.enabled = false;
				this.#controls.dispatchEvent({ type: "end" });
			} else {
				if (animator.controlsState.locallyEnabled === true) {
					this.#controls.enabled = true;
				}
			}
		};

		if (debugChanges) {
			debugChanges(model);
		}

		this.#scene.add(model.scene);

		this.#mouseHandler.start();
		this.start();
	}

	start() {
		this.#loop.start();
	}

	stop() {
		this.#loop.stop();
	}

	stopResizer() {
		this.#resizer.stop();
	}

	#setupGLTFCamera(camera: PerspectiveCamera) {
		camera.fov = 50;
		camera.far = 200;
		camera.updateProjectionMatrix();

		const target = new Object3D();
		target.position.z = -1;
		camera.add(target);

		this.#controls.target = target.getWorldPosition(new Vector3());

		this.#resizer.setCamera(camera);
		this.#resizer.onResize();
		this.#loop.camera = camera;
		this.#camera = camera;
		this.#controls.object = this.#camera;
	}

	async #setupFocusPoint(scene: Group) {
		const ballModel = (await loadGltf("/public/focus_sphere.glb")).scene;
		ballModel.children[0].scale.set(0.005, 0.005, 0.005);
		new FocusPoint(this.#camera, scene, this.#controls, ballModel);
	}
}

function isXRAvailable() {
	if ("xr" in navigator && window.isSecureContext) {
		return true;
	}

	return false;
}

export { World };
