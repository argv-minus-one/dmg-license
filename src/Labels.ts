import PromiseEach from "./util/PromiseEach";

const { freeze } = Object;

export interface Labels<T = string> {
	agree: T;
	disagree: T;
	print: T;
	save: T;
	message: T;
}

export namespace Labels {
	export const keys = freeze(["agree", "disagree", "print", "save", "message"] as Array<keyof Labels>);

	export const descriptions = freeze({
		agree: "“Agree” button label",
		disagree: "“Disagree” button label",
		message: "License agreement instructions text",
		print: "“Print” button label",
		save: "“Save” button label"
	} as { [K in keyof Labels]: string });

	export async function fromPromises<T>(labels: Labels<Promise<T>>): Promise<Labels<T>> {
		const labelPromises: Array<Promise<void>> = [];
		const result = {} as Labels<T>;

		for (const key of Labels.keys) {
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

	export function mapAsync<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => Promise<U>
	): Promise<Labels<U>> {
		return fromPromises(map(labels, fun));
	}

	export function map<T, U>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => U
	): Labels<U> {
		const result = {} as Labels<U>;

		Labels.forEach(
			labels,
			(label, key) => {
				result[key] = fun(label, key, labels);
			}
		);

		return result;
	}

	export function forEach<T>(
		labels: Labels<T>,
		fun: (label: T, key: keyof Labels, labels: Labels<T>) => void
	): void {
		for (const key of keys)
			fun(labels[key], key, labels);
	}

	export function create<T>(
		fun: (key: keyof Labels, index: number) => T
	): Labels<T> {
		const labels = {} as Labels<T>;

		keys.forEach((key, index) => {
			labels[key] = fun(key, index);
		});

		return labels;
	}

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		includeLanguageName: true
	): Promise<Labels<T> & { languageName: T }>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		includeLanguageName?: false
	): Promise<Labels<T> & { languageName?: never }>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		includeLanguageName: boolean | undefined
	): Promise<Labels<T>>;

	export function createAsync<T>(
		fun: (key: keyof Labels, index: number) => Promise<T>,
		includeLanguageName: boolean = false
	): Promise<Labels<T>> {
		return fromPromises(create(fun));
	}
}

export interface NoLabels extends Partial<Labels<undefined>> {}

/** A label set, whose values are base64-encoded strings in the language's native character set. */
export interface NativeEncodedLabels extends Labels<string> {
	charset: "native;base64";
}

/** A label set, as it appears in `language-info.json`. */
export type LanguageInfoLabels = (Labels<string> | NativeEncodedLabels);
