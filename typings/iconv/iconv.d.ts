// @types/iconv is very incorrect, so here's a declaration for the iconv module that isn't.

/// <reference types="node" />

declare module "iconv" {
	interface Iconv extends NodeJS.WritableStream {}
	class Iconv {
		constructor(fromCharset: string, toCharset: string);
		convert(input: string | Buffer, charset?: string): Buffer;
	}
	export {Iconv};
}
