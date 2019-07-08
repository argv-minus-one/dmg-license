import { SmartBuffer } from "smart-buffer";
import { Options } from ".";
import Context from "./Context";
import Language, { Localization } from "./Language";
import { readFileP } from "./util";
import { ErrorBuffer } from "./util/errors";
import { PrettyVError } from "./util/format-verror";
import PromiseEach from "./util/PromiseEach";

const { freeze } = Object;

export class NoDefaultLabelsError extends Error {
	constructor(public readonly lang: Language, message?: string) {
		super(message || `There are no default labels for ${lang.englishName}. You must provide your own labels for this language.`);
	}
}
NoDefaultLabelsError.prototype.name = NoDefaultLabelsError.name;

export class LabelEncodingError extends PrettyVError {
	text?: Buffer;

	constructor(labelDescription: string, lang: Language, cause?: Error | string, ...params: unknown[]) {
		super(
			{cause: typeof cause === "string" ? undefined : cause},
			`Cannot encode %s for %s${typeof cause === "string" ? "%s" : cause ? "" : "."}`,
			labelDescription,
			lang.englishName,
			typeof cause === "string" ? cause : undefined,
			...params
		);
	}
}
LabelEncodingError.prototype.name = LabelEncodingError.name;

export interface Labels<T = string> {
	languageName?: T;
	agree: T;
	disagree: T;
	print: T;
	save: T;
	message: T;
}

export namespace Labels {
	export type WithLanguageName<T = string> = Labels<T> & { languageName: T };
	export type WithoutLanguageName<T = string> = Labels<T> & { languageName?: never };

	export const names = freeze(["languageName", "agree", "disagree", "print", "save", "message"] as Array<keyof Labels>);

	export const descriptions = freeze({
		agree: "“Agree” button label",
		disagree: "“Disagree” button label",
		languageName: "Language name",
		message: "License agreement instructions text",
		print: "“Print” button label",
		save: "“Save” button label"
	} as { [K in keyof Labels]-?: string });

	export async function fromPromises<T>(labels: Labels.WithoutLanguageName<Promise<T>>): Promise<Labels.WithoutLanguageName<T>>;
	export async function fromPromises<T>(labels: Labels.WithLanguageName<Promise<T>>): Promise<Labels.WithLanguageName<T>>;
	export async function fromPromises<T>(labels: Labels<Promise<T>>): Promise<Labels<T>>;

	export async function fromPromises<T>(labels: Labels<Promise<T>>): Promise<Labels<T>> {
		const labelPromises: Array<Promise<void>> = [];
		const result = {} as Labels<T>;

		for (const key of Labels.names) {
			const p = labels[key];
			if (p) {
				labelPromises.push(p.then(label => {
					result[key] = label;
				}));
			}
		}

		await PromiseEach(labelPromises);
		return result;
	}

	export interface MapOptions<T, U> {
		onNoLanguageName?(): U;
	}

	export function mapAsync<T, U>(
		labels: Labels.WithLanguageName<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>,
		options?: MapOptions<T, Promise<U>>
	): Promise<Labels.WithLanguageName<U>>;

	export function mapAsync<T, U>(
		labels: Labels.WithoutLanguageName<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>,
		options?: MapOptions<T, Promise<U>> & { onNoLanguageName?: never }
	): Promise<Labels.WithoutLanguageName<U>>;

	export function mapAsync<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>,
		options: MapOptions<T, Promise<U>> & { onNoLanguageName(): Promise<U> }
	): Promise<Labels.WithLanguageName<U>>;

	export function mapAsync<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>,
		options?: MapOptions<T, Promise<U>>
	): Promise<Labels<U>>;

	export function mapAsync<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>,
		options?: MapOptions<T, Promise<U>>
	): Promise<Labels<U>> {
		return fromPromises(map(labels, fun, options));
	}

	export function map<T, U>(
		labels: Labels.WithLanguageName<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U,
		options?: MapOptions<T, U>
	): Labels.WithLanguageName<U>;

	export function map<T, U>(
		labels: Labels.WithoutLanguageName<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U,
		options?: MapOptions<T, U> & { onNoLanguageName?: never }
	): Labels.WithoutLanguageName<U>;

	export function map<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U,
		options: MapOptions<T, U> & { onNoLanguageName(): U }
	): Labels.WithLanguageName<U>;

	export function map<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U,
		options?: MapOptions<T, U>
	): Labels<U>;

	export function map<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U,
		{ onNoLanguageName }: MapOptions<T, U> = {}
	): Labels<U> {
		const result = {} as Labels<U>;

		Labels.forEach(
			labels,
			(label, key) => {
				result[key] = fun(label, key, labels);
			},
			{
				onNoLanguageName: onNoLanguageName ? () => {
					result.languageName = onNoLanguageName();
				} : undefined
			}
		);

		return result;
	}

	export interface ForEachOptions {
		onNoLanguageName?(): void;
	}

	export function forEach<T>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => void,
		{ onNoLanguageName }: ForEachOptions = {}
	): void {
		for (const name of names) {
			const label = labels[name];

			if (label === undefined && name === "languageName") {
				if (onNoLanguageName)
					onNoLanguageName();
			}
			else
				fun(label!, name, labels);
		}
	}

	export interface CreateOptions {
		includeLanguageName?: boolean;
	}

	export function create<T>(
		fun: (key: keyof Labels, index: number) => T,
		options: CreateOptions & { includeLanguageName: true }
	): Labels.WithLanguageName<T>;

	export function create<T>(
		fun: (key: keyof Labels, index: number) => T,
		options?: CreateOptions & { includeLanguageName?: false }
	): Labels.WithoutLanguageName<T>;

	export function create<T>(
		fun: (key: keyof Labels, index: number) => T,
		options?: CreateOptions
	): Labels<T>;

	export function create<T>(
		fun: (key: keyof Labels, index: number) => T,
		{ includeLanguageName = false }: CreateOptions = {}
	): Labels<T> {
		const labels = {} as Labels<T>;

		names.forEach((key, index) => {
			if (includeLanguageName || key !== "languageName")
				labels[key] = fun(key, index);
		});

		return labels;
	}

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		options: CreateOptions & { includeLanguageName: true }
	): Promise<Labels.WithLanguageName<T>>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		options?: CreateOptions & { includeLanguageName?: false }
	): Promise<Labels.WithoutLanguageName<T>>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		options?: CreateOptions
	): Promise<Labels<T>>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		options?: CreateOptions
	): Promise<Labels<T>> {
		return fromPromises(create(fun, options));
	}

	/**
	 * Prepares a label set for insertion into a disk image as a `STR#` resource.
	 *
	 * @remarks
	 * Throws {@link LabelEncodingError} if there is a problem encoding some of the labels.
	 *
	 * Throws {@link verror#MultiError} if there is more than one error.
	 *
	 * @param labels - The label set to prepare.
	 *
	 * @param lang - The language to prepare the label set for. This determines the target character set.
	 *
	 * @returns A `Buffer` in `STR#` format.
	 */
	export function prepare(
		labels: Labels,
		lang: Language
	): Buffer {
		const sbuf = new SmartBuffer();

		function writeStr(string: string, description: string) {
			let data: Buffer;

			try {
				data = lang.charset.encode(string);
			}
			catch (e) {
				errors.add(new LabelEncodingError(description, lang, e));
				return;
			}

			const length = data.length;

			if (length > 255) {
				const e = new LabelEncodingError(description, lang, "the label is too large to write into a STR# resource. The maximum size is 255 bytes, but it is %d bytes.", length);
				e.text = data;
				errors.add(e);
				return;
			}

			if (errors.isEmpty) {
				sbuf.writeUInt8(length);
				sbuf.writeBuffer(data);
			}
		}

		// Magic
		sbuf.writeUInt16BE(6);

		// Labels
		const errors = new ErrorBuffer();

		Labels.forEach(
			labels,
			(label, key) => writeStr(label, Labels.descriptions[key]),
			{onNoLanguageName() {
				// If no language name is provided, try the languageName in the built-in labels, or failing that, the language's localizedName.

				writeStr(
					lang.labels && lang.labels.languageName || lang.localizedName,
					Labels.descriptions.languageName
				);
			}}
		);

		errors.check();
		return sbuf.toBuffer();
	}

	/**
	 * Prepares the given language's default label set for insertion into a disk image as a `STR#` resource.
	 *
	 * @remarks
	 * Throws {@link NoDefaultLabelsError} if there is no default label set for the given language.
	 *
	 * Throws {@link LabelEncodingError} if there is a problem encoding some of the labels.
	 *
	 * Throws a {@link verror#MultiError} if there is more than one error.
	 *
	 * @param lang - The language to prepare the label set for.
	 *
	 * @param contextOrOptions - Context of an existing {@link dmgLicense} run, or options for one (when calling this function standalone).
	 *
	 * @returns A `Buffer` in `STR#` format.
	 */
	export function prepareDefault(
		lang: Language
	): Buffer {
		const labels = lang.labels;
		if (!labels)
			throw new NoDefaultLabelsError(lang);

		return Labels.prepare(labels, lang);
	}

	/**
	 * Prepares a label set for insertion into a disk image as a `STR#` resource.
	 *
	 * @remarks
	 * This function delegates to `prepareDefault` or `prepare` as appropriate.
	 *
	 * Throws {@link NoDefaultLabelsError} if `labels` is `null` or `undefined` and there is no default label set for the given language.
	 *
	 * Throws {@link LabelEncodingError} if there is a problem encoding some of the labels.
	 *
	 * Throws a {@link verror#MultiError} if there is more than one error.
	 *
	 * @param labels - An object describing the label set to prepare. If `null` or `undefined`, the default label set for the given language is used instead.
	 *
	 * @param lang - The language to prepare the label set for. This determines the target character set, and if `labels` is `null` or `undefined`, which language's default label set to use.
	 *
	 * @param contextOrOptions - Context of an existing {@link dmgLicense} run, or options for one (when calling this function standalone). Used to resolve relative paths if `labels` is a `LabelsSpec.LabelsRaw`.
	 *
	 * @returns A `Buffer` in `STR#` format.
	 */
	export async function prepareSpec(
		labels: LabelsSpec | null | undefined,
		lang: Language,
		contextOrOptions: Context | Options
	): Promise<Buffer> {
		if (!labels)
			return prepareDefault(lang);
		else if (labels.file) {
			const context = Context.from(contextOrOptions);
			return readFileP(context.resolvePath(labels.file));
		}
		else
			return prepare(labels as LabelsSpec.LabelsInline, lang);
	}
}

Object.defineProperty(Labels, Symbol.toStringTag, {value: "Labels"});

export default Labels;

export interface NoLabels extends Partial<Labels<undefined>> {}

export type LabelsSpec = LabelsSpec.LabelsInline | LabelsSpec.LabelsRaw;

export namespace LabelsSpec {
	export interface LabelsInline extends Localization, Labels {
		file?: never;
	}

	export interface LabelsRaw extends Localization, NoLabels {
		file: string;
	}
}
