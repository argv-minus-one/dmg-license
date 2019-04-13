import * as FS from "fs";
import readTSV from "./readTSV";

interface MacLanguage {
	id: number;
	langTags: string[];
	displayLangTag: string;
	doubleByteCharset: boolean;
	charsets: string[];
	labelsResourceID?: number;
}

async function MacLanguage(file: FS.PathLike): Promise<MacLanguage[]> {
	const languages: MacLanguage[] = [];
	const errors: Error[] = [];

	for await (const { cells, lineNum } of readTSV.withSkips(FS.createReadStream(file))) {
		const [, idStr, langTagList, displayLangTag, charsetList, , labelsResourceIDStr, doubleByteCharsetYN] = cells;

		if (!idStr || !langTagList || !displayLangTag || !charsetList) {
			errors.push(new Error(`[${file}:${lineNum}] This line is incomplete.`));
			continue;
		}

		const id = Number(idStr);
		if (!Number.isInteger(id) || id < 0) {
			errors.push(new Error(`[${file}:${lineNum}] ID should be a non-negative integer, but is “${idStr}”.`));
			continue;
		}

		const labelsResourceID = labelsResourceIDStr ? Number(labelsResourceIDStr) : undefined;

		if (labelsResourceID !== undefined && (!Number.isInteger(labelsResourceID) || labelsResourceID < 0)) {
			errors.push(new Error(`[${file}:${lineNum}] STR# resource ID should be blank or a non-negative integer, but is “${labelsResourceIDStr}”.`));
			continue;
		}

		languages.push({
			charsets: charsetList.split(","),
			displayLangTag,
			doubleByteCharset: doubleByteCharsetYN === "Y",
			id,
			labelsResourceID,
			langTags: langTagList.split(",")
		});
	}

	if (errors.length !== 0)
		throw errors.flat();

	return languages;
}

export default MacLanguage;
