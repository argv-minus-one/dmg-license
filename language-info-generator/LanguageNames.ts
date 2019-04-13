import * as FS from "fs";
import { ErrorBuffer } from "../src/util/errors";
import readTSV from "./readTSV";

type LanguageNames = Map<string, {
	englishName: string
	localizedName: string
}>;

async function LanguageNames(file: string): Promise<LanguageNames> {
	const result: LanguageNames = new Map();
	const errors = new ErrorBuffer();

	for await (const { lineNum, cells } of readTSV(FS.createReadStream(file))) {
		if (cells.length < 3) {
			errors.add(new Error(`${file} line ${lineNum}: Row does not have at least three columns.`));
			continue;
		}

		if (errors.errors.length) {
			// If errors have been encountered, just look for more errors before bailing.
			continue;
		}

		const [tag, englishName, localizedName] = cells;
		result.set(tag, { englishName, localizedName });
	}

	errors.check();
	return result;
}

export default LanguageNames;
