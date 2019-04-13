import { Iconv } from "iconv";
import mapObj = require("map-obj");
import * as ResourceForkLib from "resourceforkjs";
import { SmartBuffer } from "smart-buffer";
import { Info as VErrorInfo, Options as VErrorOptions, VError } from "verror";
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

export class InvalidResourceError extends VError {
	constructor(
		options: VErrorOptions & {
			info: VErrorInfo & {
				pos: ResourcePos;
			}
		},
		message: string,
		...params: any[]
	) {
		const {pos} = options.info;
		super(
			options,
			"[file “%s”, %s resource %d%s%s]: " + message,
			pos.file,
			pos.resType,
			pos.resID,
			pos.resName ? ` ${pos.resName}` : "",
			pos.byte === undefined ? "" : ` byte ${pos.byte}`,
			...params
		);
	}
}

export class ResourceFileNotFoundError extends Error {
	constructor(resourcesFilePath: string) {
		super(`SLAResources file not found at: ${resourcesFilePath}
Generated language data will not contain any predefined label sets!

To fix this error, you need to obtain the SLAResources file from Apple. See language-info-generator/README.md for more information.

If you have the SLAResources file but it's not at the usual path, set the $SLAResources environment variable to the correct path.`);
	}
}

export class ResourceDecodingError extends VError {
	constructor(
		options: {
			cause?: Error | null;
			info: VErrorInfo & {
				regionCode: number;
				resourceID: number;
				charset: string | ReadonlyArray<string>;
			};
		},
		message?: string,
		...params: any[]
	) {
		super(
			options,
			"Can't decode resource %d (for region %d) from %s" + (message ? ": " + message : (options.cause && options.cause.message) ? "" : "."),
			options.info.resourceID,
			options.info.regionCode,
			options.info.charset,
			...params
		);
	}
}

function splitSTR(buf: Buffer, pos: Readonly<ResourcePos>) {
	const sbuf = SmartBuffer.fromBuffer(buf);

	if (sbuf.readUInt16BE() !== 6) {
		throw new InvalidResourceError(
			{
				info: {
					pos: { ...pos, byte: 0 }
				}
			},
			"Resource data does does not start with the proper STR# signature, 00 06."
		);
	}

	const rawStrings: Buffer[] = [];

	while (sbuf.remaining() !== 0) {
		const length = sbuf.readUInt8();
		const remaining = sbuf.remaining();

		if (length > remaining) {
			throw new InvalidResourceError(
				{
					info: {
						pos: { ...pos, byte: sbuf.readOffset - 1 }
					}
				},
				"String length marker indicates that there should be %d more bytes, but only %d bytes remain.",
				length,
				remaining
			);
		}

		rawStrings.push(sbuf.readBuffer(length));
	}

	return rawStrings;
}

export type LicenseLabelMap = Map<number, LicenseLabels>;

async function LicenseLabels(config: LicenseLabels.Config): Promise<LicenseLabelMap> {
	const rmap = await ResourceForkLib.readResourceFork(config.resourcesFile, !config.fromDataFork).catch(e => {
		if (e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT")
			throw new ResourceFileNotFoundError(config.resourcesFile);
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
						{
							info: {
								pos
							}
						},
						`There should be 6 strings in this resource, but instead there are %d.`,
						rawStrings.length
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

		const charsets = config.lookupCharsets && config.lookupCharsets(regionCode) || [];
		if (charsets.length) {
			for (const charset of charsets) {
				let iconv: Iconv;

				try {
					iconv = new Iconv(charset, "UTF8");
				}
				catch (e) {
					// Errors thrown from the Iconv constructor don't indicate whether it's because a charset was not supported (other than in the message, but there's no guarantee that it won't change), so we have to assume that anything thrown from there means that charset isn't supported.
					if (config.onWrongCharset) config.onWrongCharset(
						new ResourceDecodingError({
							cause: e,
							info: {
								charset,
								regionCode,
								resourceID: r.id
							}
						}),
						rawLabels
					);
					continue;
				}

				try {
					labels = mapObj(rawLabels, (field, rawLabel) => [field, iconv.convert(rawLabel).toString("UTF8")]);
				} catch (e) {
					if (e instanceof Error && (e as any).code === "EILSEQ") {
						// This charset doesn't match the string. Try another.
						if (config.onWrongCharset) config.onWrongCharset(
							new ResourceDecodingError(
								{
									cause: e,
									info: {
										charset,
										regionCode,
										resourceID: r.id
									}
								}
							),
							rawLabels
						);
						continue;
					}
					else {
						throw new ResourceDecodingError(
							{
								cause: e,
								info: {
									charset,
									regionCode,
									resourceID: r.id
								}
							}
						);
					}
				}

				// If that didn't throw, then iconv has successfully transcoded all of the strings, so break out of the charset search.
				labelsWereDecoded = true;
				break;
			}
		}

		if (!labelsWereDecoded && config.onDecodingFailure) {
			// If no charset was found, then notify.
			labels = config.onDecodingFailure(
				new ResourceDecodingError({
					info: {
						charset: charsets,
						regionCode,
						resourceID: r.id
					}
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
		charset?: "native;base64";
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
				charset: "native;base64",
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
		lookupCharsets?(regionCode: number): string[];

		/**
		 * This method is called if one of the provided character charsets was unsuitable for decoding an `STR#` resource. This is only a notification; `onDecodingFailure` will be called if all attempts at decoding a resource fail.
		 *
		 * @param error - Details about the failure.
		 * @param encodedLabels - The undecoded label strings.
		 */
		onWrongCharset?(
			error: ResourceDecodingError,
			encodedLabels: LicenseLabels.AsBinary
		): void;

		/**
		 * This method is called if none of the provided character charsets were suitable for decoding an `STR#` resource.
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
