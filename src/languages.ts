import bufferFrom = require("buffer-from");
import { LicenseSpec } from ".";
import Context from "./Context";
import { Labels, LanguageInfoLabels, NativeEncodedLabels } from "./Labels";
import { arrayify } from "./util";

interface LabelsByName {
	[langTag: string]: Labels<string | Buffer> | undefined;
}

export class Language {
	langTags: string[];
	doubleByteCharset: boolean;
	charsets: string[];
	englishName: string;
	localizedName: string;
	labels?: Labels<string | Buffer>;
	languageID: number;

	constructor(
		languageID: number,
		rawLocale: any,
		labelsByName: LabelsByName
	) {
		this.doubleByteCharset = rawLocale.doubleByteCharset || false;
		this.charsets = rawLocale.charsets;
		this.englishName = rawLocale.englishName;
		this.labels = labelsByName[rawLocale.labels];
		this.langTags = rawLocale.langTags;
		this.localizedName = rawLocale.localizedName;
		this.languageID = languageID;
	}

	toString() {
		return `${this.englishName} (language ${this.languageID}; ${this.langTags.join(", ")})`;
	}
}

export namespace Language {
	export function forSpec(spec: LicenseSpec, context?: Context): Language[] {
		const langs: Language[] = [];

		for (const specLang of arrayify(spec.lang)) {
			const lang =
				typeof specLang === "number"
				? byLanguageID[specLang]
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

/** Known `Language`s, indexed by classic Mac OS language ID. This is a sparse array. */
export const byLanguageID: Array<Language | undefined> = [];

{
	// tslint:disable-next-line: no-var-requires
	const langJSON: any = require("../language-info.json");

	const labelsByName: LabelsByName = {};

	for (const labelsName in langJSON.labels) {
		const rawLabels: LanguageInfoLabels = langJSON.labels[labelsName];
		const isBase64 = (rawLabels as NativeEncodedLabels).charset === "native;base64";

		labelsByName[labelsName] = Labels.map(rawLabels, label =>
			isBase64
			? bufferFrom(label, "base64")
			: label
		);
	}

	for (const languageIDStr in langJSON.locales) {
		const entry = new Language(
			Number(languageIDStr),
			langJSON.locales[languageIDStr],
			labelsByName
		);

		byLanguageID[entry.languageID] = entry;
		for (const locale of entry.langTags)
			byLocale[locale.toLowerCase()] = entry;
	}
}
