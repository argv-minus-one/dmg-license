import { SmartBuffer } from "smart-buffer";
import { VError } from "verror";
import { Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import { Language } from "./languages";
import { LabelsSpec, LicenseSpec } from "./spec";
import { arrayify, readFileP, unarrayify } from "./util";
import { bufferSplitMulti } from "./util/buffer-split";
import { ErrorBuffer } from "./util/errors";
const { freeze } = Object;

export interface Labels<T = string> {
	agree: T;
	disagree: T;
	print: T;
	save: T;
	message: T;
}

export namespace Labels {
	export const keys = freeze(["agree", "disagree", "print", "save", "message"] as Array<keyof Labels>);

	export const descriptions = freeze({
		agree: "“Agree” button label",
		disagree: "“Disagree” button label",
		message: "License agreement instructions text",
		print: "“Print” button label",
		save: "“Save” button label"
	} as { [K in keyof Labels]: string });

	/**
	 * Generates a `STR#` resources for the given `labels`.
	 */
	export function pack(
		labels: Labels<Buffer | CodedString>,
		lang: Language | Language[],
		context: Context
	): Buffer {
		const langs = arrayify(lang);

		if (!langs.length)
			throw new RangeError("Labels.pack called with an empty array for the lang parameter.");

		const sbuf = new SmartBuffer();

		function writeStr(data: Buffer, description: string) {
			const length = data.length;

			if (length > 255) {
				throw Object.assign(
					new Error(`${description} for ${langs[0].englishName} is too large to write into a STR# resource. The maximum size is 255 bytes, but it is ${length} bytes.`),
					{ data }
				);
			}

			sbuf.writeUInt8(length);
			sbuf.writeBuffer(data);
		}

		// Magic
		sbuf.writeUInt16BE(6);

		// Language name
		{
			const languageName = CodedString.encode(langs[0].localizedName, langs, context);
			writeStr(languageName, "Language name");
		}

		// Labels
		for (const labelKey of Labels.keys) {
			const label = labels[labelKey];
			const data = Buffer.isBuffer(label) ? label : CodedString.encode(label, langs, context);
			writeStr(data, Labels.descriptions[labelKey]);
		}

		return sbuf.toBuffer();
	}

	/**
	 * Loads the label set for the given `LicenseSpec`, encoded as a `STR#` resource.
	 *
	 * @param langs - Languages that `spec` applies to. Computed from `spec` if not supplied.
	 */
	export function load(
		spec: LicenseSpec,
		contextOrOptions: Context | Options,
		langs: Language[] = Language.forSpec(spec)
	): Promise<Buffer> {
		const context =
			contextOrOptions instanceof Context ?
			contextOrOptions :
			new Context(contextOrOptions);

		const labels = spec.labels;

		if (labels) {
			const loader = LabelLoader[labels.type || "inline"];
			return loader(labels as any, langs, context);
		}
		else
			return loadDefault(spec, langs, context);
	}

	function loadDefault(
		spec: LicenseSpec,
		langs: Language[],
		context: Context
	): Promise<Buffer> {
		const errors: Error[] = [];

		for (const lang of langs) {
			const data = context.defaultLabelsOf(lang);

			if (data instanceof Error)
				errors.push(data);
			else
				return Promise.resolve(data);
		}

		return Promise.reject(new VError(
			{
				cause: VError.errorFromList(errors) || undefined,
				info: {
					lang: spec.lang,
					regionCode: unarrayify(langs.map(lang => lang.regionCode))
				}
			},
			"No default labels found for language(s) %s. The “labels” property must be present for these language(s).",
			arrayify(spec.lang).map((langTag, index) => `${langTag} (${langs[index].englishName})`).join(", ")
		));
	}
}

export interface NoLabels extends Partial<Labels<undefined>> {}

type LabelLoader<T extends LabelsSpec.Type | undefined> = (
	spec: LabelsSpec.ForType<T>,
	langs: Language[],
	context: Context
) => Promise<Buffer>;

const LabelLoader: {
	[T in LabelsSpec.Type]: LabelLoader<T>;
} = {
	"inline"(spec, langs, context) {
		const labelsCoded = {} as Labels<CodedString>;

		for (const labelKey of Labels.keys) {
			labelsCoded[labelKey] = {
				charset: spec.charset!,
				data: spec[labelKey],
				encoding: spec.encoding!
			};
		}

		return Promise.resolve(Labels.pack(labelsCoded, langs, context));
	},

	async "one-per-file"(spec, langs, context) {
		const labelsCoded = {} as Labels<CodedString>;

		for (const labelKey of Labels.keys) {
			labelsCoded[labelKey] = {
				charset: spec.charset || "UTF-8",
				data: await readFileP(spec[labelKey]),
				encoding: spec.encoding
			};
		}

		return Labels.pack(labelsCoded, langs, context);
	},

	async "json"(spec, langs, context) {
		const json = JSON.parse((await readFileP(spec.file)).toString("UTF-8"));

		if (typeof json !== "object") throw new VError(
			{
				info: {
					path: spec.file
				}
			},
			"Root value of JSON file is not an object."
		);

		const labelsCoded = {} as Labels<CodedString>;
		const errors = new ErrorBuffer();

		for (const labelKey of Labels.keys) {
			const data = json[labelKey];

			if (typeof data !== "string") {
				errors.add(new VError(
					{
						info: {
							path: spec.file
						}
					},
					"Root object of JSON file's ‘%s’ property has type %s, but should be string.",
					labelKey,
					data === null ? "null" : typeof data
				));
				continue;
			}

			labelsCoded[labelKey] = {
				charset: spec.charset!,
				data,
				encoding: spec.encoding!
			};
		}

		errors.check();
		return Labels.pack(labelsCoded, langs, context);
	},

	async "raw"(spec, langs, context) {
		// Simplest case. The STR# resource is already fully assembled; it just needs to be returned.
		return await readFileP(spec.file);
	},

	async "delimited"(spec, langs, context) {
		const data = await readFileP(spec.file);
		const pieces = bufferSplitMulti(data, spec.delimiters);
		const labelsCoded = {} as Labels<CodedString>;

		if (pieces.length !== 5) {
			throw new VError(
				{
					info: {
						path: spec.file
					}
				},
				"Delimited labels file should have contained 5 parts, but instead contains %d.",
				pieces.length
			);
		}
		else {
			Labels.keys.forEach((key, index) => labelsCoded[key] = {
				charset: spec.charset,
				data: pieces[index],
				encoding: spec.encoding
			});
		}

		return Labels.pack(labelsCoded, langs, context);
	}
};
