import {
	type AnimationAction,
	AnimationClip,
	type AnimationMixer,
	type Event,
	type Group,
	type Interpolant,
	LoopOnce,
	type PerspectiveCamera,
	Quaternion,
	QuaternionKeyframeTrack,
	Vector3,
	VectorKeyframeTrack,
} from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
	type Transformation,
	applyTransformData,
	max,
	min,
} from "../utils/helpers";
import { PlayButtonState, type UI } from "../utils/ui";
import type { ToggleableButton } from "../utils/ui-lib";
import { AnimationStatus } from "./AnimationStatus";
import type { Loop } from "./Loop";
import { getTransformData, prepareClips } from "./animationTransformer";

type Stage = {
	transformData: Transformation[];
	objAction: AnimationAction;
	camAction: AnimationAction;
	camInterpolants: { position: Interpolant; quaternion: Interpolant };
};

type ControlsState = {
	locallyEnabled: boolean;
};

class Animator {
	#data: Map<number, Stage> = new Map();
	#stage: number;

	#mixer: AnimationMixer;

	readonly eventDispatcher: AnimationStatus;

	#_transformData: Map<number, Transformation[]> = new Map();
	#model: Group;

	#timeScale = 1;

	#ui: UI;

	#controls: OrbitControls;
	controlsState: ControlsState;

	#camera: PerspectiveCamera;

	#helperVecs = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
	#helperQuats = [new Quaternion(), new Quaternion()];

	#transitionIsActive = false;

	constructor(
		animations: AnimationClip[],
		ui: UI,
		controls: OrbitControls,
		loop: Loop,
		camera: PerspectiveCamera,
		model: Group,
	) {
		this.#ui = ui;
		this.#controls = controls;
		this.#stage = 1;
		this.controlsState = { locallyEnabled: true };
		this.#camera = camera;
		this.#model = model;

		this.eventDispatcher = new AnimationStatus();

		this.eventDispatcher.addEventListener("start", () => {
			if (this.#ui.settingsMenu.checkbox.checked()) {
				this.#controls.enabled = false;
				this.controlsState.locallyEnabled = false;
			}
		});
		this.eventDispatcher.addEventListener("stop", () => {
			this.#controls.enabled = true;
			this.controlsState.locallyEnabled = true;
		});

		loop.updatables.push({ tick: () => this.#updateSlider() });

		this.#ui.buttons.next.onMouseUp = () => this.#playNext();

		this.#ui.buttons.play.onMouseUp = () => {
			if (this.#ui.buttons.play.state === PlayButtonState.Play) {
				this.#playNext();
			} else if (this.#ui.buttons.play.state === PlayButtonState.Pause) {
				this.#pause();
			}
		};

		this.#ui.buttons.prev.onMouseUp = () => this.#playBack();

		this.#ui.slider.slider.onChange = (val) => this.#setTimeFromSlider(val);

		this.#ui.settingsMenu.speedSlider.setValue(50);

		this.#ui.settingsMenu.speedSlider.onChange = (val) => {
			if (val < 52 && val > 48) {
				// biome-ignore lint/style/noParameterAssign: this way slider can stick to 50
				val = 50;
			}
			this.#timeScale = percentToTimescale(val);
			this.#ui.settingsMenu.speedSlider.setValue(val);
			this.#updatePlaybackSpeed();
		};

		this.#ui.settingsMenu.resetSpeedButton.onMouseUp = () => {
			this.#timeScale = 1;
			this.#ui.settingsMenu.speedSlider.setValue(50);
			this.#updatePlaybackSpeed();
		};

		const { transformData, camClips, objClips } = getTransformData(
			animations,
			model,
		);
		this.#_transformData = transformData;
		this.#setStage(Array.from(transformData.keys()).sort((a, b) => a - b)[0]);

		const { mixer, camActions, actions } = prepareClips(
			camClips,
			objClips,
			model,
		);

		getStageData(camActions, actions, transformData, this.#data);

		const stageNumbers = Array.from(camActions.keys()).sort((a, b) => a - b);
		this.#ui.createButtons(
			stageNumbers.concat(
				Array.from(transformData.keys()).sort((a, b) => b - a)[0],
			),
		);

		if (this.#ui.buttons.stages === null) {
			console.error("#unreachable. Creating buttons above");
			throw "unreachable";
		}

		const firstStageButton = this.#ui.buttons.stages.get(this.#stage);
		if (firstStageButton !== undefined) {
			firstStageButton.colors = this.#ui.activeButtonColors;
		}

		for (const [stageNum, button] of this.#ui.buttons.stages) {
			const tData = transformData.get(stageNum);

			if (tData === undefined) {
				console.error("Couldn't find transformData for stage", stageNum);
				continue;
			}

			button.onMouseUp = () => {
				// Disable current camera action and object action
				// Apply transformData

				const camAction = camActions.get(this.#stage);
				const action = actions.get(this.#stage);

				if (camAction !== undefined) {
					camAction.stop().reset();
				}

				if (action !== undefined) {
					action.stop().reset();
				}

				applyTransformData(tData, model);

				const prevActive = this.#ui.buttons.stages?.get(this.#stage);
				if (prevActive !== undefined) {
					prevActive.colors = this.#ui.defaultButtonColors;
				}

				const curActive = this.#ui.buttons.stages?.get(stageNum);
				if (curActive !== undefined) {
					curActive.colors = this.#ui.activeButtonColors;
				}

				if (this.#data.get(stageNum) === undefined) {
					this.#ui.buttons.next.inactive = true;
				} else {
					this.#ui.buttons.next.inactive = false;
				}
				if (this.#data.get(stageNum - 1) === undefined) {
					this.#ui.buttons.prev.inactive = true;
				} else {
					this.#ui.buttons.prev.inactive = false;
				}

				this.#setStage(stageNum);
			};
		}

		mixer.addEventListener("finished", (e) => {
			const isCamAction = e.action.getClip().name.startsWith("cam_");
			const isCamTransition = e.action.getClip().name === "camTransition";
			if (
				(this.#ui.settingsMenu.checkbox.checked() && !isCamAction) ||
				isCamTransition
			) {
				return;
			}

			if (isCamAction) {
				this.#controls.target = this.#camera.children[0].getWorldPosition(
					this.#helperVecs[2],
				);

				this.#helperVecs[3].copy(this.#camera.position);
				this.#helperQuats[0].copy(this.#camera.quaternion);
				e.action.reset().stop();
				this.#camera.position.copy(this.#helperVecs[3]);
				this.#camera.quaternion.copy(this.#helperQuats[0]);
			}

			this.eventDispatcher.dispatchEvent({ type: "stop" });

			setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Play);

			if (e.direction === 1) {
				this.#ui.buttons.prev.inactive = false;

				this.#data.get(this.#stage)?.objAction.reset().stop();

				const nextStageTData = this.#_transformData.get(this.#stage + 1);
				if (nextStageTData !== undefined) {
					applyTransformData(nextStageTData, model);

					this.#setStage(this.#stage + 1);

					if (this.#ui.buttons.stages !== null) {
						const toDisable = this.#ui.buttons.stages.get(this.#stage - 1);
						if (toDisable !== undefined) {
							toDisable.colors = this.#ui.defaultButtonColors;
						}
						const toEnable = this.#ui.buttons.stages.get(this.#stage);
						if (toEnable !== undefined) {
							toEnable.colors = this.#ui.activeButtonColors;
						}
					}

					if (this.#data.get(this.#stage) === undefined) {
						this.#ui.buttons.next.inactive = true;
					}
				}
			} else {
				if (this.#stage === 1) {
					this.#ui.buttons.prev.inactive = true;
				}
				if (this.#ui.buttons.next.inactive) {
					this.#ui.buttons.next.inactive = false;
				}
			}
		});

		const firstStageTData = this.#data.get(this.#stage);
		if (firstStageTData !== undefined) {
			applyTransformData(firstStageTData.transformData, model);
		}

		this.#ui.buttons.prev.inactive = true;
		this.#ui.buttons.next.inactive =
			this.#data.get(this.#stage + 1) === undefined;

		loop.updatables.push(mixer);

		this.#mixer = mixer;
	}

	#setStage(stage: number) {
		this.#stage = stage;

		this.#ui.stageLabel.text = `Stage ${this.#stage}`;
		this.#ui.stageLabel.sync();

		if (this.#model !== null) {
			if (this.#model.userData.descriptions) {
				const text = (
					this.#model.userData.descriptions as Record<number, string>
				)[this.#stage];

				if (text) {
					this.#ui.setDescriptionText(text);
				}
			}
		}
	}

	#playNext() {
		const anyActionIsRunning = Array.from(this.#data.values()).some(
			({ camAction, objAction }) =>
				camAction.isRunning() || objAction.isRunning(),
		);
		if (anyActionIsRunning) {
			console.log("Action is running, can't proceed to the next stage");
			return;
		}

		const curStage = this.#data.get(this.#stage);

		if (curStage === undefined) {
			console.error("curStage is", undefined);
			return;
		}

		const followCamera = this.#ui.settingsMenu.checkbox.checked();

		let time: number;
		if (followCamera) {
			time = curStage.camAction.time;
		} else {
			time = curStage.objAction.time;
		}

		if (followCamera) {
			this.#transition(curStage, () => {
				curStage.camAction.timeScale = this.#timeScale;
				curStage.objAction.timeScale = this.#timeScale;

				if (followCamera) {
					curStage.camAction.reset();
				}
				curStage.objAction.reset();

				curStage.camAction.time = time;
				curStage.objAction.time = time;

				if (followCamera) {
					curStage.camAction.play();
				}
				curStage.objAction.play();

				this.eventDispatcher.dispatchEvent({ type: "start" });

				setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);
			});

			return;
		}

		curStage.camAction.timeScale = this.#timeScale;
		curStage.objAction.timeScale = this.#timeScale;

		if (followCamera) {
			curStage.camAction.reset();
		}
		curStage.objAction.reset();

		curStage.camAction.time = time;
		curStage.objAction.time = time;

		if (followCamera) {
			curStage.camAction.play();
		}
		curStage.objAction.play();

		this.eventDispatcher.dispatchEvent({ type: "start" });

		setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);
	}

	#playBack() {
		const anyActionIsRunning = Array.from(this.#data.values()).some(
			({ camAction, objAction }) =>
				camAction.isRunning() || objAction.isRunning(),
		);
		if (anyActionIsRunning) {
			return;
		}

		const curStage = this.#data.get(this.#stage);
		const followCamera = this.#ui.settingsMenu.checkbox.checked();
		if (curStage !== undefined) {
			if (followCamera && curStage.camAction.time !== 0) {
				const time = curStage.camAction.time;

				this.#transition(curStage, () => {
					curStage.camAction.timeScale = -1 * this.#timeScale;
					curStage.objAction.timeScale = -1 * this.#timeScale;

					curStage.camAction.reset();
					curStage.objAction.reset();

					curStage.camAction.time = time;
					curStage.objAction.time = time;

					curStage.camAction.play();
					curStage.objAction.play();

					setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);

					this.eventDispatcher.dispatchEvent({ type: "start" });
				});

				return;
			}
			if (!followCamera && curStage.objAction.time !== 0) {
				const time = curStage.objAction.time;

				curStage.camAction.timeScale = -1 * this.#timeScale;
				curStage.objAction.timeScale = -1 * this.#timeScale;

				curStage.objAction.reset();

				curStage.camAction.time = time;
				curStage.objAction.time = time;

				curStage.objAction.play();

				setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);

				this.eventDispatcher.dispatchEvent({ type: "start" });

				return;
			}
		}

		const stage = this.#data.get(this.#stage - 1);
		if (stage !== undefined && this.#model !== null) {
			const followCamera = this.#ui.settingsMenu.checkbox.checked();

			if (followCamera) {
				const time = stage.camAction.getClip().duration;

				this.#transition(
					stage,
					() => {
						const activeStage = this.#data.get(this.#stage);
						activeStage?.camAction.stop();
						activeStage?.objAction.stop();

						applyTransformData(stage.transformData, this.#model);

						stage.camAction.timeScale = -1 * this.#timeScale;
						stage.objAction.timeScale = -1 * this.#timeScale;

						stage.camAction.reset();
						stage.objAction.reset();

						stage.camAction.time = time;
						stage.objAction.time = time;

						stage.camAction.play();
						stage.objAction.play();

						setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);

						this.eventDispatcher.dispatchEvent({ type: "start" });

						this.#setStage(this.#stage - 1);

						if (this.#ui.buttons.stages !== null) {
							const toDisable = this.#ui.buttons.stages.get(this.#stage + 1);
							if (toDisable !== undefined) {
								toDisable.colors = this.#ui.defaultButtonColors;
							}
							const toEnable = this.#ui.buttons.stages.get(this.#stage);
							if (toEnable !== undefined) {
								toEnable.colors = this.#ui.activeButtonColors;
							}
						}

						if (this.#data.get(this.#stage - 1) === undefined) {
							this.#ui.buttons.prev.inactive = true;
						}
					},
					time,
				);

				return;
			}
			const activeStage = this.#data.get(this.#stage);
			activeStage?.camAction.stop();
			activeStage?.objAction.stop();

			applyTransformData(stage.transformData, this.#model);

			const time = stage.objAction.getClip().duration;

			stage.camAction.timeScale = -1 * this.#timeScale;
			stage.objAction.timeScale = -1 * this.#timeScale;

			stage.objAction.reset();

			stage.objAction.time = time;

			stage.objAction.play();

			setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Pause);

			this.eventDispatcher.dispatchEvent({ type: "start" });

			this.#setStage(this.#stage - 1);

			if (this.#ui.buttons.stages !== null) {
				const toDisable = this.#ui.buttons.stages.get(this.#stage + 1);
				if (toDisable !== undefined) {
					toDisable.colors = this.#ui.defaultButtonColors;
				}
				const toEnable = this.#ui.buttons.stages.get(this.#stage);
				if (toEnable !== undefined) {
					toEnable.colors = this.#ui.activeButtonColors;
				}
			}
		}

		if (this.#data.get(this.#stage - 1) === undefined) {
			this.#ui.buttons.prev.inactive = true;
		}
	}

	#pause() {
		const curStage = this.#data.get(this.#stage);

		if (curStage !== undefined) {
			curStage.objAction.halt(0);
			curStage.camAction.halt(0);
		}

		setPauseButtonState(this.#ui.buttons.play, PlayButtonState.Play);
	}

	#updateSlider() {
		if (this.#transitionIsActive) {
			return;
		}

		const curStage = this.#data.get(this.#stage);
		if (curStage) {
			let dur: number;
			let time: number;
			if (this.#ui.settingsMenu.checkbox.checked()) {
				dur = curStage.camAction.getClip().duration;
				time = curStage.camAction.time;
			} else {
				dur = curStage.objAction.getClip().duration;
				time = curStage.objAction.time;
			}

			if (dur === 0) {
				this.#ui.slider.slider.hideHandle();
				return;
			}
			this.#ui.slider.slider.showHandle();

			this.#ui.slider.slider.setValue((time / dur) * 100);
		} else {
			this.#ui.slider.slider.hideHandle();
		}
	}

	#setTimeFromSlider(val: number) {
		const curStage = this.#data.get(this.#stage);
		if (curStage === undefined) {
			return;
		}
		if (this.#ui.settingsMenu.checkbox.checked()) {
			const time = (val / 100) * curStage.camAction.getClip().duration;

			curStage.camAction.play().halt(0);
			curStage.objAction.play().halt(0);

			curStage.camAction.time = time;
			curStage.objAction.time = time;

			const position = curStage.camInterpolants.position.evaluate(
				time,
			) as Float32Array;
			const rotation = curStage.camInterpolants.quaternion.evaluate(
				time,
			) as Float32Array;

			this.#camera.position.set(position[0], position[1], position[2]);

			this.#camera.quaternion.set(
				rotation[0],
				rotation[1],
				rotation[2],
				rotation[3],
			);

			this.#controls.target = this.#camera.children[0].getWorldPosition(
				this.#helperVecs[2],
			);
		} else {
			const time = (val / 100) * curStage.objAction.getClip().duration;

			curStage.objAction.play().halt(0);

			curStage.objAction.time = time;
		}
	}

	#updatePlaybackSpeed() {
		const curStage = this.#data.get(this.#stage);

		if (curStage !== undefined) {
			const newTimeScale =
				curStage.objAction.timeScale > 0
					? this.#timeScale
					: this.#timeScale * -1;

			curStage.objAction.timeScale = newTimeScale;
			curStage.camAction.timeScale = newTimeScale;
		}
	}

	#transition(stage: Stage, afterTransition: () => void, targetTime?: number) {
		const time = targetTime ?? stage.camAction.time;

		const position = stage.camInterpolants.position.evaluate(
			time,
		) as Float32Array;
		const rotation = stage.camInterpolants.quaternion.evaluate(
			time,
		) as Float32Array;

		const initialPosition = this.#helperVecs[0].copy(this.#camera.position);
		const newPosition = this.#helperVecs[1].set(
			position[0],
			position[1],
			position[2],
		);

		const distance = initialPosition.distanceTo(newPosition);

		const initialRotation = this.#helperQuats[0].copy(this.#camera.quaternion);
		const newRotation = this.#helperQuats[1].set(
			rotation[0],
			rotation[1],
			rotation[2],
			rotation[3],
		);

		const angle = initialRotation.angleTo(newRotation);

		if (distance > 0 || angle > 0) {
			// Create and play an animation from oldPos to newPos
			// After it finishes, continue the #playNext function

			const clip = createTransitionAnimation(
				stage,
				initialPosition.toArray(),
				initialRotation.toArray() as [number, number, number, number],
				newPosition.toArray(),
				newRotation.toArray() as [number, number, number, number],
				distance,
				angle,
			);

			const action = this.#mixer.clipAction(clip);
			action.clampWhenFinished = true;
			action.setLoop(LoopOnce, 1);

			stage.camAction.stop().reset();

			action.play();
			this.eventDispatcher.dispatchEvent({ type: "start" });
			this.#transitionIsActive = true;

			const listener = (
				ev: {
					action: AnimationAction;
					direction: number;
				} & Event<"finished", AnimationMixer>,
			) => {
				if (ev.action.getClip().name === "camTransition") {
					ev.action.stop().reset();
					this.#transitionIsActive = false;

					this.#mixer.uncacheClip(ev.action.getClip());

					this.#camera.position.copy(newPosition);

					this.#camera.quaternion.copy(newRotation);

					afterTransition();

					this.#mixer.removeEventListener("finished", listener);
				}
			};
			this.#mixer.addEventListener("finished", listener);
		} else {
			afterTransition();
		}
	}
}

function setPauseButtonState(
	button: ToggleableButton<PlayButtonState>,
	state: PlayButtonState,
) {
	const playMesh = button.block().obj().getObjectByName("Play");
	const pauseMesh = button.block().obj().getObjectByName("Pause");

	if (playMesh === undefined || pauseMesh === undefined) {
		console.error(
			"Couldn't set pause button state: one of the meshed not found",
		);

		return;
	}

	if (state === PlayButtonState.Play) {
		pauseMesh.visible = false;
		playMesh.visible = true;
	} else if (state === PlayButtonState.Pause) {
		pauseMesh.visible = true;
		playMesh.visible = false;
	}

	button.state = state;
}

function getStageData(
	camActions: Map<number, AnimationAction>,
	actions: Map<number, AnimationAction>,
	transformData: Map<number, Transformation[]>,
	target: Map<number, Stage>,
) {
	for (const [stageNum, camAction] of camActions) {
		const objAction = actions.get(stageNum);
		if (objAction === undefined) {
			console.error(
				"Camera action exists but object action doesn't. Stage",
				stageNum,
			);

			return;
		}

		const tData = transformData.get(stageNum);
		if (tData === undefined) {
			console.error(
				"Camera action exists but transform data doesn't. Stage",
				stageNum,
			);

			return;
		}

		const interpolants = {
			position: camAction
				.getClip()
				.tracks.find((track) => track.ValueTypeName === "vector")
				?.createInterpolant(),
			quaternion: camAction
				.getClip()
				.tracks.find((track) => track.ValueTypeName === "quaternion")
				?.createInterpolant(),
		};
		if (
			interpolants.position === undefined ||
			interpolants.quaternion === undefined
		) {
			throw "Couldn't find VectorKeyframetrack or QuaternionKeyframetrack";
		}

		target.set(stageNum, {
			camAction,
			objAction,
			transformData: tData,
			camInterpolants: interpolants as {
				position: Interpolant;
				quaternion: Interpolant;
			},
		});
	}
}

function percentToTimescale(val: number) {
	if (val < 50) {
		const newVal = val * 2;

		return (newVal * 0.9) / 100 + 0.1;
	}

	const newVal = (val - 50) * 2;

	return newVal / 100 + 1;
}

function createTransitionAnimation(
	curStage: Stage,
	currentPosition: [number, number, number],
	currentQuaternion: [number, number, number, number],
	targetPosition: [number, number, number],
	targetQuaternion: [number, number, number, number],
	distance: number,
	angle: number,
) {
	const duration = min(max(distance, angle) * 0.3, 2);

	const posTrackTarget = curStage.camAction
		.getClip()
		.tracks.find((x) => x.ValueTypeName === "vector")?.name;
	const posTrack = new VectorKeyframeTrack(
		posTrackTarget ?? "Camera.position",
		[0, duration],
		[currentPosition, targetPosition].flat(),
	);

	const quatTrackTarget = curStage.camAction
		.getClip()
		.tracks.find((x) => x.ValueTypeName === "quaternion")?.name;
	const quatTrack = new QuaternionKeyframeTrack(
		quatTrackTarget ?? "Camera.quaternion",
		[0, duration],
		[currentQuaternion, targetQuaternion].flat(),
	);

	const clip = new AnimationClip("camTransition", -1, [posTrack, quatTrack]);

	return clip;
}

export { Animator };
