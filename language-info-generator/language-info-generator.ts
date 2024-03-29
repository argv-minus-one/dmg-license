import { StringEncoding } from "iconv-corefoundation";
import { promisify } from "util";
import Labels from "../src/Labels";
import PromiseEach from "../src/util/PromiseEach";
import extractLabels, { LanguageLabelsMap, ResourceFileNotFoundError } from "./extractLabels";
import LanguageBasics from "./LanguageBasics";

async function main(resourcesFile: string, output: NodeJS.WritableStream, onNonFatalError: (error: Error) => void): Promise<void> {
	// Load everything in parallel.
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
				lookupCharset(languageID) {
					return StringEncoding.byIANACharSetName(languagesByLanguageID[languageID]!.charset);
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
	const [languages, labelMap] = await PromiseEach([
		languagesPromise,
		labelMapPromise
	]);

	// Assemble the output.
	const data: {
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
	} = {
		labels: {},
		languages: {}
	};

	const labelKeys = new Map<Labels.WithLanguageName, string>();

	function putLabels(labels: Labels.WithLanguageName, forLanguage: LanguageBasics): string {
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

		const { englishName, id, langTags, localizedName, charset } = language;

		data.languages[id] = {
			charset,
			doubleByteCharset: language.doubleByteCharset || undefined,
			englishName,
			labels: labelRef,
			langTags,
			localizedName
		};
	}

	// Done! Write the output.
	await promisify(output.write.bind(output))(JSON.stringify(data, null, 2));
}

main(
	process.env.SLAResources || "/Volumes/SLAs_for_UDIFs_1.0/SLAResources",
	process.stdout,
	e => console.warn(e.message)
).catch(e => {
	console.error(e);
	process.exitCode = process.exitCode || 1;
});
