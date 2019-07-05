import { Options } from ".";
import { ErrorBuffer } from "./util/errors";

export default class Context {
	static from(contextOrOptions: Context | Options): Context {
		if (contextOrOptions instanceof Context)
			return contextOrOptions;
		else
			return new Context(contextOrOptions);
	}

	constructor(public options: Options) {
		if (options.resolvePath)
			this.resolvePath = options.resolvePath.bind(options);
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

	get canWarn() {
		return !!this.options.onNonFatalError;
	}
}
