import * as Plist from "plist";
import { PlistObject } from "plist";
import { assembleLicenses } from "./assemble";
import Context from "./Context";
import { Labels, NoLabels } from "./Labels";
import makeLicensePlist from "./makeLicensePlist";
import specFromJSON from "./specFromJSON";
import writePlistToDmg from "./writePlistToDmg";

export { BadJSONLicenseSpecError } from "./specFromJSON";
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
		charset?: "UTF-8" | string;
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
	return await writePlistToDmg(imagePath, (await dmgLicensePlist(spec, options)).plist);
}
export default dmgLicense;

export async function dmgLicensePlist(spec: LicenseSpec, options: Options): Promise<{
	plist: PlistObject;
	plistText: string;
}> {
	const context = new Context(options);

	const plist = makeLicensePlist(
		await assembleLicenses(spec, context),
		context
	);

	return {
		plist,
		get plistText() {
			return Plist.build(plist);
		}
	};
}

export type FromJSONOptions = specFromJSON.Options;

export async function dmgLicenseFromJSON(imagePath: string, specJSON: string | object, options: FromJSONOptions) {
	return await dmgLicense(imagePath, specFromJSON(specJSON, options), options);
}

export async function dmgLicensePlistFromJSON(specJSON: string | object, options: FromJSONOptions) {
	return await dmgLicensePlist(specFromJSON(specJSON, options), options);
}
