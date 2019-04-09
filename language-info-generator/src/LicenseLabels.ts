/// <reference path="./error-cause.d.ts" />
/// <reference path="./iconv.d.ts" />

import { Iconv } from "iconv";
import mapObj = require("map-obj");
import * as ResourceForkLib from "resourceforkjs";
import { SmartBuffer } from "smart-buffer";
const { freeze } = Object;

export interface ResourcePos {
	file: string;
	resType: string;
	resID: number;
	resName: string;
	byte?: number;
}

function ResourcePos(file: string, r: ResourceForkLib.Resource): ResourcePos {
	return {
		file,
		resID: r.id,
		resName: r.name,
		resType: r.type
	};
}

export class InvalidResourceError extends Error {
	constructor(message: string, public pos: ResourcePos) {
		// tslint:disable-next-line: max-line-length
		super(`[file “${pos.file}”, ${pos.resType} resource ${pos.resID}${pos.resName ? " " + pos.resName : ""}${pos.byte === undefined ? "" : " byte " + pos.byte}]: ${message}`);
	}
}

export class ResourceFileNotFoundError extends Error {
	constructor(message: string, public cause?: Error) {
		super(message);
	}
}

export class ResourceDecodingError extends Error {
	constructor(
		public context: Readonly<{
			regionCode: number;
			resourceID: number;
			encoding: string | ReadonlyArray<string>;
		}>,
		public cause?: Error
	) {
		super(`Can't decode resource ${context.resourceID} (for region ${context.regionCode}) from ${context.encoding}${cause ? `: ${cause.message}` : "."}`);
	}
}

function splitSTR(buf: Buffer, pos: Readonly<ResourcePos>) {
	const sbuf = SmartBuffer.fromBuffer(buf);

	if (sbuf.readUInt16BE() !== 6) {
		throw new InvalidResourceError(
			"Resource data does does not start with the proper STR# signature, 00 06.",
			{ ...pos, byte: 0 }
		);
	}

	const rawStrings: Buffer[] = [];

	while (sbuf.remaining() !== 0) {
		const length = sbuf.readUInt8();
		const remaining = sbuf.remaining();

		if (length > remaining) {
			throw new InvalidResourceError(
				`String length marker indicates that there should be ${length} more bytes, but only ${remaining} bytes remain.`,
				{ ...pos, byte: sbuf.readOffset - 1 }
			);
		}

		rawStrings.push(sbuf.readBuffer(length));
	}

	return rawStrings;
}

export type LicenseLabelMap = Map<number, LicenseLabels>;

async function LicenseLabels(config: LicenseLabels.Config): Promise<LicenseLabelMap> {
	const rmap = await ResourceForkLib.readResourceFork(config.resourcesFile, !config.fromDataFork).catch(e => {
		if (e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT") {
			throw new ResourceFileNotFoundError(`SLAResources file not found at: ${config.resourcesFile}
Generated language data will not contain any predefined label sets!

To fix this error, you need to obtain the SLAResources file from Apple. See language-info-generator/README.md for more information.

If you have the SLAResources file but it's not at the usual path, set the $SLAResources environment variable to the correct path.`, e);
		}
		else
			throw e;
	});

	const result = new Map<number, LicenseLabels>();

	for (const r of Object.values(rmap["STR#"])) {
		const regionCode = config.lookupRegionCode(r.id);
		if (regionCode === null) continue;

		const rawLabels = (() => {
			const buf = Buffer.from(r.data.buffer, r.data.byteOffset, r.data.byteLength);
			const pos = freeze(ResourcePos(config.resourcesFile, r));
			let rawStrings: Buffer[];

			try {
				rawStrings = splitSTR(buf, pos);

				if (rawStrings.length !== 6) {
					throw new InvalidResourceError(
						`There should be 6 strings in this resource, but instead there are ${rawStrings.length}.`,
						pos
					);
				}
			} catch (e) {
				if (e instanceof InvalidResourceError && config.onInvalidResource) {
					const fallback = config.onInvalidResource(e, buf);
					if (fallback !== null)
						result.set(regionCode, fallback);
					return null;
				}
				else
					throw e;
			}

			const rawLabelsPart: Partial<LicenseLabels.AsBinary> = {};

			LicenseLabels.Fields.forEach((field, index) => {
				rawLabelsPart[field] = rawStrings[index];
			});

			return rawLabelsPart as LicenseLabels.AsBinary;
		})();
		if (rawLabels === null) continue;

		let labels: LicenseLabels = rawLabels;
		let labelsWereDecoded = false;

		const encodings = config.lookupEncodings && config.lookupEncodings(regionCode) || [];
		if (encodings.length) {
			for (const encoding of encodings) {
				let iconv: Iconv;

				try {
					iconv = new Iconv(encoding, "UTF8");
				}
				catch (e) {
					// Errors thrown from the Iconv constructor don't indicate whether it's because an encoding was not supported (other than in the message, but there's no guarantee that it won't change), so we have to assume that anything thrown from there means that encoding isn't supported.
					if (config.onWrongEncoding) config.onWrongEncoding(
						new ResourceDecodingError({
							encoding,
							regionCode,
							resourceID: r.id
						}, e),
						rawLabels
					);
					continue;
				}

				try {
					labels = mapObj(rawLabels, (field, rawLabel) => [field, iconv.convert(rawLabel).toString("UTF8")]);
				} catch (e) {
					if (e instanceof Error && (e as any).code === "EILSEQ") {
						// This encoding doesn't match the string. Try another.
						const e2 = new Error(`Can't decode resource ${r.id} (for region ${regionCode}) using ${encoding}: ${e}`);
						e2.cause = e;

						if (config.onWrongEncoding) config.onWrongEncoding(
							new ResourceDecodingError({
								encoding,
								regionCode,
								resourceID: r.id
							}, e),
							rawLabels
						);
						continue;
					}
					else
						throw e;
				}

				// If that didn't throw, then iconv has successfully transcoded all of the strings, so break out of the encoding search.
				labelsWereDecoded = true;
				break;
			}
		}

		if (!labelsWereDecoded && config.onDecodingFailure) {
			// If no encoding was found, then notify.
			labels = config.onDecodingFailure(
				new ResourceDecodingError({
					encoding: encodings,
					regionCode,
					resourceID: r.id
				}),
				rawLabels
			);
		}

		result.set(regionCode, labels);
	}

	return result;
}

type LicenseLabels = LicenseLabels.AsStrings | LicenseLabels.AsBinary;

namespace LicenseLabels {
	export interface AsStrings {
		regionName: string;
		agree: string;
		disagree: string;
		print: string;
		save: string;
		message: string;
	}

	export interface Stringified extends AsStrings {
		encoding?: "native;base64";
	}

	export interface AsBinary {
		regionName: Buffer;
		agree: Buffer;
		disagree: Buffer;
		print: Buffer;
		save: Buffer;
		message: Buffer;
	}

	export function isBinary(labels: LicenseLabels): labels is AsBinary {
		return Buffer.isBuffer(labels.regionName);
	}

	export const Fields: ReadonlyArray<keyof LicenseLabels> = [
		"regionName",
		"agree",
		"disagree",
		"print",
		"save",
		"message"
	];
	freeze(Fields);

	export function stringify(labels: LicenseLabels): Stringified {
		if (isBinary(labels)) {
			return {
				encoding: "native;base64",
				...mapObj(labels, (field, buffer: Buffer) => [field, buffer.toString("base64")])
			};
		}
		else
			return labels;
	}

	export interface Config {
		resourcesFile: string;
		fromDataFork?: boolean;
		lookupRegionCode(resourceID: number): number | null;
		lookupEncodings?(regionCode: number): string[];

		/**
		 * This method is called if one of the provided character encodings was unsuitable for decoding an `STR#` resource. This is only a notification; `onDecodingFailure` will be called if all attempts at decoding a resource fail.
		 *
		 * @param error - Details about the failure.
		 * @param encodedLabels - The undecoded label strings.
		 */
		onWrongEncoding?(
			error: ResourceDecodingError,
			encodedLabels: LicenseLabels.AsBinary
		): void;

		/**
		 * This method is called if none of the provided character encodings were suitable for decoding an `STR#` resource.
		 *
		 * @param error - Details about the failure.
		 * @param encodedLabels - The undecoded label strings.
		 * @return Either `encodedLabels`, or the result of decoding the labels some other way.
		 */
		onDecodingFailure?(
			error: ResourceDecodingError,
			encodedLabels: LicenseLabels.AsBinary
		): LicenseLabels;

		/**
		 * This method is called if an invalid `STR#` resource is found. It may do several things:
		 *
		 * * Return `null`. This causes the invalid `STR#` resource to be silently skipped.
		 * * Return `data` (or some other value conforming to the `LicenseLabels` type). That returned value will be used as the result of processing the `STR#` resource, and further processing will be skipped.
		 * * Throw. This will abort processing immediately.
		 *
		 * @param error - An error object describing the problem.
		 * @param data - The raw bytes of the resource.
		 */
		onInvalidResource?(error: InvalidResourceError, data: Buffer): LicenseLabels | null;
	}
}

export default LicenseLabels;
