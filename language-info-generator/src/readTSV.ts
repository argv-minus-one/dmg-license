import * as Readline from "readline";

const blankLineRegex = /^\s*$/;
const commentLineRegex = /^\s*\#/;

async function* readTSV(
	input: NodeJS.ReadableStream,
	options?: readTSV.Options
): AsyncIterableIterator<{ lineNum: number, cells: string[] }> {
	let lineNum = 0;

	// No idea why this TSLint rule triggers here. All Node readable streams *are* async iterable.
	// tslint:disable-next-line:await-promise
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

export default readTSV;
