import bufferFrom = require("buffer-from");
import { LicenseSpec } from ".";
import Context from "./Context";
import { Labels } from "./Labels";
import { arrayify } from "./util";

interface LabelsByName {
	[langTag: string]: Labels<string | Buffer> | undefined;
}

export class Language {
	langTags: string[];
	encodings: string[];
	englishName: string;
	localizedName: string;
	labels?: Labels<string | Buffer>;
	regionCode: number;

	constructor(
		regionCode: number,
		rawLocale: any,
		labelsByName: LabelsByName
	) {
		this.encodings = rawLocale.encodings;
		this.englishName = rawLocale.englishName;
		this.labels = labelsByName[rawLocale.labels];
		this.langTags = rawLocale.langTags;
		this.localizedName = rawLocale.localizedName;
		this.regionCode = regionCode;
	}

	toString() {
		return `${this.englishName} (region ${this.regionCode}; ${this.langTags.join(", ")})`;
	}
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
	const langJSON: any = require("../languages.json");

	const labelsByName: LabelsByName = {};

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
		const entry = new Language(
			Number(regionCodeStr),
			langJSON.locales[regionCodeStr],
			labelsByName
		);

		byRegionCode[entry.regionCode] = entry;
		for (const locale of entry.langTags)
			byLocale[locale.toLowerCase()] = entry;
	}
}
