import PromiseEach from "./util/PromiseEach";

const { freeze } = Object;

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

	export const keys = freeze(["languageName", "agree", "disagree", "print", "save", "message"] as Array<keyof Labels>);

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
		for (const key of keys) {
			const label = labels[key];

			if (label === undefined && key === "languageName") {
				if (onNoLanguageName)
					onNoLanguageName();
			}
			else
				fun(label!, key, labels);
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

		keys.forEach((key, index) => {
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
}

export interface NoLabels extends Partial<Labels<undefined>> {}

/** A label set, whose values are base64-encoded strings in the language's native character set. */
export interface NativeEncodedLabels extends Labels<string> {
	charset: "native;base64";
}

/** A label set, as it appears in `language-info.json`. */
export type LanguageInfoLabels = Labels.WithLanguageName<string> & ({} | NativeEncodedLabels);
