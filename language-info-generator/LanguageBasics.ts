import * as FS from "fs";
import { encodingExists } from "iconv-corefoundation";
import { ErrorBuffer } from "../src/util/errors";
import LanguageNames from "./LanguageNames";
import readTSV from "./readTSV";

interface LanguageBasics {
	id: number;
	langTags: string[];
	displayLangTag: string;
	doubleByteCharset: boolean;
	englishName: string;
	charset: string;
	labelsResourceID?: number;
	lineNum: number;
	localizedName: string;
}

interface LanguageNameOverride {
	englishName?: string;
	localizedName?: string;
}

async function readLanguageNameOverrides(errors: ErrorBuffer): Promise<Map<number, LanguageNameOverride>> {
	const file = require.resolve("./Language name overrides.tsv");
	const map = new Map<number, LanguageNameOverride>();

	for await (const {lineNum, cells: [languageIDString, englishName, localizedName]} of readTSV.withSkips(FS.createReadStream(file))) {
		if (!languageIDString) {
			errors.add(new Error(`[${file}:${lineNum}] This line is missing the language ID column.`));
			continue;
		}

		const languageID = Number(languageIDString);
		if (!Number.isInteger(languageID) || languageID < 0) {
			errors.add(new Error(`[${file}:${lineNum}] Invalid language ID “${languageIDString}”.`));
			continue;
		}

		if (!englishName && !localizedName) {
			errors.add(new Error(`[${file}:${lineNum}] This line has a language tag, but no name overrides.`));
			continue;
		}

		if (map.has(languageID)) {
			errors.add(new Error(`[${file}:${lineNum}] Duplicate language ID “${languageIDString}”.`));
			continue;
		}

		map.set(languageID, {
			englishName: englishName || undefined,
			localizedName: localizedName || undefined
		});
	}

	return map;
}

async function LanguageBasics(file: FS.PathLike): Promise<LanguageBasics[]> {
	const languages: LanguageBasics[] = [];
	const langTagMap = new Map<string, Set<LanguageBasics>>();
	const errors = new ErrorBuffer();
	const nameOverrides = readLanguageNameOverrides(errors);

	await errors.catchingAsync(LanguageNames(async queryDisplayName => {
	for await (const { cells, lineNum } of readTSV.withSkips(FS.createReadStream(file))) {
		const [, idStr, langTagList, displayLangTag, charset, , labelsResourceIDStr, doubleByteCharsetYN] = cells;

		if (!idStr || !displayLangTag || !charset) {
			errors.add(new Error(`[${file}:${lineNum}] This line is incomplete.`));
			continue;
		}

		const id = Number(idStr);
		if (!Number.isInteger(id) || id < 0) {
			errors.add(new Error(`[${file}:${lineNum}] ID should be a non-negative integer, but is “${idStr}”.`));
			continue;
		}

		const labelsResourceID = labelsResourceIDStr ? Number(labelsResourceIDStr) : undefined;

		if (labelsResourceID !== undefined && (!Number.isInteger(labelsResourceID) || labelsResourceID < 0)) {
			errors.add(new Error(`[${file}:${lineNum}] STR# resource ID should be blank or a non-negative integer, but is “${labelsResourceIDStr}”.`));
			continue;
		}

		const nameOverride = (await nameOverrides).get(id) || {};

		// Only query for display names if at least one of the display names isn't overridden.
		const displayNames = (nameOverride.englishName && nameOverride.localizedName) ? null : await queryDisplayName(displayLangTag);

		if (!encodingExists(charset))
			errors.add(new Error(`[${file}:${lineNum}] Invalid or unsupported character set “${charset}”.`));

		const language: LanguageBasics = {
			charset,
			displayLangTag,
			doubleByteCharset: doubleByteCharsetYN === "Y",
			englishName: nameOverride.englishName || displayNames!.englishName,
			id,
			labelsResourceID,
			langTags: langTagList ? langTagList.split(",") : [],
			lineNum,
			localizedName: nameOverride.localizedName || displayNames!.localizedName
		};
		languages.push(language);

		for (const langTag of language.langTags) {
			let languagesForTag = langTagMap.get(langTag);

			if (!languagesForTag) {
				languagesForTag = new Set();
				langTagMap.set(langTag, languagesForTag);
			}

			languagesForTag.add(language);
		}
	}
	}));

	// Look for collisions.
	for (const [langTag, languagesForTag] of langTagMap.entries())
	if (languagesForTag && languagesForTag.size > 1) {
		const languagesForTagArray = Array.from(languagesForTag);
		errors.add(new Error(`[${file}:${languagesForTagArray.map(l => l.lineNum).join(",")}] The language tag “${langTag}” is shared by languages ${languagesForTagArray.map(l => l.id).join(", ")}. Each language tag should occur only once.`));
	}

	errors.check();
	return languages;
}

export default LanguageBasics;
