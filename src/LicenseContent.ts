/// <reference lib="esnext.array" />
import bufferFrom = require("buffer-from");
import "core-js/features/array/flat";
import { VError } from "verror";
import { Labels, Options } from ".";
import CodedString from "./CodedString";
import Context from "./Context";
import * as languages from "./languages";
import { Language } from "./languages";
import { LicenseSpec } from "./spec";
import { readFileP } from "./util";
import { ErrorBuffer } from "./util/errors";
import PromiseEach from "./util/PromiseEach";

interface LicenseContent extends Array<{
	body: {
		data: Buffer;
		type: LicenseContent.BodyType;
	};
	labels: Buffer;
	regionCodes: number[];
}> {
	defaultRegion: number;
}

namespace LicenseContent {
	export type BodyType = "RTF " | "TEXT";

	function describeSpec(spec: LicenseSpec): string {
		return `LicenseSpec for ${spec.lang}`;
	}

	/**
	 * Loads the license body text for the given `LicenseSpec`.
	 *
	 * @param slangs - Languages that `spec` applies to.
	 */
	async function loadBody(
		spec: LicenseSpec,
		slangs: languages.Language[],
		context: Context
	): Promise<{ data: Buffer, type: BodyType }> {
		return {
			data: CodedString.encode(
				spec.body.text != null
				? {
					...spec.body,
					data: spec.body.text
				}
				: {
					...spec.body,
					data: await readFileP(spec.body.file)
				},
				slangs,
				context
			),
			type: (() => {
				if (spec.body.type) {
					if (spec.body.type === "rtf")
						return "RTF ";
					else
						return "TEXT";
				}
				else if (spec.body.file) {
					if (spec.body.file.endsWith(".rtf"))
						return "RTF ";
					else
						return "TEXT";
				}
				else
					return "TEXT";
			})()
		};
	}

	export async function load(
		specs: LicenseSpec[],
		options: Options | Context
	): Promise<LicenseContent> {
		const context = options instanceof Context ? options : new Context(options);

		const contents = await PromiseEach(specs.map(async spec => {
			const langs = Language.forSpec(spec);

			const [body, labels] = await PromiseEach([
				loadBody(spec, langs, context),
				Labels.load(spec, context, langs)
			]);

			return { spec, body, labels, langs };
		}));

		const errors = new ErrorBuffer();
		const ret: LicenseContent = Object.assign(
			[],
			{ defaultRegion: NaN }
		);

		for (const content of contents) {
			const noLabelsFor: Language[] = [];

			for (const lang of content.langs) {
				const labels = content.labels.find(label => label.regionCode === lang.regionCode);

				if (!labels) {
					/*
					errors.add(new VError(
						{
							info: {
								language: lang.langTags[0],
								regionCode: lang.regionCode
							}
						},
						"No labels found for language %d (%s, %s). The “labels” property must be present for this language.",
						lang.regionCode,
						lang.langTags[0],
						lang.englishName
					));
					*/
					noLabelsFor.push(lang);
					continue;
				}

				ret.push({
					body: content.body,
					labels: labels.data,
					regionCodes: lang.regionCode
				});
			}
		}

		// ...

		errors.check();

		if (isNaN(ret.defaultRegion)) {

		}

		/*
		const file = context.resolvePath(spec.path);

		return new Promise((resolve, reject) => {
			FS.readFile(file, function(err, data) {
				if (err) {
					return reject(err);
				}

				const isRTF = spec.path.endsWith(".rtf");

				function useASCII() {
					return localeAllowsASCII && data.every(function(b) {
						return b <= 127;
					});
				}

				const type: LicenseTextType =
					isRTF ? "RTF "
					: useASCII() ? "TEXT"
					: "utxt";

				if (type === "utxt") {
					data = Buffer.concat([
						utf16Bom,
						transcode(data, "utf8", "utf16le")
					]);
				}

				resolve({type, data, localeIDs: langIDs, file});
			});
		});
		*/
	}
}

export default LicenseContent;
