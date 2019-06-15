export interface FirstIndex<N> {
	index: number;
	needleIndex: number;
	needle: N;
}

export function firstIndexOf<N extends Uint8Array>(haystack: Buffer, needles: ReadonlyArray<N>, byteOffset?: number): FirstIndex<N> | null {
	return needles.reduce((prevBest: FirstIndex<N> | null, needle, needleIndex) => {
		const index = haystack.indexOf(needle, byteOffset);

		if (index >= 0 && (!prevBest || index < prevBest.index))
			return { index, needle, needleIndex };
		else
			return prevBest;
	}, null);
}

export type Delimiter = "tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | Uint8Array;

const namedDelimiters: {
	[K in (Delimiter & string)]: Buffer[];
} = {
	cr: [Buffer.from([13])],
	crlf: [Buffer.from([13, 10])],
	eol: [],
	lf: [Buffer.from([10])],
	nul: [Buffer.from([0])],
	tab: [Buffer.from([9])]
};
namedDelimiters.eol = [...namedDelimiters.crlf, ...namedDelimiters.cr, ...namedDelimiters.lf];

export function bufferSplitMulti(buffer: Buffer, delimiters: ReadonlyArray<Delimiter>, includeDelimiters: boolean = false): Buffer[] {
	const binaryDelimiters: Uint8Array[] = [];

	for (const delimiter of delimiters) {
		if (typeof delimiter === "string")
			binaryDelimiters.push(...namedDelimiters[delimiter]);
		else
			binaryDelimiters.push(delimiter);
	}

	const ret: Buffer[] = [];
	let pos = 0;
	const max = buffer.length;

	while (pos < max) {
		const next = firstIndexOf(buffer, binaryDelimiters, pos);
		if (next === null) {
			ret.push(buffer.slice(pos));
			break;
		}
		else {
			ret.push(buffer.slice(pos, next.index));

			if (includeDelimiters) {
				// Don't return next.needle; it's internal mutable data that must not leak.
				ret.push(buffer.slice(next.index, next.needle.length));
			}

			pos = next.index + next.needle.length;
		}
	}

	return ret;
}
