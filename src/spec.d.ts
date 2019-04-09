import { Labels, NoLabels } from "./Labels";

export type BodySpec = {
	type?: "rtf" | "plain";
} & (
	{
		text: string;
		charset?: never;
		encoding?: never;
		file?: never;
	} | {
		text: string;
		charset: "native" | string;
		encoding: "base64";
		file?: never;
	} | {
		file: string;
		charset: "native" | string;
		encoding: "base64";
		text?: never;
	} | {
		file: string;
		charset?: "native" | string;
		encoding?: never;
		text?: never;
	}
);

/*export type LabelsSpec = (Labels & (
	{
		type?: "inline";
		charset?: never;
		encoding?: never;
		delimiters?: never;
	} | {
		type?: "inline";
		charset: "native" | string;
		encoding: "base64";
		delimiters?: never;
	} | {
		type: "one-per-file";
		charset?: "native" | string;
		encoding?: "base64";
		delimiters?: never;
	}
)) | (NoLabels & {
	file: string;
} & (
	{
		type: "json";
		charset?: never;
		encoding?: never;
		delimiters?: never;
	} | {
		type: "json";
		charset: "native" | string;
		encoding: "base64";
		delimiters?: never;
	} | {
		type: "raw";
		charset?: never;
		encoding?: never;
		delimiters?: never;
	} | {
		type: "delimited";
		charset: "native" | string;
		encoding?: "base64";
		delimiters: Array<"tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | Uint8Array>;
	}
));*/

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
		LabelsSpec & (
			T extends "inline" ?
			{ type?: T } :
			{ type: T }
		);

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
		charset?: "native" | string;
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
		charset: "native" | string;
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
