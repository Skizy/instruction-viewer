import * as THREE from "three";
import { Text } from "troika-three-text";
import type { MouseHandler } from "../systems/MouseHandler";
import { InteractionType, range } from "./helpers";
import {
	Block,
	type BlockOptions,
	Button,
	Checkbox,
	FlexBox,
	Overflow,
	Slider,
	ToggleableButton,
} from "./ui-lib";

enum MenuVisibility {
	Stages = 0,
	Description = 1,
	Hidden = 2,
	Settings = 3,
}

enum PlayButtonState {
	Play = 0,
	Pause = 1,
}

class UI {
	#mouseHandler: MouseHandler;
	#scale: number;
	#container: Block;
	#topBlock: Block;
	#stagesListBlock: Block;
	#flexbox: FlexBox;
	#overflows: {
		inner: Overflow;
		outer: Overflow;
	};
	#listScrollbar: Slider;
	#mixers: THREE.AnimationMixer[] = [];
	#description: Description;
	#buttons: {
		next: Button;
		prev: Button;
		mainMenu: Button;
		stages: Map<number, Button> | null;
		fakeStages: Button[] | null;
		play: ToggleableButton<PlayButtonState>;
	};
	#stageLabel: Text;
	#slider: { block: Block; slider: Slider };

	readonly settingsMenu: SettingsMenu;

	readonly defaultButtonColors;
	readonly activeButtonColors;

	constructor(
		mouseHandler: MouseHandler,
		numberOfStages: number | null,
		scale = 1,
	) {
		this.#mouseHandler = mouseHandler;
		this.#scale = scale;

		this.#container = new Block({
			width: 1 * scale,
			height: 1.7 * scale,
			material: new THREE.MeshBasicMaterial({ visible: false }),
		});

		this.defaultButtonColors = {
			background: "#000000",
			hover: "#444444",
			active: "#505050",
			text: "#ffffff",
			outline: { normal: "#ffffff", active: "#ffffff", hover: "#ffffff" },
		};

		this.activeButtonColors = {
			background: "#ffffff",
			hover: "#e0e0e0",
			active: "#c0c0c0",
			text: "#000000",
			outline: { normal: "#ffffff", hover: "#e0e0e0", active: "#c0c0c0" },
		};

		////////////////
		// Big slider //
		////////////////

		this.#slider = createSlider(this.#mouseHandler, 3 * scale);

		///////////////
		// Top block //
		///////////////

		this.#topBlock = new Block({
			width: this.#container.width() * scale,
			height: this.#container.height() * 0.09 * scale,
			borderRadius: 3 * scale,
			material: new THREE.MeshBasicMaterial({ color: "#000000" }),
		});
		this.#topBlock
			.position()
			.setY(this.#container.height() / 2 - this.#topBlock.height() / 2);
		this.#topBlock.position().setZ(0.001);
		this.#container.add(this.#topBlock.obj());

		const {
			nextButton,
			prevButton,
			showStagesButton,
			descriptionButton,
			mainMenuButton,
			settingsButton,
		} = this.#createMainButtons();

		descriptionButton
			.block()
			.position()
			.setX(-this.#topBlock.width() / 2 + descriptionButton.block().width());
		this.#topBlock.add(descriptionButton.obj());

		prevButton
			.block()
			.position()
			.setX(
				-this.#topBlock.width() / 2 + descriptionButton.block().width() * 2,
			);
		this.#topBlock.add(prevButton.obj());

		nextButton
			.block()
			.position()
			.setX(this.#topBlock.width() / 2 - nextButton.block().width() * 3);
		this.#topBlock.add(nextButton.obj());

		const stageLabel = new Text();

		stageLabel.name = "Stage number";
		stageLabel.text = "";
		stageLabel.fontSize = 0.09;
		stageLabel.color = "#ffffff";
		stageLabel.anchorX = "center";
		stageLabel.anchorY = "middle";

		stageLabel.position.setY(0.01 * scale);
		stageLabel.position.setX(-nextButton.block().width() / 2);

		stageLabel.sync();

		this.#stageLabel = stageLabel;

		this.#topBlock.add(this.#stageLabel);

		showStagesButton
			.block()
			.position()
			.setX(this.#topBlock.width() / 2 - showStagesButton.block().width() * 2);
		this.#topBlock.add(showStagesButton.obj());

		settingsButton
			.obj()
			.position.setX(
				this.#topBlock.width() / 2 - settingsButton.block().width(),
			);
		this.#topBlock.add(settingsButton.obj());

		/////////////////
		// Stages list //
		/////////////////

		const {
			stagesListBlock,
			outerOverflow,
			innerOverflow,
			flexbox,
			scrollbar,
			buttons: stageButtons,
			fakeButtons: fakeStageButtons,
		} = this.#createStagesList(numberOfStages);
		this.#stagesListBlock = stagesListBlock;
		this.#flexbox = flexbox;
		this.#overflows = {
			inner: innerOverflow,
			outer: outerOverflow,
		};
		this.#listScrollbar = scrollbar;

		/////////////////
		// Description //
		/////////////////

		this.#description = new Description({
			mouseHandler: this.#mouseHandler,
			blockOpts: {
				width: outerOverflow.width(),
				height: outerOverflow.height(),
				borderRadius: 3 * scale,
			},
			scale,
		});

		outerOverflow.add(this.#description.block.obj());

		// --- //

		outerOverflow.updateClippingPlanes();

		///////////////////
		// Settings menu //
		///////////////////

		const settingsMenu = new SettingsMenu({
			mouseHandler: this.#mouseHandler,
			blockOpts: {
				width: outerOverflow.width(),
				height: 0.45 * scale,
				borderRadius: 3 * scale,
			},
		});
		settingsMenu.block
			.position()
			.setY(
				this.#container.height() / 2 -
					settingsMenu.block.height() / 2 -
					0.08 * scale,
			);

		outerOverflow.add(settingsMenu.block.obj());

		this.settingsMenu = settingsMenu;

		////////////////
		// Animations //
		////////////////

		this.#createAnimations(showStagesButton, descriptionButton, settingsButton);

		///////////////////////
		// Play/Pause button //
		///////////////////////

		const playPause = new ToggleableButton({
			mouseHandler,
			width: this.#slider.block.height(),
			height: this.#slider.block.height(),
			text: "",
			colors: this.defaultButtonColors,
			borderRadius: 2 * this.#scale,
			bottomBlockOpts: {
				material: new THREE.MeshBasicMaterial({ visible: false }),
			},

			initialState: PlayButtonState.Play,
		});
		playPause
			.block()
			.position()
			.set(
				-this.#container.width() / 2 - playPause.block().width() / 2 - 0.03,
				this.#container.height() / 2 - playPause.block().height() / 2,
				0,
			);
		const pauseShape = createPauseShape(
			0.05 * scale,
			0.013 * scale,
			0.01 * scale,
		);
		const pauseGeometry = new THREE.ShapeGeometry(pauseShape);
		const pauseMesh = new THREE.Mesh(
			pauseGeometry,
			new THREE.MeshBasicMaterial({ color: "#ffffff" }),
		);
		pauseMesh.name = "Pause";
		pauseMesh.position.setZ(0.05);

		const playShape = createPlayShape(0.05 * scale, 0.04 * scale);
		const playGeometry = new THREE.ShapeGeometry(playShape);
		const playMesh = new THREE.Mesh(
			playGeometry,
			new THREE.MeshBasicMaterial({ color: "#ffffff" }),
		);
		playMesh.name = "Play";
		playMesh.position.setZ(0.05);
		playMesh.position.setX(0.004);

		pauseMesh.visible = false;

		playPause.block().add(pauseMesh);
		playPause.block().add(playMesh);

		this.#container.add(playPause.obj());

		/////////////
		// Buttons //
		/////////////

		this.#buttons = {
			next: nextButton,
			prev: prevButton,
			mainMenu: mainMenuButton,
			stages: stageButtons,
			fakeStages: fakeStageButtons,
			play: playPause,
		};
	}

	get stageLabel() {
		return this.#stageLabel;
	}

	get slider() {
		return this.#slider;
	}

	get mainBlock() {
		return this.#container;
	}

	get buttons() {
		return { ...this.#buttons };
	}

	update(delta: number) {
		this.#overflows.inner.obj().updateMatrixWorld(true);
		this.#overflows.inner.update();

		this.#overflows.outer.obj().updateMatrixWorld(true);
		this.#overflows.outer.update();

		for (const mixer of this.#mixers) {
			mixer.update(delta);
		}

		this.#description.update();
	}

	removeButtons() {
		let oldButtons: Button[] = [];
		if (this.#buttons.stages !== null) {
			oldButtons = oldButtons.concat(Array.from(this.#buttons.stages.values()));
		}
		if (this.#buttons.fakeStages) {
			oldButtons = oldButtons.concat(this.#buttons.fakeStages);
		}

		if (oldButtons.length === 0) {
			return;
		}

		for (const button of oldButtons) {
			this.#flexbox.remove(button.block());
			this.#mouseHandler.remove(button.clickable);
		}

		this.#buttons.stages = null;
		this.#buttons.fakeStages = null;

		this.#overflows.inner.updateClippingPlanes();
		this.#overflows.inner.update();
		this.#listScrollbar.setHandleWidth(this.#listScrollbar.width());
		this.#listScrollbar.setValue(0);
		this.#listScrollbar.onChange?.(0);
	}

	createButtons(stages: number[]) {
		const buttons = this.#createStageButtons(stages);
		// WARN: Remove this after deleting fake buttons
		//		 start
		const existingButtons = this.#flexbox.children().slice();

		for (const button of existingButtons) {
			this.#flexbox.remove(button);
		}
		// WARN: end

		this.#buttons.stages = new Map<number, Button>();
		for (const [id, button] of buttons) {
			this.#flexbox.add(button.block());
			this.#buttons.stages.set(id, button);
		}

		// WARN: start
		for (const button of existingButtons) {
			this.#flexbox.add(button);
		}
		// WARN: end

		this.#overflows.inner.updateClippingPlanes();
		this.#overflows.inner.update();
		this.#overflows.outer.updateClippingPlanes();
		this.#overflows.outer.update();
		const visibleFlexboxPart =
			this.#overflows.inner.height() / this.#flexbox.height();
		if (visibleFlexboxPart < 1) {
			this.#listScrollbar.obj().visible = true;
		} else {
			this.#listScrollbar.obj().visible = false;
		}
		const newScrollbarHandleWidth =
			visibleFlexboxPart < 1
				? this.#overflows.inner.height() * visibleFlexboxPart
				: this.#overflows.inner.height();
		this.#listScrollbar.setHandleWidth(newScrollbarHandleWidth);
		this.#listScrollbar.setValue(0);
		this.#listScrollbar.onChange?.(0);
	}

	setDescriptionText(text: string) {
		this.#description.setText(text);
	}

	#createAnimations(
		showStagesButton: Button,
		descriptionButton: Button,
		settingsButton: Button,
	) {
		let menuState = MenuVisibility.Stages;

		const clip = createHidingAnimationClip(this.#stagesListBlock.height());
		const stagesMixer = new THREE.AnimationMixer(this.#stagesListBlock.obj());
		this.#mixers.push(stagesMixer);
		const stagesAction = stagesMixer.clipAction(clip);
		stagesAction.clampWhenFinished = true;
		stagesAction.setLoop(THREE.LoopOnce, 1);

		const clip2 = createHidingAnimationClip(this.#description.block.height());
		const descriptionMixer = new THREE.AnimationMixer(
			this.#description.block.obj(),
		);
		this.#mixers.push(descriptionMixer);
		const descriptionAction = descriptionMixer.clipAction(clip2);
		descriptionAction.clampWhenFinished = true;
		descriptionAction.setLoop(THREE.LoopOnce, 1);

		descriptionAction.time = clip2.duration;
		descriptionAction.play();

		const clip3 = createHidingAnimationClipV2(
			this.settingsMenu.block.height(),
			this.settingsMenu.block.position().y,
			undefined,
			-0.1,
		);
		const settingsMixer = new THREE.AnimationMixer(
			this.settingsMenu.block.obj(),
		);
		this.#mixers.push(settingsMixer);
		const settingsAction = settingsMixer.clipAction(clip3);
		settingsAction.clampWhenFinished = true;
		settingsAction.setLoop(THREE.LoopOnce, 1);

		settingsAction.time = clip3.duration;
		settingsAction.play();

		showStagesButton.onMouseUp = () => {
			if (menuState === MenuVisibility.Stages) {
				const time = stagesAction.time;
				stagesAction.timeScale = 1;
				stagesAction.reset();
				stagesAction.time = time;
				stagesAction.play();
				menuState = MenuVisibility.Hidden;

				return;
			}

			if (menuState === MenuVisibility.Description) {
				const time = descriptionAction.time;
				descriptionAction.timeScale = 1;
				descriptionAction.reset();
				descriptionAction.time = time;
				descriptionAction.play();

				const callback = () => {
					const time = stagesAction.time;
					stagesAction.timeScale = -1;
					stagesAction.reset();
					stagesAction.time = time;
					stagesAction.play();
					menuState = MenuVisibility.Stages;

					descriptionMixer.removeEventListener("finished", callback);
				};
				descriptionMixer.addEventListener("finished", callback);

				return;
			}

			if (menuState === MenuVisibility.Settings) {
				const time = settingsAction.time;
				settingsAction.timeScale = 1;
				settingsAction.reset();
				settingsAction.time = time;
				settingsAction.play();

				const callback = () => {
					const time = stagesAction.time;
					stagesAction.timeScale = -1;
					stagesAction.reset();
					stagesAction.time = time;
					stagesAction.play();
					menuState = MenuVisibility.Stages;

					settingsMixer.removeEventListener("finished", callback);
				};
				settingsMixer.addEventListener("finished", callback);

				return;
			}

			const time = stagesAction.time;
			stagesAction.timeScale = -1;
			stagesAction.reset();
			stagesAction.time = time;
			stagesAction.play();
			menuState = MenuVisibility.Stages;
		};

		descriptionButton.onMouseUp = () => {
			if (menuState === MenuVisibility.Description) {
				const time = descriptionAction.time;
				descriptionAction.timeScale = 1;
				descriptionAction.reset();
				descriptionAction.time = time;
				descriptionAction.play();
				menuState = MenuVisibility.Hidden;

				return;
			}

			if (menuState === MenuVisibility.Stages) {
				const time = stagesAction.time;
				stagesAction.timeScale = 1;
				stagesAction.reset();
				stagesAction.time = time;
				stagesAction.play();

				const callback = () => {
					const time = descriptionAction.time;
					descriptionAction.timeScale = -1;
					descriptionAction.reset();
					descriptionAction.time = time;
					descriptionAction.play();
					menuState = MenuVisibility.Description;

					stagesMixer.removeEventListener("finished", callback);
				};
				stagesMixer.addEventListener("finished", callback);

				return;
			}

			if (menuState === MenuVisibility.Settings) {
				const time = settingsAction.time;
				settingsAction.timeScale = 1;
				settingsAction.reset();
				settingsAction.time = time;
				settingsAction.play();

				const callback = () => {
					const time = descriptionAction.time;
					descriptionAction.timeScale = -1;
					descriptionAction.reset();
					descriptionAction.time = time;
					descriptionAction.play();
					menuState = MenuVisibility.Description;

					settingsMixer.removeEventListener("finished", callback);
				};
				settingsMixer.addEventListener("finished", callback);

				return;
			}

			const time = descriptionAction.time;
			descriptionAction.timeScale = -1;
			descriptionAction.reset();
			descriptionAction.time = time;
			descriptionAction.play();
			menuState = MenuVisibility.Description;
		};

		settingsButton.onMouseUp = () => {
			if (menuState === MenuVisibility.Settings) {
				const time = settingsAction.time;
				settingsAction.timeScale = 1;
				settingsAction.reset();
				settingsAction.time = time;
				settingsAction.play();
				menuState = MenuVisibility.Hidden;

				return;
			}

			if (menuState === MenuVisibility.Stages) {
				const time = stagesAction.time;
				stagesAction.timeScale = 1;
				stagesAction.reset();
				stagesAction.time = time;
				stagesAction.play();

				const callback = () => {
					const time = settingsAction.time;
					settingsAction.timeScale = -1;
					settingsAction.reset();
					settingsAction.time = time;
					settingsAction.play();
					menuState = MenuVisibility.Settings;

					stagesMixer.removeEventListener("finished", callback);
				};
				stagesMixer.addEventListener("finished", callback);

				return;
			}

			if (menuState === MenuVisibility.Description) {
				const time = descriptionAction.time;
				descriptionAction.timeScale = 1;
				descriptionAction.reset();
				descriptionAction.time = time;
				descriptionAction.play();

				const callback = () => {
					const time = settingsAction.time;
					settingsAction.timeScale = -1;
					settingsAction.reset();
					settingsAction.time = time;
					settingsAction.play();
					menuState = MenuVisibility.Settings;

					descriptionMixer.removeEventListener("finished", callback);
				};
				descriptionMixer.addEventListener("finished", callback);

				return;
			}

			const time = settingsAction.time;
			settingsAction.timeScale = -1;
			settingsAction.reset();
			settingsAction.time = time;
			settingsAction.play();
			menuState = MenuVisibility.Settings;
		};
	}

	#createStageButtons(stages: number[]) {
		const buttons = new Map<number, Button>();
		for (const i of stages) {
			const jumpButton = new Button({
				width: 0.6 * this.#scale,
				height: 0.11 * this.#scale,
				offset: 0,
				borderRadius: 4 * this.#scale,
				text: `Stage ${i}`,
				fontSize: 0.07 * this.#scale,
				colors: this.defaultButtonColors,
				mouseHandler: this.#mouseHandler,
			});

			buttons.set(i, jumpButton);
		}

		return buttons;
	}

	#createFakeButtons(amount: number) {
		const buttons = [];
		for (let i = 0; i < amount; i += 1) {
			const jumpButton = new Button({
				width: 0.6 * this.#scale,
				height: 0.11 * this.#scale,
				offset: 0,
				borderRadius: 4 * this.#scale,
				text: `Fake ${i + 1}`,
				fontSize: 0.07 * this.#scale,
				colors: this.defaultButtonColors,
				mouseHandler: this.#mouseHandler,
			});

			buttons.push(jumpButton);
		}

		return buttons;
	}

	#createStagesList(numberOfStages: number | null) {
		const listOverflow = new Overflow({
			width: this.#container.width() * 0.8,
			height:
				this.#container.height() -
				(this.#topBlock.height() - 2 * (this.#topBlock.borderRadius / 100)),
			visible: false,
		});
		listOverflow
			.obj()
			.position.setY((-this.#container.height() + listOverflow.height()) / 2);
		this.#container.add(listOverflow.obj());

		const stagesListBlock = new Block({
			width: listOverflow.width(),
			height: listOverflow.height(),
			borderRadius: 3 * this.#scale,
			material: new THREE.MeshBasicMaterial({
				color: "#000000",
			}),
		});

		listOverflow.add(stagesListBlock.obj());

		const overflow = new Overflow({
			width: stagesListBlock.width(),
			height:
				this.#container.height() - this.#topBlock.height() - 0.05 * this.#scale,
			visible: false,
		});
		overflow.obj().position.setY(-this.#topBlock.borderRadius / 100);
		stagesListBlock.add(overflow.obj());

		const flexbox = new FlexBox({ spacing: 0.03 * this.#scale });
		overflow.add(flexbox.obj());

		let buttons = null;
		if (numberOfStages) {
			buttons = this.#createStageButtons(range(numberOfStages));
		}

		if (buttons) {
			for (const button of buttons.values()) {
				flexbox.add(button.block());
			}
		}
		const fakeButtons = this.#createFakeButtons(10);
		for (const button of fakeButtons) {
			flexbox.add(button.block());
		}

		flexbox.obj().position.y = overflow.height() / 2 - flexbox.height() / 2;
		overflow.updateClippingPlanes();

		const visibleFlexboxPart = overflow.height() / flexbox.height();

		const scrollbarHandleWidth =
			visibleFlexboxPart < 1
				? overflow.height() * visibleFlexboxPart
				: overflow.height();

		const scrollbar = new Slider({
			mouseHandler: this.#mouseHandler,
			width: overflow.height(),
			height: 0.03 * this.#scale,
			onChange: (value) => {
				let val: number;
				if (flexbox.height() < overflow.height()) {
					val = 0;
				} else {
					val = value;
				}

				scrollbar.setValue(val);

				const fh = flexbox.height();
				flexbox
					.obj()
					.position.setY((val / 100 - 0.5) * (fh - overflow.height()));
			},
			backgroundColor: "#353538",
			handleOpts: {
				width: scrollbarHandleWidth,
				height: 0.03 * this.#scale,
				color: "#555555",
			},
			edge: "end",
		});
		scrollbar
			.obj()
			.position.setX(stagesListBlock.width() / 2 - scrollbar.height());
		scrollbar.obj().position.setY(-this.#topBlock.borderRadius / 100);
		scrollbar.obj().rotation.z = -Math.PI / 2;
		stagesListBlock.add(scrollbar.obj());

		this.#mouseHandler.addScrollable({
			obj: stagesListBlock.obj().children[0],
			type: InteractionType.Scrollable,
			onScroll: (deltaY) => {
				if (flexbox.height() < overflow.height()) {
					return;
				}

				let val = scrollbar.getValue();

				if ((val === 100 && deltaY > 0) || (val === 0 && deltaY < 0)) {
					return;
				}

				val += deltaY * 0.1;

				if (val > 100) {
					val = 100;
				} else if (val < 0) {
					val = 0;
				}

				scrollbar.setValue(val);

				const fh = flexbox.height();
				flexbox
					.obj()
					.position.setY((val / 100 - 0.5) * (fh - overflow.height()));
			},
		});

		return {
			outerOverflow: listOverflow,
			innerOverflow: overflow,
			scrollbar,
			flexbox,
			stagesListBlock,
			buttons,
			fakeButtons,
		};
	}

	#createMainButtons() {
		const topBlockButtonsOptions = {
			mouseHandler: this.#mouseHandler,
			width: 0.1 * this.#scale,
			height: 0.1 * this.#scale,
			borderRadius: 2 * this.#scale,
			colors: {
				background: "#000000",
				hover: "#444444",
				active: "#505050",
				inactive: { background: "#333333", text: "#555555" },
			},
			offset: 0,
			fontSize: 0.08 * this.#scale,
			fontWeight: "bold" as "normal" | "bold",
			bottomBlockOpts: {
				material: new THREE.MeshBasicMaterial({ visible: false }),
			},
		};

		const descriptionButton = new Button({
			text: "ⓘ",
			textYOffset: 0.008,
			...topBlockButtonsOptions,
		});
		const showStagesButton = new Button({
			// text: "☰",
			text: "",
			...topBlockButtonsOptions,
		});
		const stagesListIcon = new THREE.Mesh(
			new THREE.ShapeGeometry(createListIconShape(0.07 * this.#scale)),
			new THREE.MeshBasicMaterial({ color: "#ffffff" }),
		);
		stagesListIcon.position.setZ(0.1);
		showStagesButton.obj().add(stagesListIcon);
		const prevButton = new Button({
			text: "<",
			...topBlockButtonsOptions,
		});
		const nextButton = new Button({
			text: ">",
			...topBlockButtonsOptions,
		});
		const settingsButton = new Button({
			text: "☰",
			textYOffset: -0.012,
			...topBlockButtonsOptions,
		});

		const mainMenuButton = new Button({
			width: this.#slider.block.height(),
			height: this.#slider.block.height(),
			borderRadius: 2 * this.#scale,
			colors: this.defaultButtonColors,
			text: "",
			fontWeight: "bold",
			fontSize: 0.05,
			bottomBlockOpts: {
				material: new THREE.MeshBasicMaterial({ visible: false }),
			},
			mouseHandler: this.#mouseHandler,
		});

		const arrowMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
		const arrow = new THREE.Mesh(
			new THREE.ShapeGeometry(createArrowShaftShape(0.01, 0.05)),
			arrowMat,
		);
		arrow.position.z = 0.04; // minimal distance to render on top of the button
		const arrowTip = new THREE.Mesh(
			new THREE.ShapeGeometry(createArrowTipShape(0.01, 0.05)),
			arrowMat,
		);
		arrow.add(arrowTip);

		mainMenuButton.block().obj().add(arrow);

		return {
			nextButton,
			prevButton,
			showStagesButton,
			descriptionButton,
			mainMenuButton,
			settingsButton,
		};
	}
}

class SettingsMenu {
	readonly block: Block;

	readonly checkbox: Checkbox;
	readonly speedSlider: Slider;
	readonly resetSpeedButton: Button;

	constructor(opts: { blockOpts: BlockOptions; mouseHandler: MouseHandler }) {
		const width = opts.blockOpts.width;
		const height = opts.blockOpts.height;

		this.block = new Block({
			width,
			height,
			borderRadius: opts.blockOpts.borderRadius,
			material:
				opts.blockOpts.material ??
				new THREE.MeshBasicMaterial({ color: "#000000" }),
		});

		const checkboxWidth = 0.08;
		const checkboxHeight = 0.08;

		const checkbox = new Checkbox({
			mouseHandler: opts.mouseHandler,
			width: checkboxWidth,
			height: checkboxHeight,
			borderRadius: 2,
			borderWidth: 0.007,
		});
		checkbox.setChecked(true);
		checkbox.onClick = () => checkbox.setChecked(!checkbox.checked());
		checkbox
			.obj()
			.position.set(
				-this.block.width() / 2 + checkboxWidth,
				this.block.height() / 2 - checkboxHeight,
				0.0001,
			);
		this.checkbox = checkbox;

		const checkboxText = new Text();
		checkboxText.text = "Follow camera";
		checkboxText.fontSize = 0.07;
		checkboxText.color = "#ffffff";
		checkboxText.anchorX = "center";
		checkboxText.anchorY = "middle";
		checkboxText.sync();

		checkboxText.position.set(
			checkboxWidth / 2,
			this.block.height() / 2 - checkboxHeight,
			0.0001,
		);

		const speedSlider = new Slider({
			mouseHandler: opts.mouseHandler,
			width: this.block.width() * 0.85,
			height: 0.02,
			handleOpts: { width: 0.02, height: 0.06 },
			value: 100,
			backgroundColor: "#444444",
		});
		speedSlider.obj().position.set(0, 0.04, 0.001);
		this.speedSlider = speedSlider;

		const leftLabel = new Text();
		leftLabel.text = "0.1x";
		leftLabel.fontSize = 0.05;
		leftLabel.color = "#ffffff";
		leftLabel.anchorX = "center";
		leftLabel.anchorY = "middle";
		leftLabel.sync();
		leftLabel.position.set(-this.block.width() * 0.4, -0.02, 0.0001);

		const centreLabel = new Text();
		centreLabel.text = "1x";
		centreLabel.fontSize = 0.05;
		centreLabel.color = "#ffffff";
		centreLabel.anchorX = "center";
		centreLabel.anchorY = "middle";
		centreLabel.sync();
		centreLabel.position.set(0, -0.02, 0.0001);

		const rightLabel = new Text();
		rightLabel.text = "2x";
		rightLabel.fontSize = 0.05;
		rightLabel.color = "#ffffff";
		rightLabel.anchorX = "center";
		rightLabel.anchorY = "middle";
		rightLabel.sync();
		rightLabel.position.set(this.block.width() * 0.4, -0.02, 0.0001);

		const speedReset = new Button({
			mouseHandler: opts.mouseHandler,
			text: "Reset speed",
			fontSize: 0.07,
			textYOffset: 0.005,
			width: this.block.width() * 0.7,
			height: 0.1,
			borderRadius: 2,
			bottomBlockOpts: {
				borderRadius: 2,
			},
			colors: {
				background: "#000000",
				hover: "#444444",
				active: "#505050",
				text: "#ffffff",
				outline: { normal: "#ffffff", active: "#ffffff", hover: "#ffffff" },
			},
		});

		speedReset
			.obj()
			.position.set(
				0,
				-this.block.height() / 2 +
					speedReset.block().height() / 2 +
					this.block.width() * 0.05,
				0,
			);
		this.resetSpeedButton = speedReset;

		this.block
			.obj()
			.add(
				checkbox.obj(),
				checkboxText,
				speedSlider.obj(),
				leftLabel,
				centreLabel,
				rightLabel,
				speedReset.obj(),
			);
	}
}

class Description {
	#text: Text;
	#block: Block;
	#overflow: Overflow;
	#scrollbar: Slider;

	constructor(opts: {
		blockOpts: BlockOptions;
		mouseHandler: MouseHandler;
		text?: string;
		scale?: number;
	}) {
		const width = opts.blockOpts.width;
		const height = opts.blockOpts.height;

		this.#block = new Block({
			width,
			height,
			borderRadius: opts.blockOpts.borderRadius,
			material:
				opts.blockOpts.material ??
				new THREE.MeshBasicMaterial({ color: "#000000" }),
		});

		this.#overflow = new Overflow({
			width: width * 0.95,
			height,
			visible: false,
		});

		this.#text = new Text();
		this.#text.name = "description_text";
		this.#text.text =
			opts.text ??
			"EXAMPLE TEXT\n“Hey look, I like Svelte, but the ecosystem is smaller than React, so that’s why I’m not going to use Svelte (SvelteKit)”. This is the same message you might find on Reddit, Twitter, or even YouTube comments - the same copy pasta. (Not exactly word by word, but the idea remains.) It begins to become annoying and frustrating when you give people options to choose from, and their only argument is the “smaller ecosystem.” And the truth? That is mostly a lie. SvelteJS ecosystem isn’t even that small compared to React. Yeah, you are correct if you say that Svelte doesn’t have that many UI component libraries, but even for that, there are options (SkeletonUI, Flowbite Svelte, Svelte UI, DaisyUI). And if you want to have more UI component libraries, go make your own UI component library in Svelte, publish it, and then wait for someone to find it and say, “Hey, this UI component library is bad, I’m going to create a better one.”";
		this.#text.fontSize = 0.05;
		this.#text.maxWidth = width * 0.8;
		this.#text.color = "#ffffff";
		this.#text.anchorX = "center";
		this.#text.anchorY = "middle";
		this.#syncText();

		this.#overflow.add(this.#text);
		this.#overflow.updateClippingPlanes();

		const onScroll = (val: number) => {
			this.#scrollbar.setValue(val);

			/* eslint-disable no-mixed-spaces-and-tabs */
			const textHeight =
				this.#text.geometry.boundingBox?.max.y !== undefined &&
				this.#text.geometry.boundingBox?.min.y !== undefined
					? this.#text.geometry.boundingBox?.max.y -
						this.#text.geometry.boundingBox?.min.y
					: undefined;
			/* eslint-enable no-mixed-spaces-and-tabs */
			if (textHeight === undefined) {
				console.error("Haven't computed the boundingBox for description text");
				return;
			}
			if (textHeight < this.#overflow.height()) {
				this.#text.position.setY(
					-0.5 * (textHeight - this.#overflow.height() + 0.1) - 0.04,
				);
				return;
			}
			this.#text.position.setY(
				(val / 100 - 0.5) * (textHeight - this.#overflow.height() + 0.1) - 0.04,
			);
		};

		this.#scrollbar = new Slider({
			mouseHandler: opts.mouseHandler,
			width: this.#overflow.height() - 0.1,
			height: 0.03 * (opts.scale ?? 1),
			onChange: onScroll,
			backgroundColor: "#353538",
			handleOpts: {
				width: 0.15 * (opts.scale ?? 1),
				height: 0.03 * (opts.scale ?? 1),
				color: "#555555",
			},
			edge: "end",
		});
		this.#scrollbar
			.obj()
			.position.setX(this.#block.width() / 2 - this.#scrollbar.height());
		this.#scrollbar.obj().position.setY(-0.03);
		this.#scrollbar.obj().rotation.z = -Math.PI / 2;

		opts.mouseHandler.addScrollable({
			obj: this.#block.obj().children[0],
			type: InteractionType.Scrollable,
			onScroll: (deltaY) => {
				let val = this.#scrollbar.getValue();

				if ((val === 100 && deltaY > 0) || (val === 0 && deltaY < 0)) {
					return;
				}

				val += deltaY * 0.1;

				if (val > 100) {
					val = 100;
				} else if (val < 0) {
					val = 0;
				}

				this.#scrollbar.setValue(val);

				onScroll(val);
			},
		});

		this.#block.add(this.#overflow.obj());
		this.#block.add(this.#scrollbar.obj());
	}

	#syncText() {
		this.#text.sync(() => {
			this.#text.geometry.computeBoundingBox();

			/* eslint-disable no-mixed-spaces-and-tabs */
			const textHeight =
				this.#text.geometry.boundingBox?.max.y !== undefined &&
				this.#text.geometry.boundingBox?.min.y !== undefined
					? this.#text.geometry.boundingBox?.max.y -
						this.#text.geometry.boundingBox?.min.y
					: undefined;
			/* eslint-enable no-mixed-spaces-and-tabs */
			if (textHeight === undefined) {
				console.error("Haven't computed the boundingBox for description text");
				return;
			}
			this.#text.position.setY(
				-0.5 * (textHeight - this.#overflow.height() + 0.1) - 0.04,
			);

			const visibleTextPart = this.#overflow.height() / textHeight;
			if (visibleTextPart < 1) {
				this.#scrollbar.obj().visible = true;
				this.#scrollbar.setHandleWidth(
					this.#scrollbar.width() * visibleTextPart,
				);
			} else {
				this.#scrollbar.obj().visible = false;
			}
		});
	}

	update() {
		this.#overflow.update();
	}

	get block() {
		return this.#block;
	}

	text() {
		return this.#text.text;
	}

	setText(data: string) {
		// TODO:
		// change the text in troika object
		// recalculate the boundingBox
		// maybe change the scrollbar handler
		this.#text.text = data;
		this.#syncText();
		this.#scrollbar.setValue(0);
	}
}

function createArrowTipShape(width: number, verticalSize: number) {
	const shape = new THREE.Shape();

	const y = verticalSize / 2;
	const vertWidth = width / Math.SQRT2;

	shape.moveTo(vertWidth, y - vertWidth);
	shape.lineTo(0, y);
	shape.lineTo(-y, 0);
	shape.lineTo(0, -y);
	shape.lineTo(vertWidth, -y + vertWidth);
	shape.lineTo(-y + width * Math.SQRT2, 0);
	shape.lineTo(vertWidth, y - vertWidth);

	return shape;
}

function createArrowShaftShape(width: number, verticalSize: number) {
	const shape = new THREE.Shape();

	const y = verticalSize / 2;

	shape.moveTo(y, width / 2);
	shape.lineTo(y, -width / 2);
	shape.lineTo(-y + width * Math.SQRT2 + width / 2, -width / 2);
	shape.lineTo(-y + width * Math.SQRT2, 0);
	shape.lineTo(-y + width * Math.SQRT2 + width / 2, width / 2);
	shape.lineTo(y, width / 2);

	return shape;
}

function createSlider(mouseHandler: MouseHandler, borderRadius: number) {
	const bigSliderBlock = new Block({
		width: 2,
		height: 0.08,
		borderRadius,
		material: new THREE.MeshBasicMaterial({ color: "#000000" }),
	});
	const bigSlider = new Slider({
		mouseHandler,
		height: 0.02,
		backgroundColor: "#444444",
		handleOpts: { height: 0.06, width: 0.02, color: "white" },
	});
	bigSliderBlock.add(bigSlider.obj());

	return { block: bigSliderBlock, slider: bigSlider };
}

function createPauseShape(height: number, width: number, margin: number) {
	const shape1 = new THREE.Shape();
	shape1.moveTo(-width - margin / 2, height / 2);
	shape1.lineTo(-width - margin / 2, -height / 2);
	shape1.lineTo(-margin / 2, -height / 2);
	shape1.lineTo(-margin / 2, height / 2);
	shape1.lineTo(-width - margin / 2, height / 2);
	shape1.closePath();

	const shape2 = new THREE.Shape();
	shape2.moveTo(width + margin / 2, height / 2);
	shape2.lineTo(width + margin / 2, -height / 2);
	shape2.lineTo(margin / 2, -height / 2);
	shape2.lineTo(margin / 2, height / 2);
	shape2.lineTo(width + margin / 2, height / 2);
	shape2.closePath();

	return [shape1, shape2];
}

function createPlayShape(height: number, width: number) {
	const shape = new THREE.Shape();

	shape.moveTo(-width / 2, height / 2);
	shape.lineTo(width / 2, 0);
	shape.lineTo(-width / 2, -height / 2);
	shape.lineTo(-width / 2, height / 2);
	shape.closePath();

	return shape;
}

function SliderManager(
	block: Block,
	slider: Slider,
	rightPadding: number,
	leftPadding: number,
	camera: THREE.OrthographicCamera,
) {
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
	const intersection2 = new THREE.Vector3();

	function onResize() {
		const aspectRatio = window.innerWidth / window.innerHeight;
		mousePos.set(-1 + 0.02 / aspectRatio, 1 - 0.02);

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

		const topLeftCorner = raycaster.ray.intersectPlane(
			helperPlane,
			intersection,
		);
		if (!topLeftCorner) {
			console.error("Shouldn't happen, there should be an intersection");
			return;
		}
		camera.worldToLocal(topLeftCorner);

		mousePos.set(1 - 0.02 / aspectRatio, 1 - 0.02);

		raycaster.setFromCamera(mousePos, camera);

		const topRightCorner = raycaster.ray.intersectPlane(
			helperPlane,
			intersection2,
		);
		if (!topRightCorner) {
			console.error("Shouldn't happen, there should be an intersection");
			return;
		}
		camera.worldToLocal(topRightCorner);

		const newWidth =
			topRightCorner.x - topLeftCorner.x - rightPadding - leftPadding;

		block.setWidth(newWidth);
		let sliderPadding: number;
		if (newWidth > 1) {
			sliderPadding = 0.3;
		} else {
			sliderPadding = newWidth / (1 / 0.3);
		}
		slider.setWidth(newWidth - sliderPadding);

		block.position().setX(-rightPadding / 2 + leftPadding / 2);
		block.position().setY(topLeftCorner.y - block.height() / 2);
	}

	return {
		onResize,
	};
}

function createHidingAnimationClip(listHeight: number) {
	const bottomPosition = [0, 0, 0];
	const topPosition = [0, listHeight, 0];

	const times = [0, listHeight * 0.5];
	const values = [bottomPosition, topPosition].flat();

	const track = new THREE.VectorKeyframeTrack(".position", times, values);
	const clip = new THREE.AnimationClip("hide", -1, [track]);

	return clip;
}

function createHidingAnimationClipV2(
	height: number,
	bottomY: number,
	x?: number,
	z?: number,
) {
	const bottomPosition = [x ?? 0, bottomY, z ?? 0];
	const topPosition = [x ?? 0, bottomY + height, z ?? 0];

	const times = [0, height * 0.5];
	const values = [bottomPosition, topPosition].flat();

	const track = new THREE.VectorKeyframeTrack(".position", times, values);
	const clip = new THREE.AnimationClip("hide", -1, [track]);

	return clip;
}

/** `size` equals height of the icon */
function createListIconShape(size: number) {
	const height = size;
	const width = size * 0.8;

	const borderRadius = width * 0.2;

	const linesHeight = height * 0.08;
	const linesWidth = width * 0.6;

	const outlineWidth = linesHeight / 2;

	const gap = (height - outlineWidth * 2 - linesHeight * 4) / 5;

	const shape1 = new THREE.Shape();
	shape1.moveTo(width / 2 - borderRadius, height / 2);
	shape1.arc(0, -borderRadius, borderRadius, Math.PI / 2, 0, true);
	shape1.lineTo(width / 2, -height / 2 + borderRadius);
	shape1.arc(-borderRadius, 0, borderRadius, 0, (Math.PI * 3) / 2, true);
	shape1.lineTo(-width / 2 + borderRadius, -height / 2);
	shape1.arc(0, borderRadius, borderRadius, (Math.PI * 3) / 2, Math.PI, true);
	shape1.lineTo(-width / 2, height / 2 - borderRadius);
	shape1.arc(borderRadius, 0, borderRadius, Math.PI, Math.PI / 2, true);
	shape1.lineTo(width / 2 - borderRadius, height / 2);
	shape1.closePath();

	const hole = new THREE.Shape();
	hole.moveTo(width / 2 - borderRadius, height / 2 - outlineWidth);
	hole.arc(
		0,
		-borderRadius + outlineWidth,
		borderRadius - outlineWidth,
		Math.PI / 2,
		0,
		true,
	);
	hole.lineTo(width / 2 - outlineWidth, -height / 2 + borderRadius);
	hole.arc(
		-borderRadius + outlineWidth,
		0,
		borderRadius - outlineWidth,
		0,
		(Math.PI * 3) / 2,
		true,
	);
	hole.lineTo(-width / 2 + borderRadius, -height / 2 + outlineWidth);
	hole.arc(
		0,
		borderRadius - outlineWidth,
		borderRadius - outlineWidth,
		(Math.PI * 3) / 2,
		Math.PI,
		true,
	);
	hole.lineTo(-width / 2 + outlineWidth, height / 2 - borderRadius);
	hole.arc(
		borderRadius - outlineWidth,
		0,
		borderRadius - outlineWidth,
		Math.PI,
		Math.PI / 2,
		true,
	);
	hole.lineTo(width / 2 - borderRadius, height / 2 - outlineWidth);
	hole.closePath();

	shape1.holes = [hole];

	const line1 = new THREE.Shape();
	line1.moveTo(-linesWidth / 2, gap * 1.5 + linesHeight * 2);
	line1.lineTo(linesWidth / 2, gap * 1.5 + linesHeight * 2);
	line1.lineTo(linesWidth / 2, gap * 1.5 + linesHeight);
	line1.lineTo(-linesWidth / 2, gap * 1.5 + linesHeight);
	line1.lineTo(-linesWidth / 2, gap * 1.5 + linesHeight * 2);
	line1.closePath();

	const line2 = new THREE.Shape();
	line2.moveTo(-linesWidth / 2, gap * 0.5 + linesHeight);
	line2.lineTo(linesWidth / 2, gap * 0.5 + linesHeight);
	line2.lineTo(linesWidth / 2, gap * 0.5);
	line2.lineTo(-linesWidth / 2, gap * 0.5);
	line2.lineTo(-linesWidth / 2, gap * 0.5 + linesHeight);
	line2.closePath();

	const line3 = new THREE.Shape();
	line3.moveTo(-linesWidth / 2, -gap * 0.5);
	line3.lineTo(linesWidth / 2, -gap * 0.5);
	line3.lineTo(linesWidth / 2, -gap * 0.5 - linesHeight);
	line3.lineTo(-linesWidth / 2, -gap * 0.5 - linesHeight);
	line3.lineTo(-linesWidth / 2, -gap * 0.5);
	line3.closePath();

	const line4 = new THREE.Shape();
	line4.moveTo(-linesWidth / 2, -gap * 1.5 - linesHeight);
	line4.lineTo(linesWidth / 2, -gap * 1.5 - linesHeight);
	line4.lineTo(linesWidth / 2, -gap * 1.5 - linesHeight * 2);
	line4.lineTo(-linesWidth / 2, -gap * 1.5 - linesHeight * 2);
	line4.lineTo(-linesWidth / 2, -gap * 1.5 - linesHeight);
	line4.closePath();

	return [shape1, line1, line2, line3, line4];
}

export { SliderManager, UI, PlayButtonState };
