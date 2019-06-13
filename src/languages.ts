import { StringEncoding, UnrecognizedEncodingError } from "iconv-corefoundation";
import Context from "./Context";
import { Labels } from "./Labels";
import { Language, RawLanguageInfo } from "./Language";
import { arrayify } from "./util";

export interface LabelsByName {
	[langTag: string]: Labels | undefined;
}

/** Known `Language`s, indexed by language tag. Indices are all lowercase. */
export const byLanguage: {
	[langTag: string]: Language | undefined;
} = {};

/** Known `Language`s, indexed by classic Mac OS language ID. This is a sparse array. */
export const byLanguageID: Array<Language | undefined> = [];

export function bySpec(lang: string | number | Array<string | number>, context?: Context): Language[] {
	const langs: Language[] = [];
	for (const specLang of arrayify(lang)) {
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
		throw new Error(`No known languages found for specification ${Array.isArray(lang) ? `[${lang.join(", ")}]` : lang}.`);
}

{
	// tslint:disable-next-line: no-var-requires
	const langJSON: RawLanguageInfo = require("../language-info.json");

	const labelsByName: LabelsByName = {};

	for (const labelsName in langJSON.labels)
		labelsByName[labelsName] = langJSON.labels[labelsName]!;

	const charsetCache = new Map<string, StringEncoding | UnrecognizedEncodingError>();

	for (const languageIDStr in langJSON.languages) {
		const entry = new Language(
			Number(languageIDStr),
			langJSON.languages[languageIDStr]!,
			labelsByName,
			charsetCache
		);

		byLanguageID[entry.languageID] = entry;
		for (const language of entry.langTags)
			byLanguage[language.toLowerCase()] = entry;
	}
}
