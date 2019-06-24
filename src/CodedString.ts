import { StringEncoding, transcode } from "iconv-corefoundation";
import Language from "./Language";

type CodedString = string | {
	text: string;
	charset?: never;
	encoding?: never;
} | {
	text: string;
	charset: string;
	encoding: "base64";
} | {
	text: Buffer;
	charset: string;
	encoding?: "base64";
};

namespace CodedString {
	export type Resolved = {
		text: string;
		charset?: never;
	} | {
		text: Buffer;
		charset: StringEncoding;
	};

	export function resolve(s: CodedString): Resolved {
		if (typeof s === "string")
			return { text: s };
		else {
			const {text, charset, encoding} = s;
			return {
				text: typeof text === "string" && encoding ? Buffer.from(text, encoding) : text,
				...charset ? { charset: StringEncoding.byIANACharSetName(charset) } : {}
			} as Resolved;
		}
	}

	export function encode(
		s: CodedString,
		lang: Language
	): Buffer {
		const {text, charset} = resolve(s);

		if (typeof text === "string")
			return lang.charset.encode(text);
		else if (lang.charset.equals(charset!))
			return text;
		else
			return transcode(text, charset!, lang.charset);
	}
}

Object.defineProperty(CodedString, Symbol.toStringTag, {value: "CodedString"});

export default CodedString;
