import { assert } from "chai";
import { inspect } from "util";
import { dmgLicensePlistFromJSON } from "..";
import { BadJSONLicenseSpecError } from "../lib/specFromJSON";
import "./test-setup";

const testLangs: Array<{shouldAccept: boolean, lang: unknown}> = [];
for (const lang of ["en-US", 0, 1, ["nl-NL", 3], [4, "es-ES"], ["ja-JP", "fr-CA"], [11, 12, 17]])
	testLangs.push({shouldAccept: true, lang});
for (const lang of [false, null, undefined, -1, 0.5, {}, [false], []])
	testLangs.push({shouldAccept: false, lang});

const validBody = [{
	lang: 0,
	text: "text"
}];

describe("dmgLicensePlistFromJSON", () => {
	function testCase(shouldAccept: boolean, description: string, input: string | object) {
		it(
			`${shouldAccept ? "accepts" : "rejects"} ${description}`,
			() => {
				const p = dmgLicensePlistFromJSON(input, {
					resolvePath: require.resolve.bind(require)
				});
				return shouldAccept
					? p
					: assert.isRejected(p, BadJSONLicenseSpecError);
			}
		);
	}

	testCase(false, "an empty object", {});
	testCase(false, "an empty body array", {body: []});
	testCase(false, "an empty body object", {body: [{}]});

	testCase(true, "a body with inline text", {
		body: [{
			lang: "en-US",
			text: "text"
		}]
	});

	testCase(true, "a body in a file", {
		body: [{
			file: "./basic-license.txt",
			lang: "en-US"
		}]
	});

	testCase(false, "a body with both inline text and a file", {
		body: [{
			file: "./basic-license.txt",
			lang: "en-US",
			text: "text"
		}]
	});

	testCase(false, "an object with labels but no body", {
		labels: [{
			agree: "agree",
			disagree: "disagree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase(false, "a body with text but no lang", {
		body: [{
			text: "text"
		}]
	});

	testCase(false, "a body in a file with no lang", {
		body: [{
			file: "./basic-license.txt"
		}]
	});

	testCase(false, "a body with no text or file", {
		body: [{
			lang: "en-US"
		}]
	});

	for (const {shouldAccept, lang} of testLangs) testCase(
		shouldAccept,
		`a body with lang: ${inspect(lang, {compact: true})}`,
		{
			body: [{
				lang,
				text: "text"
			}]
		}
	);

	testCase(true, "an empty labels array", {
		body: validBody,
		labels: []
	});

	testCase(false, "an empty labels object", {
		body: validBody,
		labels: [{}]
	});

	testCase(true, "an inline label set", {
		body: validBody,
		labels: [{
			agree: "agree",
			disagree: "disagree",
			lang: 0,
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase(true, "a delimited label set", {
		body: validBody,
		labels: [{
			delimiters: ["eol"],
			file: "./labels/test-labels-delimited-eol.txt",
			lang: 0,
			type: "delimited"
		}]
	});

	for (const type of [undefined, "inline", "delimited", "raw", "one-per-file", "json"])
	testCase(false, `a label set with both inline labels and an external file, of type ${type}`, {
		body: validBody,
		labels: [{
			agree: "agree",
			delimiter: "eol",
			disagree: "disagree",
			file: "./labels/test-labels-delimited-eol.txt",
			lang: 0,
			message: "message",
			print: "print",
			save: "save",
			type
		}]
	});

	for (const type of [undefined, "inline", "one-per-file"])
	testCase(false, "an incomplete label set", {
		body: validBody,
		labels: [{
			agree: "agree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase(false, "a label set with no lang", {
		body: validBody,
		labels: [{
			agree: "agree",
			disagree: "disagree",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	for (const {shouldAccept, lang} of testLangs) testCase(
		shouldAccept,
		`a label set with lang: ${inspect(lang, {compact: true})}`,
		{
			body: validBody,
			labels: [{
				agree: "agree",
				disagree: "disagree",
				lang,
				message: "message",
				print: "print",
				save: "save"
			}]
		}
	);
});
