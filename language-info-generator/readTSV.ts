import * as Readline from "readline";

const blankLineRegex = /^\s*$/;
const commentLineRegex = /^\s*\#/;

async function* readTSV(
	input: NodeJS.ReadableStream,
	options?: readTSV.Options
): AsyncIterableIterator<{ lineNum: number, cells: string[] }> {
	let lineNum = 0;

	for await (const line of Readline.createInterface({ input, terminal: false })) {
		lineNum++;

		if (
			(!options || !options.skipBlankLines || !blankLineRegex.test(line)) &&
			(!options || !options.skipCommentLines || !commentLineRegex.test(line)) &&
			(!options || !options.filter || options.filter(line))
		) {
			yield { lineNum, cells: line.split("\t") };
		}
	}
}

namespace readTSV {
	export interface Options {
		skipBlankLines?: boolean;
		skipCommentLines?: boolean;
		filter?(line: string): boolean;
	}

	const skipOpts: Options = {
		skipBlankLines: true,
		skipCommentLines: true
	};

	export function withSkips(
		input: NodeJS.ReadableStream
	) {
		return readTSV(input, skipOpts);
	}
}

Object.defineProperty(readTSV, Symbol.toStringTag, {value: "readTSV"});

export default readTSV;
