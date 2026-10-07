# Instruction Viewer

A browser-based Three.js viewer for animated, step-by-step 3D instructions. Used by TruMo to display uploaded instruction models with camera animation, stage navigation, and playback controls.

## Features

- glTF/GLB loading from an `ArrayBuffer`, with external buffers and textures supplied as blobs.
- Stage selection, forward/backward playback, pause, timeline scrubbing, and playback speed controls.
- Orbit controls and animated camera transitions.
- An in-scene interface built with Three.js and `troika-three-text`.
- Container resizing and a WebXR entry button for supported environments.

## Installation

This repository is a TypeScript source package: its entry point is `src/index.ts`. Use a bundler that supports TypeScript and Three.js addons; there is no standalone application or prebuilt distribution in this repository.

In the TruMo parent repository, initialize the submodules and install dependencies from the workspace root:

```sh
git submodule update --init --recursive
bun install
```

For another application, add the repository as a local package and install its peer dependencies:

```sh
bun add ./path/to/instruction-viewer three troika-three-text
```

TypeScript consumers also need `@types/three`. The package currently declares unrestricted peer dependency versions; the TruMo frontend uses Three.js `0.173.0` and `troika-three-text` `0.52.3`.

## Usage

Provide a container with a nonzero width and height, the model bytes, and a map of any external assets referenced by the model:

```html
<div id="instruction-container" style="width: 100%; height: 80vh;"></div>
```

```ts
import { threeMain } from "instruction-viewer";

async function openInstruction() {
  const container = document.getElementById("instruction-container");
  if (!container) throw new Error("Missing viewer container");

  const model = await fetch("/instructions/example.gltf");
  const buffer = await fetch("/instructions/example.bin");
  const texture = await fetch("/instructions/texture.png");

  await threeMain(
    await model.arrayBuffer(),
    {
      "example.bin": await buffer.blob(),
      "texture.png": await texture.blob(),
    },
    () => {
      // The viewer's menu button stops playback and mouse handling.
      // Navigate back to your application's instruction list here.
      window.location.assign("/");
    },
    container,
  );
}

openInstruction().catch(console.error);
```

The URLs and filenames above are examples; supply a model authored for the stage format described below. A GLB with embedded resources can use an empty asset map.

Asset-map keys must match the resource URIs requested by the glTF loader, including any relative directory segments. The loader resolves those keys to temporary object URLs and revokes them after successful loading.

## API

The package entry point exports one function:

```ts
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

function threeMain(
  modelData: ArrayBuffer,
  assets: Record<string, Blob | File>,
  returnToMainMenu: () => void,
  container?: HTMLElement,
  debugChanges?: (model: GLTF) => void,
): Promise<void>;
```

| Argument | Purpose |
| --- | --- |
| `modelData` | glTF JSON bytes or GLB bytes. |
| `assets` | External resources indexed by their glTF resource URI. |
| `returnToMainMenu` | Callback invoked by the viewer's menu button. |
| `container` | Element receiving the canvas and WebXR button. Defaults to the element with ID `main-canvas`. |
| `debugChanges` | Optional callback receiving the parsed model before it is added to the scene and playback starts. |

The promise resolves after model initialization, not when the user exits. Loading errors reject the promise. If no container can be found, the function logs an error and returns without creating a viewer.

## Instruction model format

The animation pipeline expects staged instruction models rather than arbitrary animated glTF files:

- Camera animation clips use names such as `cam_1`, `cam_2`, and so on. The numeric suffix identifies the stage.
- Object animation clips are grouped into camera-stage time ranges and combined internally into `stage_<number>` clips.
- Animated track names must identify objects present in the scene graph. Stage state stores position and quaternion transforms.
- When the model contains cameras, the viewer uses the first camera and sets its field of view to `50` and far plane to `200`.

Models without the expected stage animations may fail during initialization. The current loader also injects sample stage descriptions into `model.userData.descriptions`; authored descriptions are not preserved there.

## Host-provided assets

In addition to the model's asset map, the viewer requests resources from the host application:

| URL | Purpose |
| --- | --- |
| `/api/assets/room.json` | Three.js ObjectLoader JSON for the surrounding room. |
| `/public/focus_sphere.glb` | Focus-point marker, loaded when the instruction model contains a camera. |

Serve those resources or adapt the paths in `src/World/components/environment.ts` and `src/World/World.ts` for another application. These assets are not included in this repository.

WebXR availability depends on browser support, a compatible device, and a secure context.

## Development

After installing dependencies, run the TypeScript check from this repository:

```sh
bun x --no-install tsc --noEmit
```

There are no build, development-server, or test scripts in `package.json`. Use the TruMo frontend or another host application to preview changes.

| Source | Responsibility |
| --- | --- |
| `src/index.ts` | Public entry point. |
| `src/World/World.ts` | Scene initialization, model loading, and viewer integration. |
| `src/World/systems/Animator.ts` | Stage playback, transitions, and timeline controls. |
| `src/World/systems/animationTransformer.ts` | Stage clip preparation and saved transforms. |
| `src/World/utils/loadGltf.ts` | Model parsing and external resource resolution. |
| `src/World/utils/ui.ts` | Viewer menus and playback controls. |

## Lifecycle limitations

`threeMain` does not return a viewer handle or expose a disposal API. The menu button stops the animation loop and mouse listeners, but does not dispose the renderer, remove the appended elements, or stop the resize listener. Account for this before repeatedly mounting the viewer in a single-page application.
