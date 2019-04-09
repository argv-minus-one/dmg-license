/// <reference lib="esnext.array" />
import "core-js/features/array/flat";
import { MultiError, VError } from "verror";

/**
 * Accumulates multiple errors, to all be thrown together instead of one at a time.
 */
export class ErrorBuffer {
	errors: Error[] = [];

	/**
	 * Adds the given error(s) (or other objects, which are converted to errors).
	 */
	add(...errors: unknown[]): void {
		for (const error of errors) {
			if (error instanceof MultiError)
				this.add(...error.errors());
			else
				this.errors.push(
					error instanceof Error ? error : new Error(String(error))
				);
		}
	}

	/**
	 * Catches errors thrown from the given function, adding them to the array of accumulated errors.
	 */
	catching(fun: () => void): void {
		try {
			fun();
		}
		catch (e) {
			this.add(e);
		}
	}

	/**
	 * Throws any accumulated errors.
	 */
	check(): void {
		const error = VError.errorFromList(this.errors);
		if (error) throw error;
	}
}
