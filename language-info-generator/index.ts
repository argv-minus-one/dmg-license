import { promisify } from "util";
import { LanguageInfoLabels } from "../src/Labels";
import { RawLanguageInfo } from "../src/Language";
import PromiseEach from "../src/util/PromiseEach";
import extractLabels, { LanguageLabelsMap, ResourceFileNotFoundError } from "./extractLabels";
import LanguageBasics from "./LanguageBasics";
import LanguageNames from "./LanguageNames";

async function main(resourcesFile: string, output: NodeJS.WritableStream, onNonFatalError: (error: Error) => void): Promise<void> {
	// Load everything in parallel.
	const languageNamesPromise = LanguageNames(require.resolve("./Language names.tsv"));

	const languagesPromise = LanguageBasics(require.resolve("./Languages.tsv"));

	const labelMapPromise: Promise<LanguageLabelsMap> = (async () => {
		if (!resourcesFile)
			return new Map();

		const languageIDsByResourceID: Array<number | undefined> = [];
		const languagesByLanguageID: Array<LanguageBasics | undefined> = [];

		for (const language of await languagesPromise) {
			languagesByLanguageID[language.id] = language;
			if (language.labelsResourceID !== undefined) {
				languageIDsByResourceID[language.labelsResourceID] = language.id;
			}
		}

		try {
			return await extractLabels({
				lookupLanguageID(resourceID) {
					const languageID = languageIDsByResourceID[resourceID];
					return languageID === undefined ? null : languageID;
				},
				lookupCharsets(languageID) {
					const language = languagesByLanguageID[languageID];
					return language ? language.charsets : [];
				},
				onWrongCharset(error) {
					onNonFatalError(error);
				},
				onDecodingFailure(error, rawLabels) {
					onNonFatalError(error);
					return rawLabels;
				},
				resourcesFile
			});
		}
		catch (e) {
			if (e instanceof ResourceFileNotFoundError) {
				if (onNonFatalError) onNonFatalError(e);
				return new Map();
			}
			else
				throw e;
		}
	})();

	// Now wait for everything to get loaded.
	const [languageNames, languages, labelMap] = await PromiseEach([
		languageNamesPromise,
		languagesPromise,
		labelMapPromise
	]);

	// Assemble the output.
	const data: RawLanguageInfo = {
		labels: {},
		languages: {}
	};

	const labelKeys = new Map<LanguageInfoLabels, string>();

	function putLabels(labels: LanguageInfoLabels, forLanguage: LanguageBasics): string {
		{
			const key = labelKeys.get(labels);
			if (key !== undefined) {
				return key;
			}
		}

		function setKeyTo(key: string): typeof key {
			data.labels[key] = labels;
			labelKeys.set(labels, key);
			return key;
		}

		for (const potentialKey of [forLanguage.displayLangTag, ...forLanguage.langTags])
		if (!(potentialKey in data.labels))
			return setKeyTo(potentialKey);

		for (let potentialKeyNum = 2; ; potentialKeyNum++) {
			const potentialKey = `${forLanguage.displayLangTag}-${potentialKeyNum}`;

			if (!(potentialKey in data.labels))
				return setKeyTo(potentialKey);
		}
	}

	for (const language of languages) {
		const label = labelMap.get(language.id);
		const labelRef = label ? putLabels(label, language) : undefined;

		const name = languageNames.get(language.displayLangTag);
		if (!name) {
			throw new Error(`No entry in Language names.tsv for language ${language.displayLangTag}.`);
		}

		const { id, langTags, charsets } = language;

		data.languages[id] = {
			charsets,
			labels: labelRef,
			langTags,
			...name,
			doubleByteCharset: language.doubleByteCharset || undefined
		};
	}

	// Done! Write the output.
	await promisify(output.write.bind(output))(JSON.stringify(data, null, 2));
}

// tslint:disable: no-console

main(
	process.env.SLAResources || "/Volumes/SLAs_for_UDIFs_1.0/SLAResources",
	process.stdout,
	e => console.warn(e.message)
).catch(e => {
	console.error(e);
	process.exitCode = process.exitCode || 1;
});
