import {
	Clock,
	type OrthographicCamera,
	type PerspectiveCamera,
	type Scene,
	type WebGLRenderer,
} from "three";
import type { Updatable } from "../utils/helpers";

class Loop {
	#clock: Clock;
	camera: PerspectiveCamera;
	scene: Scene;
	renderer: WebGLRenderer;
	updatables: Updatable[];
	uiScene?: Scene;
	uiCamera?: OrthographicCamera;

	constructor(
		camera: PerspectiveCamera,
		scene: Scene,
		renderer: WebGLRenderer,
		uiScene?: Scene,
		uiCamera?: OrthographicCamera,
	) {
		this.camera = camera;
		this.scene = scene;
		this.renderer = renderer;
		this.uiScene = uiScene;
		this.uiCamera = uiCamera;
		this.updatables = [];

		this.#clock = new Clock();
	}

	start() {
		this.renderer.setAnimationLoop(() => {
			this.tick();

			this.renderer.clear();

			this.renderer.render(this.scene, this.camera);
			if (this.uiScene && this.uiCamera) {
				this.renderer.clearDepth();
				this.renderer.render(this.uiScene, this.uiCamera);
			}
		});
	}

	stop() {
		this.renderer.setAnimationLoop(null);
	}

	tick() {
		const delta = this.#clock.getDelta();

		for (const o of this.updatables) {
			o.tick(delta);
		}
	}
}

export { Loop };
