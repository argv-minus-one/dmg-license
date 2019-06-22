import * as Chai from "chai";
import * as ChaiAsPromised from "chai-as-promised";
import "mocha";
import { inspect } from "util";
import { dmgLicensePlistFromJSON } from "..";
import { BadJSONLicenseSpecError } from "../lib/specFromJSON";

const { assert } = Chai;

Chai.use(ChaiAsPromised);

describe("dmgLicensePlistFromJSON", () => {
	function testCase(description: string, input: string | object) {
		it(
			description,
			() => assert.isRejected(dmgLicensePlistFromJSON(input, {}), BadJSONLicenseSpecError)
		);
	}

	testCase("rejects an empty object", {});
	testCase("rejects an empty body array", {
		body: []
	});
	testCase("rejects an empty body object", {
		body: [{}]
	});

	testCase("rejects an object with labels but no body", {
		labels: [{
			agree: "agree",
			disagree: "disagree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase("rejects a body with no lang", {
		body: [{
			text: "text"
		}]
	});

	testCase("rejects a body with no text or file", {
		body: [{
			lang: "en-US"
		}]
	});

	for (const lang of [false, null, undefined, -1, 0.5, NaN, Infinity, {}, [false], []]) testCase(
		`rejects a body with lang: ${inspect(lang, {compact: true})}`,
		{
			body: [{
				lang,
				text: "text"
			}]
		}
	);

	testCase("rejects an empty labels array", {
		body: [{
			text: "text"
		}],
		labels: []
	});

	testCase("rejects an empty labels object", {
		body: [{
			text: "text"
		}],
		labels: [{}]
	});

	testCase("rejects an incomplete label set", {
		body: [{
			text: "text"
		}],
		labels: [{
			agree: "agree",
			lang: "en-US",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	testCase("rejects a label set with no lang", {
		body: [{
			text: "text"
		}],
		labels: [{
			agree: "agree",
			disagree: "disagree",
			message: "message",
			print: "print",
			save: "save"
		}]
	});

	for (const lang of [false, null, undefined, -1, 0.5, NaN, Infinity, {}, [false], []]) testCase(
		`rejects a label set with lang: ${inspect(lang, {compact: true})}`,
		{
			body: [{
				lang: "en-US",
				text: "text"
			}],
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
