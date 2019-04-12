import { promisify } from "util";
import PromiseEach from "../src/util/PromiseEach";
import LanguageNames from "./LanguageNames";
import LicenseLabels, { LicenseLabelMap, ResourceFileNotFoundError } from "./LicenseLabels";
import MacLocale from "./MacLocale";

interface LicenseLocale {
	labels?: keyof LicenseLanguageData["labels"];
	langTags: string[];
	encodings: string[];
	englishName: string;
	localizedName: string;
	doubleByteCharset?: boolean;
}

interface LicenseLanguageData {
	locales: {
		[id: number]: LicenseLocale | undefined;
	};
	labels: {
		[name: string]: LicenseLabels.Stringified | undefined;
	};
}

async function main(resourcesFile: string, output: NodeJS.WritableStream, onNonFatalError: (error: Error) => void): Promise<void> {
	// Load everything in parallel.
	const languageNamesPromise = LanguageNames(require.resolve("./Language names.tsv"));

	const localesPromise = MacLocale(require.resolve("./Locales.tsv"));

	const labelMapPromise: Promise<LicenseLabelMap> = (async () => {
		if (!resourcesFile)
			return new Map();

		const regionCodesByResourceID: Array<number | undefined> = [];
		const localesByRegionCode: Array<MacLocale | undefined> = [];

		for (const locale of await localesPromise) {
			localesByRegionCode[locale.id] = locale;
			if (locale.labelsResourceID !== undefined) {
				regionCodesByResourceID[locale.labelsResourceID] = locale.id;
			}
		}

		try {
			return await LicenseLabels({
				lookupRegionCode(resourceID) {
					const regionCode = regionCodesByResourceID[resourceID];
					return regionCode === undefined ? null : regionCode;
				},
				lookupEncodings(regionCode) {
					const locale = localesByRegionCode[regionCode];
					return locale ? locale.encodings : [];
				},
				onWrongEncoding(error) {
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
	const [languageNames, locales, labelMap] = await PromiseEach([
		languageNamesPromise,
		localesPromise,
		labelMapPromise
	]);

	// Assemble the output.
	const data: LicenseLanguageData = {
		labels: {},
		locales: {}
	};

	type LabelKey = keyof typeof data.labels;

	const labelKeys = new Map<LicenseLabels, LabelKey>();

	function putLabels(labels: LicenseLabels, forLocale: MacLocale): LabelKey {
		{
			const key = labelKeys.get(labels);
			if (key !== undefined) {
				return key;
			}
		}

		const labelsRepr = LicenseLabels.stringify(labels);

		function setKeyTo(key: LabelKey): typeof key {
			data.labels[key] = labelsRepr;
			labelKeys.set(labels, key);
			return key;
		}

		for (const potentialKey of [forLocale.displayLangTag, ...forLocale.langTags])
		if (!(potentialKey in data.labels))
			return setKeyTo(potentialKey);

		for (let potentialKeyNum = 2; ; potentialKeyNum++) {
			const potentialKey = `${forLocale.displayLangTag}-${potentialKeyNum}`;

			if (!(potentialKey in data.labels))
				return setKeyTo(potentialKey);
		}
	}

	for (const locale of locales) {
		const label = labelMap.get(locale.id);
		const labelRef = label ? putLabels(label, locale) : undefined;

		const name = languageNames.get(locale.displayLangTag);
		if (!name) {
			throw new Error(`No entry in Language names.tsv for locale ${locale.displayLangTag}.`);
		}

		const { id, langTags, encodings } = locale;

		data.locales[id] = {
			encodings,
			labels: labelRef,
			langTags,
			...name,
			doubleByteCharset: locale.doubleByteCharset || undefined
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
