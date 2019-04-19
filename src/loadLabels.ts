import { SmartBuffer } from "smart-buffer";
import { VError } from "verror";
import { Labels, LabelsSpec, LicenseSpec, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import IconvCache from "./IconvCache";
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
	if (labels.languageName === undefined) {
		const languageName = CodedString.encode(langs[0].localizedName, langs, context);
		writeStr(languageName, Labels.descriptions.languageName);
	}

	// Labels
	const errors = new ErrorBuffer();

	Labels.forEach(
		labels,
		(label, key) => {
			let data: Buffer;

			try {
				data = Buffer.isBuffer(label) ? label : CodedString.encode(label, langs, context);
			}
			catch (e) {
				errors.add(new VError(e, "Cannot encode %s label for %s", Labels.descriptions[key].toLowerCase(), langs[0].englishName));
				return;
			}

			writeStr(data, Labels.descriptions[key]);
		},
		{ onNoLanguageName() {
			// If no language name is provided, try the languageName in the built-in labels.
			let languageName: CodedString | Buffer | null = langs[0].labels && langs[0].labels.languageName || null;

			try {
				if (languageName !== null && !Buffer.isBuffer(languageName))
					languageName = CodedString.encode(languageName, langs, context);

				// Failing that, encode the localizedName of the language.
				if (languageName === null)
					languageName = CodedString.encode(langs[0].localizedName, langs, context);
			}
			catch (e) {
				if (e instanceof IconvCache.NoSuitableCharsetError) {
					// In languages that iconv can't handle, encoding the language name won't work. All of the labels, including the language name, must be native-encoded.
					// Note: The correctness of this error message hinges on the assumption that every language's name is representable in its own Macintosh character set. This is highly likely, but not actually guaranteed; language names come from the Unicode CLDR, which isn't restricted to characters present in the corresponding Macintosh character sets. Long story short, this shouldn't be a problem, but it's not impossible.
					throw new Error(`Labels for ${langs[0].englishName}, including the languageName label, must be provided with "charset":"native". Transcoding text from Unicode for this language is not supported.`);
				}
				else {
					errors.add(e);
					return;
				}
			}

			writeStr(languageName, Labels.descriptions.languageName);
		}}
	);

	errors.check();
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
		const pieceCount = pieces.length;

		if (pieceCount !== 5 && pieceCount !== 6) {
			throw new VError(
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
					data: pieces[index],
					encoding: spec.encoding
				}),
				{ includeLanguageName: pieceCount === 6 }
			);

			return packLabels(labels, langs, context);
		}
	}
};
