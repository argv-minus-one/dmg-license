import { assert } from "chai";
import { BadJSONLicenseSpecError, BodySpec, Labels, LabelsSpec } from "..";
import specFromJSON from "../lib/specFromJSON";
import "./test-setup";

describe("dmg-license JSON schema validation", () => {
	const validBody: BodySpec[] = [{
		lang: 0,
		text: "text"
	}];

	const validInlineLabels: LabelsSpec.LabelsInline[] = [{
		agree: "agree",
		disagree: "disagree",
		lang: "en-US",
		message: "message",
		print: "print",
		save: "save"
	}];

	const validRawLabels: LabelsSpec.LabelsRaw[] = [{
		file: "foo",
		lang: "fr-FR"
	}];

	function testCase(shouldAccept: boolean, description: string, input: string | object, options?: specFromJSON.Options) {
		it(
			`${shouldAccept ? "accepts" : "rejects"} ${description}`,
			() => {
				const f = () => specFromJSON(input, {
					resolvePath: require.resolve.bind(require),
					...options
				});

				return shouldAccept
					? assert.doesNotThrow(f)
					: assert.throws(f, BadJSONLicenseSpecError);
			}
		);
	}

	testCase(false, "an empty object", {});
	testCase(false, "an empty body array", {body: []});
	testCase(false, "an empty body object", {body: [{}]});

	testCase(true, "a body with inline text", {
		body: validBody
	});

	testCase(true, "multiple bodies", {
		body: [
			{
				lang: "en-US",
				text: "Hello"
			},
			{
				lang: "fr-FR",
				text: "Bonjour"
			}
		]
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

	testCase(true, "inline and raw labels", {
		body: validBody,
		labels: validInlineLabels,
		rawLabels: validRawLabels
	});

	testCase(false, "an object with inline labels but no body", {
		labels: validInlineLabels
	});

	testCase(false, "an object with raw labels but no body", {
		rawLabels: validRawLabels
	});

	testCase(false, "an object with inline and raw labels but no body", {
		labels: validInlineLabels,
		rawLabels: validRawLabels
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

	testCase(true, "empty labels and rawLabels arrays", {
		body: validBody,
		labels: [],
		rawLabels: []
	});

	testCase(true, "an inline label set with languageName", {
		body: validBody,
		labels: [{
			agree: "agree",
			disagree: "disagree",
			lang: "en-US",
			languageName: "languageName",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	for (const missing of Labels.names.filter(name => name !== "languageName"))
	testCase(false, `an inline label set without the ${missing} property`, (() => {
		const labelsSpec: LabelsSpec = {
			agree: "agree",
			disagree: "disagree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		};
		delete labelsSpec[missing];

		return {
			body: validBody,
			labels: [labelsSpec]
		};
	})());

	testCase(false, "an incomplete inline label set", {
		body: validBody,
		labels: [{
			agree: "agree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase(false, "an inline label set with no lang", {
		body: validBody,
		labels: [{
			agree: "agree",
			disagree: "disagree",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase(false, "a raw label set with no file", {
		body: validBody,
		rawLabels: [{
			lang: 0
		}]
	});

	testCase(false, "a raw label set with no lang", {
		body: validBody,
		rawLabels: [{
			file: "foo"
		}]
	});
});
