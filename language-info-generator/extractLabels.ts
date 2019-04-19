import { Iconv } from "iconv";
import * as ResourceForkLib from "resourceforkjs";
import { SmartBuffer } from "smart-buffer";
import { Info as VErrorInfo, Options as VErrorOptions, VError } from "verror";
import { Labels, LanguageInfoLabels } from "../src/Labels";
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
		options: ResourceDecodingError.Options,
		message?: string,
		...params: any[]
	) {
		super(
			options,
			"Can't decode resource %d (for language %d) from %s" + (message ? ": " + message : (options.cause && options.cause.message) ? "" : "."),
			options.info.resourceID,
			options.info.languageID,
			options.info.charset,
			...params
		);
	}
}

export namespace ResourceDecodingError {
	export interface Options {
		cause?: Error | null;
		info: VErrorInfo & {
			languageID: number;
			resourceID: number;
			charset: string | ReadonlyArray<string>;
		};
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

function readRawLabels(
	r: ResourceForkLib.Resource,
	pos: ResourcePos
): Labels.WithLanguageName<Buffer> | {
	error: InvalidResourceError,
	data: Buffer
} {
	const buf = Buffer.from(r.data.buffer, r.data.byteOffset, r.data.byteLength);
	const rawStrings = splitSTR(buf, pos);

	if (rawStrings.length !== 6) {
		return {
			data: buf,
			error: new InvalidResourceError(
				{
					info: {
						pos
					}
				},
				"There should be 6 strings in this resource, but instead there are %d.",
				rawStrings.length
			)
		};
	}

	return Labels.create((_, index) => rawStrings[index], { includeLanguageName: true });
}

function decodeLabels(
	rawLabels: Labels.WithLanguageName<Buffer>,
	languageID: number,
	pos: ResourcePos,
	config: extractLabels.Config
): LanguageInfoLabels {
	const charsets = config.lookupCharsets && config.lookupCharsets(languageID) || [];

	for (const charset of charsets) {
		const info: ResourceDecodingError.Options["info"] = {
			charset,
			languageID,
			resourceID: pos.resID
		};

		let iconv: Iconv;

		try {
			iconv = new Iconv(charset, "UTF8");
		}
		catch (e) {
			// Errors thrown from the Iconv constructor don't indicate whether it's because a charset was not supported (other than in the message, but there's no guarantee that it won't change), so we have to assume that anything thrown from there means that charset isn't supported.
			if (config.onWrongCharset) config.onWrongCharset(
				new ResourceDecodingError({
					cause: e,
					info
				}),
				rawLabels
			);
			continue;
		}

		try {
			return Labels.map(rawLabels, label => iconv.convert(label).toString("UTF8"));
		}
		catch (e) {
			if (e instanceof Error && (e as any).code === "EILSEQ") {
				// This charset doesn't match the string. Try another.
				if (config.onWrongCharset) config.onWrongCharset(
					new ResourceDecodingError({
						cause: e,
						info
					}),
					rawLabels
				);
			}
			else {
				throw new ResourceDecodingError({
					cause: e,
					info
				});
			}
		}
	}

	// If no charset was found, then notify and fall back.
	const fallbackLabels = (
		config.onDecodingFailure
		&& config.onDecodingFailure(
			new ResourceDecodingError({
				info: {
					charset: charsets,
					languageID,
					resourceID: pos.resID
				}
			}),
			rawLabels
		)
		|| rawLabels
	);

	if (Buffer.isBuffer(fallbackLabels.agree)) {
		return {
			charset: "native;base64",
			...Labels.map(
				fallbackLabels as Labels.WithLanguageName<Buffer>,
				label => label.toString("base64")
			)
		};
	}
	else
		return fallbackLabels as Labels.WithLanguageName<string>;
}

export type LanguageLabelsMap = Map<number, LanguageInfoLabels>;

async function extractLabels(config: extractLabels.Config): Promise<LanguageLabelsMap> {
	const rmap = await ResourceForkLib.readResourceFork(config.resourcesFile, !config.fromDataFork).catch(e => {
		if (e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT")
			throw new ResourceFileNotFoundError(config.resourcesFile);
		else
			throw e;
	});

	const result: LanguageLabelsMap = new Map();

	for (const r of Object.values(rmap["STR#"])) {
		const languageID = config.lookupLanguageID(r.id);
		if (languageID === null) continue;

		const pos = freeze(ResourcePos(config.resourcesFile, r));

		let rawLabels = readRawLabels(r, pos);

		if ("error" in rawLabels) {
			if (config.onInvalidResource) {
				const fallback = config.onInvalidResource(rawLabels.error, rawLabels.data);

				if (fallback) {
					if (Buffer.isBuffer(fallback.agree))
						rawLabels = fallback as Labels.WithLanguageName<Buffer>;
					else {
						result.set(languageID, fallback as Labels.WithLanguageName<string>);
						continue;
					}
				}
				else
					continue;
			}
			else
				throw rawLabels.error;
		}

		result.set(languageID, decodeLabels(rawLabels, languageID, pos, config));
	}

	return result;
}

namespace extractLabels {
	export interface Config {
		resourcesFile: string;
		fromDataFork?: boolean;
		lookupLanguageID(resourceID: number): number | null;
		lookupCharsets?(languageID: number): string[];

		/**
		 * This method is called if one of the provided character charsets was unsuitable for decoding an `STR#` resource. This is only a notification; `onDecodingFailure` will be called if all attempts at decoding a resource fail.
		 *
		 * @param error - Details about the failure.
		 * @param encodedLabels - The undecoded label strings.
		 */
		onWrongCharset?(
			error: ResourceDecodingError,
			encodedLabels: Labels.WithLanguageName<Buffer>
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
			encodedLabels: Labels.WithLanguageName<Buffer>
		): Labels.WithLanguageName | Labels.WithLanguageName<Buffer>;

		/**
		 * This method is called if an invalid `STR#` resource is found. It may do several things:
		 *
		 * * Return `null`. This causes the invalid `STR#` resource to be silently skipped.
		 * * Return `Labels` or `Labels<Buffer>`. That returned value will be used as the result of processing the `STR#` resource, and further processing will be skipped.
		 * * Throw. This will abort processing immediately.
		 *
		 * @param error - An error object describing the problem.
		 * @param data - The raw bytes of the resource.
		 */
		onInvalidResource?(error: InvalidResourceError, data: Buffer): Labels.WithLanguageName | Labels.WithLanguageName<Buffer> | null;
	}
}

export default extractLabels;
