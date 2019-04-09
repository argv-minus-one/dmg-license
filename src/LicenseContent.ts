import { Labels, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import * as languages from "./languages";
import { Language } from "./languages";
import { LicenseSpec } from "./spec";
import { readFileP } from "./util";
import { ErrorBuffer } from "./util/errors";
import PromiseEach from "./util/PromiseEach";

interface LicenseContent extends Map<number, {
	body: {
		data: Buffer;
		type: LicenseContent.BodyType;
	};
	labels: Buffer;
	regionCodes: number[];
}> {
	defaultRegionCode: number;
}

namespace LicenseContent {
	export type BodyType = "RTF " | "TEXT";

	/**
	 * Loads the license body text for the given `LicenseSpec`.
	 *
	 * @param langs - Languages that `spec` applies to.
	 */
	async function loadBody(
		spec: LicenseSpec,
		langs: Language[],
		context: Context
	): Promise<{ data: Buffer, type: BodyType }> {
		return {
			data: CodedString.encode(
				spec.body.file ?
				{
					charset: spec.body.charset || "UTF-8",
					data: await readFileP(spec.body.file),
					encoding: spec.body.encoding
				} :
				{
					charset: spec.body.charset!,
					data: spec.body.text!,
					encoding: spec.body.encoding!
				},
				langs,
				context
			),
			type:
				spec.body.type ? (
					spec.body.type === "rtf" ?
					"RTF " :
					"TEXT"
				) :
				spec.body.file ? (
					spec.body.file.endsWith(".rtf") ?
					"RTF " :
					"TEXT"
				) :
				"TEXT"
		};
	}

	export async function load(
		specs: LicenseSpec[],
		optionsOrContext: Options | Context
	): Promise<LicenseContent> {
		const context = optionsOrContext instanceof Context ? optionsOrContext : new Context(optionsOrContext);

		const contents = await PromiseEach(specs.map(async spec => {
			const langs = Language.forSpec(spec);

			const [body, labels] = await PromiseEach([
				loadBody(spec, langs, context),
				Labels.load(spec, context, langs)
			]);

			return {
				body,
				labels,
				langs,
				regionCodes: langs.map(lang => lang.regionCode),
				spec
			};
		}));

		if (!contents.length)
			throw new Error("No license specifications were provided.");

		const ret: LicenseContent = Object.assign(new Map(), { defaultRegionCode: NaN });
		const langCollisions = new Set<Language>();
		const defaultLangs = new Set<Language>();

		for (const [index, content] of contents.entries()) {
			for (const lang of content.langs) {
				const {regionCode} = lang;

				if (ret.has(regionCode))
					langCollisions.add(lang);
				else
					ret.set(regionCode, content);
			}

			if (content.spec.default) {
				content.langs.forEach(defaultLangs.add.bind(defaultLangs));

				if (isNaN(ret.defaultRegionCode))
					ret.defaultRegionCode = content.langs[0].regionCode;
			}
		}

		const errors = new ErrorBuffer();

		if (langCollisions.size) {
			context.warning(
				new Error(`More than one license body was assigned to the language(s) ${
					Array.from(langCollisions).join(", ")
				}.`),
				errors
			);
		}

		if (isNaN(ret.defaultRegionCode))
			ret.defaultRegionCode = contents[0].langs[0].regionCode;
		else if (defaultLangs.size > 1) {
			context.warning(
				new Error(`More than one language was designated as the default. Choosing ${
					languages.byRegionCode[ret.defaultRegionCode]
				}. Choices were ${
					Array.from(defaultLangs).join(", ")
				}.`),
				errors
			);
		}

		errors.check();
		return ret;
	}
}

export default LicenseContent;
