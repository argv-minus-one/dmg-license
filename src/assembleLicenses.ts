import { crc32 } from "crc";
import { BodySpec, LicenseSpec, Localization, Options } from ".";
import Context from "./Context";
import Labels from "./Labels";
import Language, { indexByLanguage } from "./Language";
import { ErrorBuffer } from "./util/errors";
import PromiseEach from "./util/PromiseEach";

export interface AssembledLicense {
	body: {
		data: Buffer;
		type: "RTF " | "TEXT";
	};
	labels: Buffer;
	languageIDs: number[];
}

export interface AssembledLicenseSet {
	inOrder: AssembledLicense[];
	byLanguageID: Map<number, AssembledLicense>;
	defaultLanguageID: number;
}

function warnAboutLanguageIDCollisions(kind: string, errors: ErrorBuffer, context: Context) {
	return (languageIDs: Set<number>) => {
		const plural = languageIDs.size !== 1;
		context.warning(
			new Error(`More than one ${kind} was assigned to the language${plural ? "s" : ""} ${
				Array.from(languageIDs)
				.map(languageID => {
					const language = Language.byID[languageID]!;
					return `${language.englishName} (${language.langTags.join("; ")})`;
				})
				.join(", ")
			}. ${plural ? "In each case, t" : "T"}he first applicable ${kind} has been used.`),
			errors
		);
	};
}

function hashAssembledLicense(content: AssembledLicense): number {
	return [content.body.type, content.body.data, content.labels].reduce((hash, next) => crc32(next, hash), 0);
}

function assembledLicensesEqual(a: AssembledLicense, b: AssembledLicense): boolean {
	return a.body.type === b.body.type
		&& a.body.data.equals(b.body.data)
		&& a.labels.equals(b.labels);
}

async function assembleLoadedLicenses(
	bodies: Map<number, Promise<AssembledLicense["body"]>>,
	labelSets: (lang: Language) => Promise<Buffer>,
	errors: ErrorBuffer,
	context: Context
) {
	const assembled = new Map<number, AssembledLicense>();

	for (const [languageID, bodyPromise] of bodies) {
		try {
			const [body, labels] = await PromiseEach([
				bodyPromise,
				labelSets(Language.byID[languageID]!)
			]);

			assembled.set(languageID, {
				body,
				labels,
				languageIDs: [languageID]
			});
		}
		catch (e) {
			errors.add(e);
		}
	}

	const hashes = new Map<number, AssembledLicense[]>();

	for (const license of assembled.values()) {
		const hash = hashAssembledLicense(license);
		const withThisHash = hashes.get(hash);

		if (!withThisHash)
			hashes.set(hash, [license]);
		else {
			let hashCollision = true;

			for (const other of withThisHash)
			if (assembledLicensesEqual(license, other)) {
				hashCollision = false;
				other.languageIDs.push(...license.languageIDs);
				for (const languageID of license.languageIDs)
					assembled.set(languageID, other);
				break;
			}

			if (hashCollision)
				withThisHash.push(license);
		}
	}

	return assembled;
}

function chooseDefaultLanguageID(spec: LicenseSpec, outputs: AssembledLicense[], context: Context) {
	// Use the configured default language, if available.
	{
		const configuredDefaultLanguage = spec.defaultLang;

		switch (typeof configuredDefaultLanguage) {
			case "number":
				return configuredDefaultLanguage;

			case "string":
				const lookup = Language.bySpec(configuredDefaultLanguage, context)[0];
				if (lookup)
					return lookup.languageID;
		}
	}

	// Use the first language of the first license body section.
	for (const body of spec.body)
	for (const lang of Language.bySpec(body.lang))
		return lang.languageID;

	// Just pick one arbitrarily. This should never happen, but just in case.
	for (const output of outputs)
	for (const lang of output.languageIDs)
		return lang;
}

function labelCache(spec: LicenseSpec, errors: ErrorBuffer, context: Context) {
	const labelSpecs = indexByLanguage(
		function*() {
			const {labels, rawLabels} = spec;

			if (labels)
			for (const label of labels)
			yield label;

			if (rawLabels)
			for (const label of rawLabels)
			yield label;
		}(),
		{
			onCollisions: warnAboutLanguageIDCollisions("label set", errors, context)
		}
	);

	const preparedCache = new Map<number, Promise<Buffer>>();

	return (lang: Language) => {
		const {languageID} = lang;
		let result = preparedCache.get(languageID);
		if (!result) {
			result = Labels.prepareSpec(labelSpecs.get(languageID), lang, context);
			preparedCache.set(languageID, result);
		}
		return result;
	};
}

export default async function assembleLicenses(
	spec: LicenseSpec,
	optionsOrContext: Options | Context
): Promise<AssembledLicenseSet> {
	const context = optionsOrContext instanceof Context ? optionsOrContext : new Context(optionsOrContext);
	const errors = new ErrorBuffer();

	const labelSets = labelCache(spec, errors, context);

	const bodies = indexByLanguage(spec.body, {
		map: (body: BodySpec, lang: Language) => BodySpec.prepare(body, lang, context),
		onCollisions: warnAboutLanguageIDCollisions("license body", errors, context)
	});

	if (!bodies.size)
		errors.throw(new Error("No license bodies were provided."));

	let result: AssembledLicenseSet;

	try {
		const assembled = await assembleLoadedLicenses(bodies, labelSets, errors, context);
		const inOrder = Array.from(assembled.values());
		const defaultLanguageID = chooseDefaultLanguageID(spec, inOrder, context)!;

		result = {
			byLanguageID: assembled,
			defaultLanguageID,
			inOrder
		};
	}
	catch (e) {
		errors.add(e);
	}

	errors.check();
	return result!;
}
