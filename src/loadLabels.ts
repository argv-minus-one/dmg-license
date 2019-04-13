import { SmartBuffer } from "smart-buffer";
import { VError } from "verror";
import { Labels, LabelsSpec, LicenseSpec, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import Language from "./Language";
import * as languages from "./languages";
import { arrayify, readFileP } from "./util";
import { bufferSplitMulti } from "./util/buffer-split";
import { ErrorBuffer } from "./util/errors";

/**
 * Generates a `STR#` resources for the given `labels`.
 */
export function packLabels(
	labels: Labels<Buffer | CodedString>,
	lang: Language | Language[],
	context: Context
): Buffer {
	const langs = arrayify(lang);

	if (!langs.length)
		throw new RangeError("packLabels called with an empty array for the lang parameter.");

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
export default function loadLabels(
	spec: LicenseSpec,
	contextOrOptions: Context | Options,
	langs: Language[] = languages.bySpec(spec)
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

	return Promise.reject(VError.errorFromList(errors));
}

type LabelLoader<T extends LabelsSpec.Type | undefined> = (
	spec: LabelsSpec.ForType<T>,
	langs: Language[],
	context: Context
) => Promise<Buffer>;

const LabelLoader: {
	[T in LabelsSpec.Type]: LabelLoader<T>;
} = {
	"inline"(spec, langs, context) {
		return Promise.resolve(packLabels(
			Labels.map(spec, label => ({
				charset: spec.charset!,
				data: label,
				encoding: spec.encoding!
			})),
			langs, context
		));
	},

	async "one-per-file"(spec, langs, context) {
		return packLabels(
			await Labels.mapAsync(
				spec,
				async label => ({
					charset: spec.charset || "UTF-8",
					data: await readFileP(label),
					encoding: spec.encoding
				})
			),
			langs, context
		);
	},

	async "json"(spec, langs, context) {
		const fpath = context.resolvePath(spec.file);
		const json: Labels<unknown> = JSON.parse((await readFileP(fpath)).toString("UTF-8"));

		if (typeof json !== "object") throw new VError(
			{
				info: {
					path: fpath
				}
			},
			"Root value of JSON file is not an object."
		);

		const errors = new ErrorBuffer();

		const labels = Labels.map<unknown, CodedString>(
			json,
			(data, labelKey) => {
				if (typeof data !== "string") {
					errors.add(new VError(
						{
							info: {
								path: fpath
							}
						},
						"Root object of JSON file's ‘%s’ property has type %s, but should be string.",
						labelKey,
						data === null ? "null" : typeof data
					));
					return null as unknown as CodedString;
				}
				else return {
					charset: spec.charset!,
					data,
					encoding: spec.encoding!
				};
			}
		);

		errors.check();
		return packLabels(labels, langs, context);
	},

	async "raw"(spec, langs, context) {
		// Simplest case. The STR# resource is already fully assembled; it just needs to be returned.
		return await readFileP(context.resolvePath(spec.file));
	},

	async "delimited"(spec, langs, context) {
		const fpath = context.resolvePath(spec.file);
		const data = await readFileP(fpath);
		const pieces = bufferSplitMulti(data, spec.delimiters);

		if (pieces.length !== 5) {
			throw new VError(
				{
					info: {
						path: fpath
					}
				},
				"Delimited labels file should have contained 5 parts, but instead contains %d.",
				pieces.length
			);
		}
		else {
			const labels = Labels.create<CodedString>((key, index) => ({
				charset: spec.charset,
				data: pieces[index],
				encoding: spec.encoding
			}));

			return packLabels(labels, langs, context);
		}
	}
};
