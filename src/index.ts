import Context from "./Context";
import { Labels, NoLabels } from "./Labels";
import LicenseContent from "./LicenseContent";
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
	}

	export interface BodyInline extends BaseBodySpec {
		charset?: never;
		encoding?: never;
		file?: never;
		text: string;
	}

	export interface BodyInlineBase64 extends BaseBodySpec {
		charset: "native" | string;
		encoding: "base64";
		file?: never;
		text: string;
	}

	export interface BodyInFile extends BaseBodySpec {
		charset?: "UTF-8" | "native" | string;
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

	export interface LabelsInline extends Labels {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file?: never;
		type?: "inline";
	}

	export interface LabelsInlineBase64 extends Labels {
		charset: "native" | string;
		delimiters?: never;
		encoding: "base64";
		file?: never;
		type?: "inline";
	}

	export interface LabelsOnePerFile extends Labels {
		charset?: "UTF-8" | "native" | string;
		delimiters?: never;
		encoding?: "base64";
		file?: never;
		type: "one-per-file";
	}

	export interface LabelsInJSON extends NoLabels {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file: string;
		type: "json";
	}

	export interface LabelsInJSONBase64 extends NoLabels {
		charset: "native" | string;
		delimiters?: never;
		encoding: "base64";
		file: string;
		type: "json";
	}

	export interface LabelsInRawFile extends NoLabels {
		charset?: never;
		delimiters?: never;
		encoding?: never;
		file: string;
		type: "raw";
	}

	export interface LabelsInDelimitedFile extends NoLabels {
		charset: "UTF-8" | "native" | string;
		delimiters: Array<"tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | Uint8Array>;
		encoding?: "base64";
		file: string;
		type: "delimited";
	}
}

export interface LicenseSpec {
	body: BodySpec;
	labels?: LabelsSpec;
	lang: string | number | Array<string | number>;
	default?: boolean;
}

export interface Options {
	resolvePath?(path: string): string;
	onNonFatalError?(error: Error): void;
}

export async function dmgLicense(imagePath: string, specs: LicenseSpec[], options: Options): Promise<void> {
	const context = new Context(options);

	await writePlistToDmg(
		imagePath,
		makeLicensePlist(
			await LicenseContent.load(specs, context),
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
