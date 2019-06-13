import { crc32 } from "crc";
import { BodySpec, LabelsSpec, LicenseSpec, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import Language from "./Language";
import * as languages from "./languages";
import loadLabels from "./loadLabels";
import { readFileP } from "./util";
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

/**
 * Loads the license body text for the given `LicenseSpec`.
 *
 * @param lang - Language to encode text for.
 */
async function loadBody(
	spec: BodySpec,
	context: Context,
	lang: Language
): Promise<AssembledLicense["body"]> {
	const fpath = spec.file && context.resolvePath(spec.file);

	return {
		data: CodedString.encode(
			fpath ?
			{
				charset: spec.charset || "UTF-8",
				encoding: spec.encoding,
				text: await readFileP(fpath)
			} :
			{
				charset: spec.charset!,
				encoding: spec.encoding!,
				text: spec.text!
			},
			lang
		),
		type:
			spec.type ? (
				spec.type === "rtf" ?
				"RTF " :
				"TEXT"
			) :
			fpath ? (
				fpath.endsWith(".rtf") ?
				"RTF " :
				"TEXT"
			) :
			"TEXT"
	};
}

function loadAll<S, R>(_: {
	context: Context;
	specs: S[];
	getLangs(s: S): Language[];
	load(spec: S, context: Context, lang: Language): Promise<R>;
	onCollisions?(languageIDs: Set<number>): void;
}): Map<number, Promise<R>> {
	const map = new Map<number, Promise<R>>();
	const {onCollisions} = _;
	const collisionTracking = onCollisions && { seen: new Set<number>(), collisions: new Set<number>() };

	for (const spec of _.specs)
	for (const lang of _.getLangs(spec)) {
		if (collisionTracking)
			(collisionTracking.seen.has(lang.languageID) ? collisionTracking.collisions : collisionTracking.seen).add(lang.languageID);

		map.set(lang.languageID, _.load(spec, _.context, lang));
	}

	if (collisionTracking && collisionTracking.collisions.size)
		onCollisions!(collisionTracking.collisions);

	return map;
}

function warnAboutLanguageIDCollisions(kind: string, errors: ErrorBuffer, context: Context) {
	return function warnAboutLanguageIDCollisions(languageIDs: Set<number>) {
		context.warning(
			new Error(`More than one ${kind} was assigned to the language(s) ${
				Array.from(languageIDs)
				.map(languageID => {
					const language = languages.byLanguageID[languageID]!;
					return `${language.englishName} (${language.langTags.join("; ")})`;
				})
				.join(", ")
			}.`),
			errors
		);
	};
}

function getLangs(kind: string, errors: ErrorBuffer, context: Context) {
	let warningIssued = false;
	return function getLangs(spec: BodySpec | LabelsSpec) {
		const langs = languages.bySpec(spec.lang);
		if (!langs && !warningIssued) {
			warningIssued = true;
			context.warning(new Error(`One or more license ${kind} sections has an empty “lang” property.`), errors);
		}
		return langs;
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
	customLabelSets: Map<number, Promise<Buffer>>,
	errors: ErrorBuffer,
	context: Context
) {
	const assembled = new Map<number, AssembledLicense>();

	for (const [languageID, bodyPromise] of bodies) {
		try {
			const lang = languages.byLanguageID[languageID]!;

			const [body, labels] = await PromiseEach([
				bodyPromise,
				customLabelSets.get(languageID) || loadLabels(null, context, lang)
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

	if (!assembled.size)
		throw new Error("No license specifications were provided.");

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
				const lookup = languages.bySpec(configuredDefaultLanguage, context)[0];
				if (lookup)
					return lookup.languageID;
		}
	}

	// Use the first language of the first license body section.
	for (const body of spec.body)
	for (const lang of languages.bySpec(body.lang))
		return lang.languageID;

	// Just pick one arbitrarily. This should never happen, but just in case.
	for (const output of outputs)
	for (const lang of output.languageIDs)
		return lang;
}

export interface AssembledLicenseSet {
	inOrder: AssembledLicense[];
	byLanguageID: Map<number, AssembledLicense>;
	defaultLanguageID: number;
}

export async function assembleLicenses(
	spec: LicenseSpec,
	optionsOrContext: Options | Context
): Promise<AssembledLicenseSet> {
	const context = optionsOrContext instanceof Context ? optionsOrContext : new Context(optionsOrContext);
	const errors = new ErrorBuffer();

	const bodies = loadAll({
		context,
		getLangs: getLangs("body", errors, context),
		load: loadBody,
		onCollisions: warnAboutLanguageIDCollisions("license body", errors, context),
		specs: spec.body
	});

	const customLabelSets = loadAll<LabelsSpec, Buffer>({
		context,
		getLangs: getLangs("labels", errors, context),
		load: loadLabels,
		onCollisions: warnAboutLanguageIDCollisions("label set", errors, context),
		specs: spec.labels || []
	});

	const finishedLoadingEverything = Promise.all(Array.from((function*() {
		for (const p of bodies.values())
			yield errors.catchingAsync(p as Promise<unknown>);
		for (const p of customLabelSets.values())
			yield errors.catchingAsync(p as Promise<unknown>);
	})()));

	let result: AssembledLicenseSet;

	try {
		const assembled = await assembleLoadedLicenses(bodies, customLabelSets, errors, context);
		const inOrder = Array.from(assembled.values());
		const defaultLanguageID = chooseDefaultLanguageID(spec, inOrder, context)!;

		result = {
			byLanguageID: assembled,
			defaultLanguageID,
			inOrder
		};
	}
	catch (e) {
		await finishedLoadingEverything;
		errors.throw(e);
	}

	await finishedLoadingEverything;
	errors.check();
	return result!;
}
