import * as FS from "fs";

export const isArray = Array.isArray || (arg => arg instanceof Array);

/**
 * Converts a single value into an array containing that value, unless the value is already an array.
 */
export function arrayify<T>(v: T | T[]): T[] {
	return isArray(v) ? v : [v];
}

/**
 * Converts an array of length 1 to the one value in it. Other arrays are passed through unchanged.
 */
export function unarrayify<T>(v: T[]): T | typeof v {
	return v.length === 1 ? v[0] : v;
}

export function readFileP(path: FS.PathLike) {
	return new Promise<Buffer>((resolve, reject) => {
		FS.readFile(path, (error, data) => {
			if (error)
				reject(error);
			else
				resolve(data);
		});
	});
}

export function mapObjByKeys<K extends PropertyKey, T, U>(
	obj: {
		[key in K]: T;
	},
	keys: ReadonlyArray<K>,
	fun: (value: T, key: K) => U,
	target?: {
		[key in K]: U;
	}
): {
	[key in K]: U;
} {
	if (!target)
		target = {} as Exclude<typeof target, undefined>;

	for (const key of keys)
		target[key] = fun(obj[key], key);

	return target;
}
