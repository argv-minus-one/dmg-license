import { assert } from "chai";
import * as FS from "fs";
import { promisify } from "util";
import { Labels, LabelsSpec } from "../../lib";
import { LabelEncodingError } from "../../lib/Labels";
import Language from "../../lib/Language";
import "../test-setup";

const readFileP = promisify(FS.readFile);

type Class<T> = new (...params: never[]) => T;

describe("label loading", () => {
	let expected: Buffer;

	before(async () => expected = await readFileP(require.resolve("./test-labels-bin")));

	async function shouldLoad(spec: LabelsSpec, lang: number) {
		const loaded = await Labels.prepareSpec(spec, Language.byID[lang]!, {});
		assert.equalBytes(loaded, expected);
	}

	function shouldReject(spec: LabelsSpec, lang: number, rejectionReason: Class<Error> | string = Error) {
		return Labels.prepareSpec(spec, Language.byID[lang]!, {}).then(
			success => assert.fail<unknown>(success, rejectionReason, "expected promise to be rejected with #{exp} but it was fulfilled with #{act}"),
			rejection => {
				if (typeof rejectionReason === "string")
					assert.strictEqual(rejection && rejection.code, rejectionReason, "expected promise to be rejected with code #{exp} but it was rejected with code #{act}");
				else
					assert.instanceOf(rejection, rejectionReason, "expected promise to be rejected with #{exp} but it was rejected with #{act}");
			}
		);
	}

	it("loads inline labels", () => shouldLoad(
		{
			agree: "Ãgree",
			disagree: "Disagree",
			lang: 0,
			languageName: "Language Name",
			message: "Message",
			print: "Print",
			save: "Save"
		},
		0
	));

	it("rejects unrepresentable labels", () => shouldReject(
		{
			agree: "Ãgree",
			disagree: "💩",
			lang: 0,
			languageName: "Language Name",
			message: "Message",
			print: "Print",
			save: "Save"
		},
		0,
		LabelEncodingError
	));

	it("loads raw labels", () => shouldLoad(
		{
			file: require.resolve("./test-labels-bin"),
			lang: 0
		},
		0
	));
});
