import { SmartBuffer } from "smart-buffer";
import { Labels, LabelsSpec, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import Language from "./Language";
import { readFileP } from "./util";
import { bufferSplitMulti } from "./util/buffer-split";
import { ErrorBuffer } from "./util/errors";
import { PrettyVError } from "./util/format-verror";

/**
 * Generates a `STR#` resources for the given `labels`.
 */
export function packLabels(
	labels: Labels<Buffer | CodedString>,
	lang: Language,
	context: Context
): Buffer {
	const sbuf = new SmartBuffer();

	function writeStr(data: Buffer, description: string) {
		const length = data.length;

		if (length > 255) {
			throw Object.assign(
				new Error(`${description} for ${lang.englishName} is too large to write into a STR# resource. The maximum size is 255 bytes, but it is ${length} bytes.`),
				{ data }
			);
		}

		sbuf.writeUInt8(length);
		sbuf.writeBuffer(data);
	}

	// Magic
	sbuf.writeUInt16BE(6);

	// Labels
	const errors = new ErrorBuffer();

	Labels.forEach(
		labels,
		(label, key) => {
			let data: Buffer;

			try {
				data = Buffer.isBuffer(label) ? label : CodedString.encode(label, lang);
			}
			catch (e) {
				errors.add(new PrettyVError(e, "Cannot encode %s for %s", Labels.descriptions[key].toLowerCase(), lang.englishName));
				return;
			}

			writeStr(data, Labels.descriptions[key]);
		},
		{ onNoLanguageName() {
			// If no language name is provided, try the languageName in the built-in labels.
			let languageName: CodedString | Buffer | null = lang.labels && lang.labels.languageName || null;

			if (languageName !== null && !Buffer.isBuffer(languageName))
				languageName = CodedString.encode(languageName, lang);

			// Failing that, encode the localizedName of the language.
			if (languageName === null)
				languageName = CodedString.encode(lang.localizedName, lang);

			writeStr(languageName, Labels.descriptions.languageName);
		}}
	);

	errors.check();
	return sbuf.toBuffer();
}

/**
 * Loads the label set for the given `LicenseSpec`, encoded as a `STR#` resource.
 *
 * @param lang - Language to encode the labels for.
 */
export default function loadLabels(
	spec: LabelsSpec | null | undefined,
	contextOrOptions: Context | Options,
	lang: Language
): Promise<Buffer> {
	const context =
		contextOrOptions instanceof Context ?
		contextOrOptions :
		new Context(contextOrOptions);

	if (spec) {
		const loader = LabelLoader[spec.type || "inline"];
		return loader(spec as any, lang, context);
	}
	else
		return loadDefault(lang, context);
}

function loadDefault(
	lang: Language,
	context: Context
): Promise<Buffer> {
	const data = context.defaultLabelsOf(lang);
	return data instanceof Error ? Promise.reject(data) : Promise.resolve(data);
}

type LabelLoader<T extends LabelsSpec.Type | undefined> = (
	spec: LabelsSpec.ForType<T>,
	lang: Language,
	context: Context
) => Promise<Buffer>;

const LabelLoader: {
	[T in LabelsSpec.Type]: LabelLoader<T>;
} = {
	"inline"(spec, lang, context) {
		return Promise.resolve(packLabels(
			Labels.map(spec, label => ({
				charset: spec.charset!,
				encoding: spec.encoding!,
				text: label
			})),
			lang, context
		));
	},

	async "one-per-file"(spec, lang, context) {
		return packLabels(
			await Labels.mapAsync(
				spec,
				async label => ({
					charset: spec.charset || "UTF-8",
					encoding: spec.encoding,
					text: await readFileP(label)
				})
			),
			lang, context
		);
	},

	async "json"(spec, lang, context) {
		const fpath = context.resolvePath(spec.file);
		const json: Labels<unknown> = JSON.parse((await readFileP(fpath)).toString("UTF-8"));

		if (typeof json !== "object") throw new PrettyVError(
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
					errors.add(new PrettyVError(
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
					encoding: spec.encoding!,
					text: data
				};
			}
		);

		errors.check();
		return packLabels(labels, lang, context);
	},

	async "raw"(spec, lang, context) {
		// Simplest case. The STR# resource is already fully assembled; it just needs to be returned.
		return await readFileP(context.resolvePath(spec.file));
	},

	async "delimited"(spec, lang, context) {
		const fpath = context.resolvePath(spec.file);
		const data = await readFileP(fpath);
		const pieces = bufferSplitMulti(data, spec.delimiters);
		const pieceCount = pieces.length;

		if (pieceCount !== 5 && pieceCount !== 6) {
			throw new PrettyVError(
				{
					info: {
						path: fpath
					}
				},
				"Delimited labels file should have contained 5 or 6 parts, but instead contains %d.",
				pieceCount
			);
		}
		else {
			const labels = Labels.create<CodedString>(
				(key, index) => ({
					charset: spec.charset,
					encoding: spec.encoding,
					text: pieces[index]
				}),
				{ includeLanguageName: pieceCount === 6 }
			);

			return packLabels(labels, lang, context);
		}
	}
};
