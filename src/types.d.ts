declare module "troika-three-text" {
	import * as THREE from "three";

	type Percent = `${number}%`;
	type AnchorXOptions = "left" | "center" | "right" | number | Percent;
	type AnchorYOptions =
		| "top"
		| "top-baseline"
		| "top-cap"
		| "top-ex"
		| "middle"
		| "bottom-baseline"
		| "bottom"
		| number
		| Percent;

	export class Text extends THREE.Mesh {
		constructor();
		sync(callback?: () => void): void;

		public text: string;
		public fontSize: number;
		public fontWeight: "normal" | "bold";
		public font: string;
		public color: string | number | THREE.Color;
		public maxWidth: number;
		public overflowWrap: "normal" | "break-word";
		public whiteSpace: "normal" | "nowrap";

		public anchorX: AnchorXOptions;
		public anchorY: AnchorYOptions;
	}
}
