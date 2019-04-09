import { Labels, Options } from ".";
import IconvCache from "./IconvCache";
import { Language } from "./languages";
import { ErrorBuffer } from "./util/errors";

export default class Context {
	iconvCache = new IconvCache();
	defaultLabels = new Map<Language, Buffer | Error>();

	constructor(public options: Options) {
		if (options.resolvePath)
			this.resolvePath = options.resolvePath.bind(options);
	}

	defaultLabelsOf(lang: Language): Buffer | Error {
		let ret = this.defaultLabels.get(lang);

		if (ret === undefined) {
			try {
				ret =
					lang.labels
					? Labels.pack(lang.labels, lang, this)
					: new Error(`There are no default labels for ${lang.englishName}. You must provide your own labels for this language.`);
			}
			catch (e) {
				ret = e instanceof Error ? e : new Error(e);
			}

			this.defaultLabels.set(lang, ret);
		}

		return ret;
	}

	resolvePath(path: string): string {
		return path;
	}

	nonFatalError(error: Error, errorBuffer?: ErrorBuffer): void {
		const reporter = this.options.onNonFatalError;

		if (reporter) {
			if (errorBuffer)
				errorBuffer.catching(() => reporter(error));
			else
				reporter(error);
		}
		else
			throw error;
	}

	warning(error: Error, errorBuffer?: ErrorBuffer): void {
		const reporter = this.options.onNonFatalError;

		if (reporter) {
			if (errorBuffer)
				errorBuffer.catching(() => reporter(error));
			else
				reporter(error);
		}
	}
}
