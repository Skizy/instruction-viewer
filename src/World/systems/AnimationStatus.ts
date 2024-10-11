import { EventDispatcher } from "three";

class AnimationStatus extends EventDispatcher<{ start: object; stop: object }> {
	start() {
		this.dispatchEvent({ type: "start" });
	}

	stop() {
		this.dispatchEvent({ type: "stop" });
	}
}

export { AnimationStatus };
