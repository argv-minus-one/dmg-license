import { InvalidEncodedTextError, StringEncoding } from "iconv-corefoundation";
import * as ResourceForkLib from "resourceforkjs";
import { SmartBuffer } from "smart-buffer";
import { Info as VErrorInfo, Options as VErrorOptions } from "verror";
import Labels from "../src/Labels";
import { PrettyVError } from "../src/util/format-verror";
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

export class InvalidResourceError extends PrettyVError {
	constructor(
		options: VErrorOptions & {
			info: VErrorInfo & {
				pos: ResourcePos;
			}
		},
		message?: string,
		...params: any[]
	) {
		const {pos} = options.info;
		super(
			options,
			"[file “%s”, %s resource %d%s%s]" + (message ? `: ${message}` : ""),
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
): Labels.WithLanguageName | null {
	const charset = config.lookupCharset && config.lookupCharset(languageID) || null;

	if (charset) {
		try {
			return Labels.map(rawLabels, label => charset.decode(label));
		}
		catch (e) {
			if (e instanceof InvalidEncodedTextError) {
				const e2 = new InvalidResourceError(
					{
						cause: e,
						info: {
							pos
						}
					}
				);

				if (config.onInvalidResource)
					return config.onInvalidResource(e2, rawLabels);
				else
					throw e2;
			}
			else
				throw e;
		}
	}
	else
		return null;
}

export type LanguageLabelsMap = Map<number, Labels.WithLanguageName>;

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

		const rawLabels = readRawLabels(r, pos);

		if ("error" in rawLabels) {
			if (config.onInvalidResource) {
				const fallback = config.onInvalidResource(rawLabels.error, rawLabels.data);
				if (fallback)
					result.set(languageID, fallback);
				continue;
			}
			else
				throw rawLabels.error;
		}

		const decodedLabels = decodeLabels(rawLabels, languageID, pos, config);

		if (decodedLabels)
			result.set(languageID, decodedLabels);
	}

	return result;
}

namespace extractLabels {
	export interface Config {
		resourcesFile: string;
		fromDataFork?: boolean;
		lookupLanguageID(resourceID: number): number | null;
		lookupCharset?(languageID: number): StringEncoding;

		/**
		 * This method is called if an invalid `STR#` resource is found. It may do several things:
		 *
		 * * Return `null`. This causes the invalid `STR#` resource to be silently skipped.
		 * * Return `Labels`. That returned value will be used as the result of processing the `STR#` resource.
		 * * Throw. This will abort processing immediately.
		 *
		 * @param error - An error object describing the problem.
		 * @param data - The raw bytes of the resource, or if available, the raw bytes of the individual label strings.
		 */
		onInvalidResource?(error: InvalidResourceError, data: Buffer | Labels.WithLanguageName<Buffer>): Labels.WithLanguageName | null;
	}
}

export default extractLabels;
