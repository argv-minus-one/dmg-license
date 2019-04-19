import bufferFrom = require("buffer-from");
import Context from "./Context";
import Language from "./Language";

type CodedString = string | {
	data: string;
	charset?: never;
	encoding?: never;
} | {
	data: string;
	charset: "native" | string;
	encoding: "base64";
} | {
	data: Buffer;
	charset: "native" | string;
	encoding?: "base64";
};

namespace CodedString {
	export function encode(
		s: CodedString,
		langs: Language[],
		context: Context
	): Buffer {
		if (typeof s === "string")
			return context.iconvCache.tryCharEncode(s, langs);
		else {
			let {data} = s;

			if (typeof data === "string" && s.encoding === "base64")
				data = bufferFrom(data, "base64");

			if (Buffer.isBuffer(data) && s.charset && s.charset.toLowerCase() === "native")
				return data;

			return context.iconvCache.tryCharEncode(
				typeof data === "string" ? data : { charset: s.charset || "UTF-8", data },
				langs
			);
		}
	}
}

export default CodedString;
