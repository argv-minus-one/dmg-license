import { transcode } from "iconv-corefoundation";
import { Localization, Options } from ".";
import Context from "./Context";
import Language from "./Language";
import { readFileP } from "./util";
import { PrettyVError } from "./util/format-verror";

export type BodySpec = BodySpec.BodyInline | BodySpec.BodyInFile;

export namespace BodySpec {
	interface BaseBodySpec extends Localization {
		type?: "rtf" | "plain";
	}

	export interface BodyInline extends BaseBodySpec {
		charset?: never;
		file?: never;
		text: string;
	}

	export interface BodyInFile extends BaseBodySpec {
		charset?: "UTF-8" | string;
		file: string;
		text?: never;
	}

	export async function prepare(
		spec: BodySpec,
		lang: Language,
		contextOrOptions: Context | Options = {}
	): Promise<{
		data: Buffer;
		type: "RTF " | "TEXT";
	}> {
		const context = Context.from(contextOrOptions);
		const fpath = spec.file && context.resolvePath(spec.file);

		function encodeBodyText(text: string | Buffer) {
			try {
				if (typeof text === "string")
					return lang.charset.encode(text);
				else
					return transcode(text, spec.charset || "UTF-8", lang.charset);
			}
			catch (e) {
				throw new PrettyVError(e, "Cannot encode %s license text", lang.englishName);
			}
		}

		let data: Buffer;

		if (fpath) {
			let ftext: Buffer;

			try {
				ftext = await readFileP(fpath);
			}
			catch (e) {
				throw new PrettyVError(e, "Cannot read %s license text from “%s”", lang.englishName, fpath);
			}

			data = encodeBodyText(ftext);
		}
		else
			data = encodeBodyText(spec.text!);

		let type: "RTF " | "TEXT";

		if (spec.type === "rtf" || (fpath && fpath.endsWith(".rtf")))
			type = "RTF ";
		else
			type = "TEXT";

		return {data, type};
	}
}

Object.defineProperty(BodySpec, Symbol.toStringTag, {value: "BodySpec"});

export default BodySpec;
