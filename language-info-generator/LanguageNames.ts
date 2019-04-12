import * as FS from "fs";
import readTSV from "./readTSV";

type LanguageNames = Map<string, {
	englishName: string
	localizedName: string
}>;

async function LanguageNames(file: string = require.resolve("../Language names.tsv")): Promise<LanguageNames> {
	const result: LanguageNames = new Map();
	const errors: Error[] = [];

	for await (const { lineNum, cells } of readTSV(FS.createReadStream(file))) {
		if (cells.length < 3) {
			errors.push(new Error(`${file} line ${lineNum}: Row does not have at least three columns.`));
			continue;
		}

		if (errors.length) {
			// If errors have been encountered, just look for more errors before bailing.
			continue;
		}

		const [tag, englishName, localizedName] = cells;
		result.set(tag, { englishName, localizedName });
	}

	if (errors.length !== 0)
		throw errors.flat();
	else
		return result;
}

export default LanguageNames;
