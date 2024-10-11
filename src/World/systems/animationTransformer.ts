import * as Three from "three";
import type { Transformation, UpdatableAnimationMixer } from "../utils/helpers";

function getTransformData(
	clips: Three.AnimationClip[],
	root: Three.Object3D,
): {
	transformData: Map<number, Transformation[]>;
	camClips: Three.AnimationClip[];
	objClips: Three.AnimationClip[];
} {
	const camClips = clips.filter((x) => x.name.startsWith("cam_"));

	const otherClips = clips.filter((x) => !x.name.startsWith("cam_"));

	const clipsByStage = new Map<number, Three.AnimationClip[]>(
		camClips.map((clip) => [Number.parseInt(clip.name.slice(4)), []]),
	);

	for (const clip of otherClips) {
		const stage = getClipStage(clip, camClips);
		if (stage === null) {
			throw "bad";
		}

		clipsByStage.get(stage)?.push(clip);
	}

	const objClips = [];
	for (const [stage, clipsArray] of clipsByStage) {
		objClips.push(concatClips(clipsArray, `stage_${stage}`));
	}

	for (const [i, clip] of objClips.entries()) {
		const camClip = camClips[i];
		const startTime = clipStartTime(camClip);

		setClipStartTime(clip, startTime);
		clip.resetDuration();

		setClipStartTime(camClip, startTime);
		camClip.resetDuration();

		objClips[i] = extendClip(clip, camClip.duration);
	}

	camClips.sort(
		(a, b) =>
			Number.parseInt(a.name.slice(4)) - Number.parseInt(b.name.slice(4)),
	);
	objClips.sort(
		(a, b) =>
			Number.parseInt(a.name.slice(6)) - Number.parseInt(b.name.slice(6)),
	);

	const allObjectNames2 = new Set<string>();
	for (const clip of objClips) {
		for (const track of clip.tracks) {
			const name = track.name.split(".")[0];

			if (name.length === 0) {
				throw "No object name in the track";
			}

			allObjectNames2.add(name);
		}
	}

	// Save positions and rotations of all animated objects

	const stage_1_Transforms: Transformation[] = [];
	for (const name of allObjectNames2) {
		const obj = root.getObjectByName(name);
		if (obj === undefined) {
			throw `No object with name '${name}' in the scene graph`;
		}

		stage_1_Transforms.push({
			objName: name,
			position: obj.position.clone(),
			quaternion: obj.quaternion.clone(),
		});
	}

	const transformDataByStage2 = new Map<number, Transformation[]>();

	const firstStageN = Number.parseInt(objClips[0].name.slice(6));
	transformDataByStage2.set(firstStageN, stage_1_Transforms);

	for (const clip of objClips) {
		const stageTransforms: Transformation[] = [];

		for (const track of clip.tracks) {
			const [objName, property] = track.name.split(".");

			if (objName.length === 0) {
				throw "No object name in the track";
			}
			if (property.length === 0) {
				throw "No property specified in the track";
			}

			const existingTransform = stageTransforms.find(
				(tfm) => tfm.objName === objName,
			);
			if (existingTransform === undefined) {
				const newTransform: Transformation = {
					objName,
				};

				if (property === "position") {
					newTransform.position = new Three.Vector3();
					const data = track.values.slice(track.values.length - 3);
					newTransform.position.set(data[0], data[1], data[2]);
				} else if (property === "quaternion") {
					newTransform.quaternion = new Three.Quaternion();
					const data = track.values.slice(track.values.length - 4);
					newTransform.quaternion.set(data[0], data[1], data[2], data[3]);
				}

				stageTransforms.push(newTransform);
			} else {
				if (property === "position") {
					existingTransform.position = new Three.Vector3();
					const data = track.values.slice(track.values.length - 3);
					existingTransform.position.set(data[0], data[1], data[2]);
				} else if (property === "quaternion") {
					existingTransform.quaternion = new Three.Quaternion();
					const data = track.values.slice(track.values.length - 4);
					existingTransform.quaternion.set(data[0], data[1], data[2], data[3]);
				}
			}
		}

		const stageNum = Number.parseInt(clip.name.slice(6));

		const prevTransforms = transformDataByStage2.get(stageNum);
		if (prevTransforms !== undefined) {
			stageTransforms.push(
				...prevTransforms.filter(
					(x) =>
						stageTransforms.find((y) => y.objName === x.objName) === undefined,
				),
			);
		}

		transformDataByStage2.set(stageNum + 1, stageTransforms);
	}

	return { transformData: transformDataByStage2, camClips, objClips };
}

function extendClip(clip: Three.AnimationClip, duration: number) {
	const tracks = [];
	for (const track of clip.tracks) {
		if (track.times[track.times.length - 1] >= duration) {
			tracks.push(track.clone());
			continue;
		}

		let lastVal = null;
		if (track.ValueTypeName === "vector") {
			lastVal = Array.from(track.values.slice(track.values.length - 3));
		} else if (track.ValueTypeName === "quaternion") {
			lastVal = Array.from(track.values.slice(track.values.length - 4));
		}

		if (lastVal === null) {
			console.error("Unknown keyframe track type:", track.ValueTypeName);
			continue;
		}

		const newValues = Array.from(track.values).concat(lastVal);

		const newTimes = Float32Array.from(
			Array.from(track.times).concat([duration]),
		);

		if (track.ValueTypeName === "vector") {
			tracks.push(
				new Three.VectorKeyframeTrack(
					track.name,
					newTimes,
					newValues,
					track.getInterpolation(),
				),
			);
		} else if (track.ValueTypeName === "quaternion") {
			tracks.push(
				new Three.QuaternionKeyframeTrack(
					track.name,
					newTimes,
					newValues,
					track.getInterpolation(),
				),
			);
		}
	}

	return new Three.AnimationClip(clip.name, -1, tracks, clip.blendMode);
}

function concatClips(
	clips: Three.AnimationClip[],
	name?: string,
): Three.AnimationClip {
	const tracks = clips.flatMap((x) => x.tracks);
	return new Three.AnimationClip(name ?? clips[0].name, -1, tracks);
}

function clipStartTime(clip: Three.AnimationClip): number {
	return clip.tracks.map((x) => x.times[0]).sort((a, b) => a - b)[0];
}

function clipEndTime(clip: Three.AnimationClip): number {
	return clip.tracks
		.map((x) => x.times[x.times.length - 1])
		.sort((a, b) => b - a)[0];
}

function getClipStage(
	clip: Three.AnimationClip,
	camClips: Three.AnimationClip[],
): number | null {
	const startTime = clipStartTime(clip);

	for (const camClip of camClips) {
		if (
			startTime > clipStartTime(camClip) &&
			startTime < clipEndTime(camClip)
		) {
			return Number.parseInt(camClip.name.slice(4));
		}
	}

	return null;
}

function setClipStartTime(clip: Three.AnimationClip, startTime: number) {
	for (const track of clip.tracks) {
		if (track.times[0] < startTime) {
			throw "bad stuff. Cant move track times to negative";
		}

		track.times = track.times.map((x) => x - startTime);
	}
}

function prepareClips(
	camClips: Three.AnimationClip[],
	objClips: Three.AnimationClip[],
	root: Three.Object3D,
): {
	mixer: UpdatableAnimationMixer;
	camActions: Map<number, Three.AnimationAction>;
	actions: Map<number, Three.AnimationAction>;
} {
	const mixer = new Three.AnimationMixer(root) as UpdatableAnimationMixer;
	mixer.tick = (delta) => mixer.update(delta);

	const camActions = new Map(
		camClips.map((clip) => {
			const num = Number.parseInt(clip.name.slice(4));

			const a = mixer.clipAction(clip);
			// a.clampWhenFinished = true;
			a.setLoop(Three.LoopOnce, 1);

			return [num, a];
		}),
	);

	const actions = new Map(
		objClips.map((clip) => {
			const num = Number.parseInt(clip.name.slice(6));

			const a = mixer.clipAction(clip);
			a.clampWhenFinished = true;
			a.setLoop(Three.LoopOnce, 1);

			return [num, a];
		}),
	);

	return { mixer, camActions, actions };
}

export type { Transformation };
export { getTransformData, prepareClips };
