export default async function ignoreErrorCodes<T>(p: Promise<T>, ...codes: string[]): Promise<T | void> {
	try {
		return await p;
	}
	catch (e) {
		if (
			e instanceof Error &&
			codes.some(code => e.code === code)
		) {
			// Ignore.
		}
		else
			throw e;
	}
}
