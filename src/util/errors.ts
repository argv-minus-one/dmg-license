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
		for (let error of errors) {
			if (error instanceof MultiError)
				this.add(...error.errors());
			else {
				if (!(error instanceof Error))
					error = new Error(String(error));
				else if (this.errors.indexOf(error) !== -1) {
					/* Deduplicate errors.
					 *
					 * Consider this scenario:
					 * 1. Promise A is started.
					 * 2. Promise B is started. It awaits the result of A.
					 * 3. Promise C is started. It also awaits the result of A.
					 * 4. PromiseEach is called, to collect the results of promises B and C.
					 * 5. Promise A rejects with error E.
					 * 6. Promise B, previously waiting on A, rejects with E.
					 * 7. Promise C, previously waiting on A, also rejects with E.
					 * 8. PromiseEach collects the results of [B, C]. They are { B: rejection(E), C: rejection(E) }.
					 * 9. PromiseEach finds that B rejected with E, so it adds E to its ErrorBuffer.
					 * 10. PromiseEach finds that C rejected with E, so it adds E to its ErrorBuffer.
					 * 11. PromiseEach rejects with [E, E].
					 *
					 * But, if ErrorBuffer deduplicates the errors it receives, then step 10 has no effect, because E is already in the ErrorBuffer. As a result, in step 11, PromiseEach rejects with E instead of [E, E].
					 *
					 * Note that this deduplication only applies to instances of Error. When other values are passed in, they are converted to a new instance of Error each time, so there is no chance to deduplicate them.
					 */
					continue;
				}

				this.errors.push(error as Error);
			}
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
