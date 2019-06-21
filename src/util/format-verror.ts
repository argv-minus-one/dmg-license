import { inspect, InspectOptions } from "util";
import { MultiError } from "verror";
import VError = require("verror");

declare interface CustomInspectOptions extends InspectOptions {
	stylize(s: string, style: string): string;
}

declare interface HasCustomInspect {
	[inspect.custom]?(depth: number, options: CustomInspectOptions): string;
}

function inspectVError(this: VError, depth: number, options: CustomInspectOptions): string {
	const cause = this.cause();
	return `${this.stack}${cause ? `\nCaused by: ${inspect(cause, options)}` : ""}`;
}

function inspectMultiError(this: MultiError, depth: number, options: CustomInspectOptions): string {
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

if (!VError.prototype.hasOwnProperty(inspect.custom))
	(VError.prototype as HasCustomInspect)[inspect.custom] = inspectVError;

if (!MultiError.prototype.hasOwnProperty(inspect.custom))
	(MultiError.prototype as HasCustomInspect)[inspect.custom] = inspectMultiError;
