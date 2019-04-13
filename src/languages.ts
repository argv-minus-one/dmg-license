import bufferFrom = require("buffer-from");
import { LicenseSpec } from ".";
import Context from "./Context";
import { Labels, LanguageInfoLabels, NativeEncodedLabels } from "./Labels";
import { Language, RawLanguageInfo } from "./Language";
import { arrayify } from "./util";

export interface LabelsByName {
	[langTag: string]: Labels<string | Buffer> | undefined;
}

/** Known `Language`s, indexed by language tag. Indices are all lowercase. */
export const byLanguage: {
	[langTag: string]: Language | undefined;
} = {};

/** Known `Language`s, indexed by classic Mac OS language ID. This is a sparse array. */
export const byLanguageID: Array<Language | undefined> = [];

export function bySpec(spec: LicenseSpec, context?: Context): Language[] {
	const langs: Language[] = [];
	for (const specLang of arrayify(spec.lang)) {
		const lang = typeof specLang === "number"
			? byLanguageID[specLang]
			: byLanguage[specLang.toLowerCase()];
		if (lang)
			langs.push(lang);
		else if (context && context.options.onNonFatalError) {
			context.options.onNonFatalError(new Error(`Unrecognized language: ${specLang}`));
		}
	}
	if (langs.length)
		return langs;
	else
		throw new Error(`No known languages found for specification ${Array.isArray(spec.lang) ? `[${spec.lang.join(", ")}]` : spec.lang}.`);
}

{
	// tslint:disable-next-line: no-var-requires
	const langJSON: RawLanguageInfo = require("../language-info.json");

	const labelsByName: LabelsByName = {};

	for (const labelsName in langJSON.labels) {
		const rawLabels: LanguageInfoLabels = langJSON.labels[labelsName]!;
		const isBase64 = (rawLabels as NativeEncodedLabels).charset === "native;base64";

		labelsByName[labelsName] = Labels.map(rawLabels, label =>
			isBase64
			? bufferFrom(label, "base64")
			: label
		);
	}

	for (const languageIDStr in langJSON.languages) {
		const entry = new Language(
			Number(languageIDStr),
			langJSON.languages[languageIDStr]!,
			labelsByName
		);

		byLanguageID[entry.languageID] = entry;
		for (const language of entry.langTags)
			byLanguage[language.toLowerCase()] = entry;
	}
}
