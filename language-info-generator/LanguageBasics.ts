import * as FS from "fs";
import { ErrorBuffer } from "../src/util/errors";
import LanguageNames from "./LanguageNames";
import readTSV from "./readTSV";

interface LanguageBasics {
	id: number;
	langTags: string[];
	displayLangTag: string;
	doubleByteCharset: boolean;
	englishName: string;
	charsets: string[];
	labelsResourceID?: number;
	lineNum: number;
	localizedName: string;
}

async function LanguageBasics(file: FS.PathLike): Promise<LanguageBasics[]> {
	const languages: LanguageBasics[] = [];
	const langTagMap = new Map<string, Set<LanguageBasics>>();
	const errors = new ErrorBuffer();

	await errors.catchingAsync(LanguageNames(async queryDisplayName => {
	for await (const { cells, lineNum } of readTSV.withSkips(FS.createReadStream(file))) {
		const [, idStr, langTagList, displayLangTag, charsetList, , labelsResourceIDStr, doubleByteCharsetYN] = cells;

		if (!idStr || !displayLangTag || !charsetList) {
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

		const {englishName, localizedName} = await queryDisplayName(displayLangTag);

		const language: LanguageBasics = {
			charsets: charsetList.split(","),
			displayLangTag,
			doubleByteCharset: doubleByteCharsetYN === "Y",
			englishName,
			id,
			labelsResourceID,
			langTags: langTagList ? langTagList.split(",") : [],
			lineNum,
			localizedName
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
