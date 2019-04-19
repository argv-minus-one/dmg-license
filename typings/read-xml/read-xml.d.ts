/// <reference types="node" />

declare module "read-xml" {
	import { PathLike } from "fs";
	import { TransformOptions, Transform } from "stream";

	export function readXML(
		content: Buffer | PathLike,
		cb: (
			err: Error | null,
			result: typeof err extends null ? undefined : {
				encoding: string;
				content: string;
			}
		) => void
	): void;

	export function createStream(streamOpts?: TransformOptions): Transform;
}
