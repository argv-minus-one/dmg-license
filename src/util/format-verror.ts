import { inspect, InspectOptions } from "util";
import { MultiError } from "verror";
import VError = require("verror");

interface CustomInspectOptions extends InspectOptions {
	stylize(s: string, style: string): string;
}

interface HasCustomInspect {
	[inspect.custom]?(depth: number, options: CustomInspectOptions): string;
}

function subinspect(obj: unknown, options: CustomInspectOptions): string {
	options = {
		...options,
		depth: options.depth == null ? null : options.depth - 1
	};
	return inspect(obj, options);
}

export class PrettyVError extends VError implements HasCustomInspect {
	static errorFromList<T extends Error>(errors: T[]): null | T | PrettyMultiError {
		switch (errors.length) {
			case 0: return null;
			case 1: return errors[0];
			default: return new PrettyMultiError(errors);
		}
	}

	private _ownStack?: string;

	constructor(options: VError.Options | Error, message: string, ...params: any[]);
	constructor(message?: string, ...params: any[]);

	constructor(...params: any[]) {
		super(...params);

		this._ownStack = this.stack;
		Object.defineProperty(this, "stack", {
			get() {
				return this[inspect.custom]();
			},
			set(stack: string) {
				this._ownStack = stack;
			},
			configurable: true
		});
	}

	[inspect.custom](
		depth: number = inspect.defaultOptions.depth || 2,
		options: CustomInspectOptions = { stylize(s) { return s; }, ...inspect.defaultOptions }
	): string {
		if (depth < 0)
			return this.toString();

		const cause = this.cause();
		return `${this._ownStack}${cause ? `\ncaused by: ${subinspect(cause, options)}` : ""}`;
	}
}
PrettyVError.prototype.name = Error.prototype.name;
PrettyVError.prototype.toString = Error.prototype.toString;

export class PrettyMultiError extends MultiError implements HasCustomInspect {
	private _ownStack?: string;

	constructor(errors: Error[]) {
		super(errors);

		this._ownStack = this.stack;
		Object.defineProperty(this, "stack", {
			get() {
				return this[inspect.custom]();
			},
			set(stack: string) {
				this._ownStack = stack;
			},
			configurable: true
		});
	}

	[inspect.custom](
		depth: number = inspect.defaultOptions.depth || 2,
		options: CustomInspectOptions = { stylize(s) { return s; }, ...inspect.defaultOptions }
	): string {
		if (depth < 0)
			return options.stylize(this.toString(), "special");

		const errors = this.errors();
		switch (errors.length) {
			case 0: return `${this.toString()} (empty)`;
			case 1: return inspect(errors[0]);

			default: return `${errors.length} errors:\n${
				errors.map((error, errorIndex) => {
					const isLastError = errorIndex + 1 === errors.length;

					const formattedError = inspect(error, { ...options, depth: options.depth == null ? null : options.depth - 1 });
					let lines = formattedError.split(/\r\n|\r|\n/);

					const firstLinePrefix = isLastError ? "└" : "├";
					const restLinePrefix = isLastError ? " " : "│";
					lines = lines.map((line, lineIndex) => {
						const isFirstLine = lineIndex === 0;
						return `${isFirstLine ? firstLinePrefix : restLinePrefix} ${line}`;
					});

					return lines.join("\n");
				}).join("\n")
			}`;
		}
	}
}
PrettyMultiError.prototype.name = Error.prototype.name;
PrettyMultiError.prototype.toString = Error.prototype.toString;
