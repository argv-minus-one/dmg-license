import * as FS from "fs";
import { StringEncoding } from "iconv-corefoundation";
import * as Path from "path";
import Context from "./Context";
import Labels from "./Labels";
import { arrayify } from "./util";

export class NoSuchLanguageError extends Error {
	constructor(public lang: LangSpecs) {
		super(`No known languages found for specification ${Array.isArray(lang) ? `[${lang.join(", ")}]` : lang}.`);
	}
}
NoSuchLanguageError.prototype.name = NoSuchLanguageError.name;

export abstract class Language {
	static byTag: {
		[langTag: string]: Language | undefined;
	} = {};

	static byID: Array<Language | undefined> = [];

	static add(lang: Language): void {
		Language.byID[lang.languageID] = lang;
		for (const tag of lang.langTags)
			Language.byTag[tag.toLowerCase()] = lang;
	}

	static bySpec(lang: LangSpecs, context?: Context): Language[] {
		const langs: Language[] = [];

		for (const specLang of arrayify(lang)) {
			const lang = typeof specLang === "number"
				? Language.byID[specLang]
				: Language.byTag[specLang.toLowerCase()];

			if (lang)
				langs.push(lang);
			else if (context && context.canWarn)
				context.warning(new NoSuchLanguageError(specLang));
		}

		if (langs.length)
			return langs;
		else
			throw new NoSuchLanguageError(lang);
	}

	abstract charset: StringEncoding;
	abstract doubleByteCharset: boolean;
	abstract englishName: string;
	abstract labels?: Labels;
	abstract languageID: number;
	abstract langTags: string[];
	abstract localizedName: string;

	toString() {
		return `${this.englishName} (language ${this.languageID}${this.langTags.length === 0 ? "" : `; ${this.langTags.join(", ")}`})`;
	}
}
export default Language;

{
	const langJSON: {
		labels: {
			[name: string]: Labels.WithLanguageName | undefined;
		};

		languages: {
			[id: string]: {
				charset: string;
				labels?: string;
				langTags: string[];
				englishName: string;
				localizedName: string;
				doubleByteCharset?: boolean;
			} | undefined;
		};
	} = JSON.parse(FS.readFileSync(Path.resolve(__dirname, "..", "language-info.json"), {encoding: "utf8"}));

	const labelsByName: {
		[langTag: string]: Labels | undefined;
	} = {};

	for (const labelsName in langJSON.labels)
		labelsByName[labelsName] = langJSON.labels[labelsName]!;

	const charsetCache = new Map<string, StringEncoding>();

	for (const idStr in langJSON.languages) {
		const rawLang = langJSON.languages[idStr]!;

		const entry = new class extends Language {
			charset = (() => {
				let charset = charsetCache.get(rawLang.charset);
				if (!charset) {
					charset = StringEncoding.byIANACharSetName(rawLang.charset);
					charsetCache.set(rawLang.charset, charset);
				}
				return charset;
			})();

			doubleByteCharset = rawLang.doubleByteCharset || false;
			englishName = rawLang.englishName;
			labels = rawLang.labels ? labelsByName[rawLang.labels] : undefined;
			languageID = Number(idStr);
			langTags = rawLang.langTags;
			localizedName = rawLang.localizedName;
		}();

		Language.add(entry);
	}
}

export type LangSpec = string | number;
export type LangSpecs = LangSpec | LangSpec[];

export interface Localization {
	lang: LangSpecs;
}

namespace indexByLanguage {
	export interface Options<T, U> {
		filter?(object: T): boolean;
		map?(object: T, lang: Language): U | undefined;
		onCollisions?(languageIDs: Set<number>): void;
	}
}

function indexByLanguage<T extends Localization>(
	objects: Iterable<T>,
	options?: indexByLanguage.Options<T, T> & {
		map?: never;
	}
): Map<number, T>;

function indexByLanguage<T extends Localization, U>(
	objects: Iterable<T>,
	options: indexByLanguage.Options<T, U> & {
		map(object: T, lang: Language): U;
	}
): Map<number, Exclude<U, undefined>>;

function indexByLanguage<T extends Localization>(
	objects: Iterable<T>,
	{filter, map, onCollisions}: indexByLanguage.Options<T, unknown> = {}
): Map<number, unknown> {
	const result = new Map<number, unknown>();
	const seen = new Set<number>();
	const collisions = onCollisions && new Set<number>();

	for (const object of objects)
	if (!filter || filter(object))
	for (const lang of Language.bySpec(object.lang)) {
		const {languageID} = lang;
		if (seen.has(languageID)) {
			if (collisions)
				collisions.add(languageID);
		}
		else {
			seen.add(languageID);

			const mapped = map ? map(object, lang) : object;
			if (mapped !== undefined)
				result.set(lang.languageID, mapped);
		}
	}

	if (collisions && collisions.size)
		onCollisions!(collisions);

	return result;
}

export { indexByLanguage };
