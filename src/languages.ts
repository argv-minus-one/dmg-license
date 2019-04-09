import bufferFrom = require("buffer-from");
import { Labels } from ".";
import Context from "./Context";
import { LicenseSpec } from "./spec";
import { arrayify } from "./util";

export interface Language {
	langTags: string[];
	encodings: string[];
	englishName: string;
	localizedName: string;
	labels?: Labels<string | Buffer>;
	regionCode: number;
}

export namespace Language {
	export function forSpec(spec: LicenseSpec, context?: Context): Language[] {
		const langs: Language[] = [];

		for (const specLang of arrayify(spec.lang)) {
			const lang =
				typeof specLang === "number"
				? byRegionCode[specLang]
				: byLocale[specLang.toLowerCase()];

			if (lang)
				langs.push(lang);
			else if (context && context.options.onNonFatalError) {
				context.options.onNonFatalError(
					new Error(`Unrecognized language: ${specLang}`)
				);
			}
		}

		if (langs.length)
			return langs;
		else
			throw new Error(`No known languages found for specification ${Array.isArray(spec.lang) ? `[${spec.lang.join(", ")}]` : spec.lang}.`);
	}
}

/** Known `Language`s, indexed by language tag. Indices are all lowercase. */
export const byLocale: {
	[langTag: string]: Language | undefined;
} = {};

/** Known `Language`s, indexed by classic Mac OS region code. This is a sparse array. */
export const byRegionCode: Array<Language | undefined> = [];

{
	// tslint:disable-next-line: no-var-requires
	const langJSON: any = require("./languages.json");

	const labelsByName: {
		[langTag: string]: Labels<string | Buffer> | undefined;
	} = {};

	for (const labelsName in langJSON.labels) {
		const rawLabels = langJSON.labels[labelsName];

		const labels = {} as Labels<string | Buffer>;

		const isBase64 = rawLabels.encoding === "native;base64";

		for (const labelName of Labels.keys) {
			labels[labelName] =
				isBase64
				? bufferFrom(rawLabels[labelName], "base64")
				: rawLabels[labelName];
		}

		labelsByName[labelsName] = labels;
	}

	for (const regionCodeStr in langJSON.locales) {
		const regionCode = Number(regionCodeStr);
		const rawLocale = langJSON.locales[regionCodeStr];
		const labels = labelsByName[rawLocale.labels];

		const entry: Language = {
			encodings: rawLocale.encodings,
			englishName: rawLocale.englishName,
			labels,
			langTags: rawLocale.langTags,
			localizedName: rawLocale.localizedName,
			regionCode
		};

		byRegionCode[entry.regionCode] = entry;
		for (const locale of entry.langTags)
			byLocale[locale.toLowerCase()] = entry;
	}
}
