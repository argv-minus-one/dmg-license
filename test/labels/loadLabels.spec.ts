import { assert } from "chai";
import * as FS from "fs";
import { promisify } from "util";
import { Labels, LabelsSpec } from "../..";
import * as languages from "../../lib/languages";
import loadLabels from "../../lib/loadLabels";
import "../test-setup";

const readFileP = promisify(FS.readFile);

type Class<T> = (...params: never[]) => T;

describe("label loading", () => {
	let expected: Buffer;

	before(async () => expected = await readFileP(require.resolve("./test-labels-bin")));

	async function shouldLoad(spec: LabelsSpec, lang: number & keyof typeof languages.byLanguageID) {
		const loaded = await loadLabels(spec, {}, languages.byLanguageID[lang]!);
		assert.equalBytes(loaded, expected);
	}

	function shouldReject(spec: LabelsSpec, lang: number & keyof typeof languages.byLanguageID, rejectionReason: Class<Error> | string = Error) {
		return loadLabels(spec, {}, languages.byLanguageID[lang]!).then(
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
			save: "Save",
			type: "inline"
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
			save: "Save",
			type: "inline"
		},
		0
	));

	it("loads EOL-delimited labels", () => shouldLoad(
		{
			delimiters: ["eol"],
			file: require.resolve("./test-labels-delimited-eol.txt"),
			lang: 0,
			type: "delimited"
		},
		0
	));

	it("loads labels with special delimiter", () => shouldLoad(
		{
			delimiters: [Buffer.from([0xb6])],
			file: require.resolve("./test-labels-delimited-special"),
			lang: 0,
			type: "delimited"
		},
		0
	));

	it("loads one-per-file labels", () => shouldLoad(
		{
			charset: "UTF-16",
			lang: 0,
			type: "one-per-file",
			...Labels.create(key => require.resolve(`./test-labels-opf/${key}`), { includeLanguageName: true })
		},
		0
	));

	it("loads raw labels", () => shouldLoad(
		{
			file: require.resolve("./test-labels-bin"),
			lang: 0,
			type: "raw"
		},
		0
	));

	it("loads JSON labels", () => shouldLoad(
		{
			file: require.resolve("./test-labels.json"),
			lang: 0,
			type: "json"
		},
		0
	));

	it("loads encoded JSON labels", () => shouldLoad(
		{
			charset: "UTF-16",
			encoding: "base64",
			file: require.resolve("./test-labels-encoded.json"),
			lang: 0,
			type: "json"
		},
		0
	));
});
