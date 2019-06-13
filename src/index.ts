import { assembleLicenses } from "./assemble";
import Context from "./Context";
import { Labels, NoLabels } from "./Labels";
import makeLicensePlist from "./makeLicensePlist";
import specFromJSON from "./specFromJSON";
import writePlistToDmg from "./writePlistToDmg";

export { Labels, NoLabels };

export type BodySpec =
	BodySpec.BodyInline |
	BodySpec.BodyInlineBase64 |
	BodySpec.BodyInFile;

export namespace BodySpec {
	interface BaseBodySpec {
		type?: "rtf" | "plain";
		lang: string | number | Array<string | number>;
	}

	export interface BodyInline extends BaseBodySpec {
		charset?: never;
		encoding?: never;
		file?: never;
		text: string;
	}

	export interface BodyInlineBase64 extends BaseBodySpec {
		charset: string;
		encoding: "base64";
		file?: never;
		text: string;
	}

	export interface BodyInFile extends BaseBodySpec {
		charset?: "UTF-8" | string;
		encoding?: "base64";
		file: string;
		text?: never;
	}
}

export type LabelsSpec =
	LabelsSpec.LabelsInline |
	LabelsSpec.LabelsInlineBase64 |
	LabelsSpec.LabelsOnePerFile |
	LabelsSpec.LabelsInJSON |
	LabelsSpec.LabelsInJSONBase64 |
	LabelsSpec.LabelsInRawFile |
	LabelsSpec.LabelsInDelimitedFile;

export namespace LabelsSpec {
	export type Type = Exclude<LabelsSpec["type"], undefined>;

	export type ForType<T extends LabelsSpec["type"]> =
		T extends (undefined | null | "" | "inline") ? (LabelsInline | LabelsInlineBase64) :
		T extends "one-per-file" ? LabelsOnePerFile :
		T extends "json" ? (LabelsInJSON | LabelsInJSONBase64) :
		T extends "raw" ? LabelsInRawFile :
		T extends "delimited" ? LabelsInDelimitedFile :
		never;

	interface LabelsSpecBase {
		lang: string | number | Array<string | number>;
	}

	export interface LabelsInline extends Labels, LabelsSpecBase {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file?: never;
		type?: "inline";
	}

	export interface LabelsInlineBase64 extends Labels, LabelsSpecBase {
		charset: string;
		delimiters?: never;
		encoding: "base64";
		file?: never;
		type?: "inline";
	}

	export interface LabelsOnePerFile extends Labels, LabelsSpecBase {
		charset?: "UTF-8" | string;
		delimiters?: never;
		encoding?: "base64";
		file?: never;
		type: "one-per-file";
	}

	export interface LabelsInJSON extends NoLabels, LabelsSpecBase {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file: string;
		type: "json";
	}

	export interface LabelsInJSONBase64 extends NoLabels, LabelsSpecBase {
		charset: string;
		delimiters?: never;
		encoding: "base64";
		file: string;
		type: "json";
	}

	export interface LabelsInRawFile extends NoLabels, LabelsSpecBase {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file: string;
		type: "raw";
	}

	export interface LabelsInDelimitedFile extends NoLabels, LabelsSpecBase {
		charset: "UTF-8" | string;
		delimiters: Array<"tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | Uint8Array>;
		encoding?: "base64";
		file: string;
		type: "delimited";
	}
}

export interface LicenseSpec {
	body: BodySpec[];
	labels?: LabelsSpec[];
	defaultLang?: string | number;
}

export interface Options {
	resolvePath?(path: string): string;
	onNonFatalError?(error: Error): void;
}

export async function dmgLicense(imagePath: string, spec: LicenseSpec, options: Options): Promise<void> {
	const context = new Context(options);

	await writePlistToDmg(
		imagePath,
		makeLicensePlist(
			await assembleLicenses(spec, context),
			context
		)
	);
}

export namespace dmgLicense {
	export async function fromJSON(imagePath: string, specJSON: string | object, options: fromJSON.Options): Promise<void> {
		const spec = specFromJSON(specJSON, options);
		return await dmgLicense(imagePath, spec, options);
	}

	export namespace fromJSON {
		// tslint:disable-next-line: no-shadowed-variable
		export type Options = specFromJSON.Options;
	}
}

export default dmgLicense;
