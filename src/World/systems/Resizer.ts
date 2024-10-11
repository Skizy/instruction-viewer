import type {
	OrthographicCamera,
	PerspectiveCamera,
	WebGLRenderer,
} from "three";

function setSize(
	container: HTMLElement,
	camera: PerspectiveCamera,
	renderer: WebGLRenderer,
) {
	camera.aspect = container.clientWidth / container.clientHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
}

function setUiCameraSize(container: HTMLElement, camera: OrthographicCamera) {
	camera.top = container.clientHeight / 800;
	camera.bottom = container.clientHeight / -800;
	camera.left = container.clientWidth / -800;
	camera.right = container.clientWidth / 800;

	camera.updateProjectionMatrix();
}

class Resizer {
	#container: HTMLElement;
	#camera: PerspectiveCamera;
	#uiCamera: OrthographicCamera;
	#renderer: WebGLRenderer;
	#bindedCallback: () => void;
	#callbacks: (() => void)[];

	constructor(
		container: HTMLElement,
		camera: PerspectiveCamera,
		renderer: WebGLRenderer,
		uiCamera: OrthographicCamera,
	) {
		this.#container = container;
		this.#camera = camera;
		this.#uiCamera = uiCamera;
		this.#renderer = renderer;
		this.#callbacks = [];

		setSize(container, camera, renderer);
		setUiCameraSize(container, uiCamera);

		this.#bindedCallback = this.onResize.bind(this);

		window.addEventListener("resize", this.#bindedCallback);
	}

	setCamera(camera: PerspectiveCamera) {
		this.#camera = camera;
	}

	addCallback(callback: () => void) {
		this.#callbacks.push(callback);
	}

	onResize() {
		setSize(this.#container, this.#camera, this.#renderer);
		setUiCameraSize(this.#container, this.#uiCamera);

		for (const callback of this.#callbacks) {
			callback();
		}
	}

	stop() {
		window.removeEventListener("resize", this.#bindedCallback);
	}
}

export { Resizer };
