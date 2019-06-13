import * as Chai from "chai";
import ChaiBytes = require("chai-bytes");
import * as Crypto from "crypto";
import * as FS from "fs";
import { encode, transcode } from "iconv-corefoundation";
import "mocha";
import * as Path from "path";
import { PlistObject } from "plist";
import { SmartBuffer } from "smart-buffer";
import dmgLicense from "..";
import * as testLicenseSpec from "./basic-license.json";
import ignoreErrorCodes from "./util/ignoreErrorCodes";
import UDIFDeRez from "./util/UDIFDeRez";

const { assert } = Chai;
const FSP = FS.promises;

Chai.use(ChaiBytes);

describe("DMG with basic license", () => {
	const tmpDir = Path.join(__dirname, "tmp");
	const tmpDmg = Path.join(tmpDir, "basic.dmg");
	let tmpDmgProps: {
		[type: string]: PlistObject[] | undefined;
	};

	const expectedResourceIDs = ["5000", "5001", "5002", "5003", "5004"];

	before(async () => {
		await ignoreErrorCodes(FSP.mkdir(tmpDir, { mode: 0o700 }), "EEXIST");

		await ignoreErrorCodes(FSP.unlink(tmpDmg), "ENOENT");

		await FSP.copyFile(
			Path.join(__dirname, "empty.dmg"),
			tmpDmg,
			FS.constants.COPYFILE_FICLONE
		);

		await dmgLicense(tmpDmg, testLicenseSpec, {
			onNonFatalError: console.warn.bind(console),
			resolvePath(path) {
				return Path.resolve(__dirname, path);
			}
		});

		tmpDmgProps = await UDIFDeRez(tmpDmg) as any;

		assert.isObject(tmpDmgProps, "tmpDmgProps is an object");
		assert(!Buffer.isBuffer(tmpDmgProps), "tmpDmgProps is not a Buffer");

		for (const [key, value] of Object.entries(tmpDmgProps)) {
			if (typeof key !== "string")
				continue;

			assert.isArray(value, "value in tmpDmgProps is an array");
			for (const item of value!)
				assert.isObject(item, "item in tmpDmgProps.* array is an object");
		}
	});

	after(() => ignoreErrorCodes(FSP.unlink(tmpDmg), "ENOENT"));

	it("should have the correct LPic", () => {
		assert.isArray(tmpDmgProps.LPic, "there is an LPic resource");
		assert.lengthOf(tmpDmgProps.LPic!, 1, "there is only one LPic resource");

		const LPic = tmpDmgProps.LPic![0];
		const data = LPic.Data as Buffer;
		assert(Buffer.isBuffer(data));

		const expected = new SmartBuffer();
		[
			0, // default language
			5, // language count

			0, // system lang ID
			0, // resource ID
			0, // DBCS?

			8,
			1,
			0,

			1,
			2,
			0,

			0xe,
			3,
			1,

			0x4e,
			4,
			0
		].forEach(word => expected.writeUInt16BE(word));

		assert.equalBytes(data, expected.toBuffer(), "LPic resource has correct content");
	});

	it("should have the correct license text", async () => {
		assert.isArray(tmpDmgProps.TEXT, "there are TEXT resources");
		assert.strictEqual(tmpDmgProps.TEXT!.length, 5, "there are 5 TEXT resources");

		assert.sameOrderedMembers(
			tmpDmgProps.TEXT!.map(obj => obj.ID),
			expectedResourceIDs,
			"Incorrect TEXT resource IDs in generated image"
		);

		const expectedTexts = [
			transcode(
				await FSP.readFile(Path.resolve(__dirname, testLicenseSpec.body[0].file!)),
				"UTF-8",
				"x-mac-roman"
			),
			transcode(
				await FSP.readFile(Path.resolve(__dirname, testLicenseSpec.body[0].file!)),
				"UTF-8",
				"x-mac-roman"
			),
			encode(testLicenseSpec.body[1].text!, "x-mac-roman"),
			encode(testLicenseSpec.body[2].text!, "x-mac-japanese"),
			encode(testLicenseSpec.body[3].text!, "x-mac-inuit")
		];

		for (const [index, expectedText] of expectedTexts.entries()) {
			const resource = tmpDmgProps.TEXT![index];
			assert(resource, `TEXT resource ${resource.ID} is missing`);

			const actualText = resource.Data as Buffer;
			assert(Buffer.isBuffer(actualText));

			assert.equalBytes(actualText, expectedText, `TEXT resource ${resource.ID} has incorrect bytes`);
		}
	});

	it("should have the correct labels", () => {
		assert.isArray(tmpDmgProps["STR#"], "No STR# resources");
		assert.strictEqual(tmpDmgProps["STR#"]!.length, 5, "there are 5 STR# resources");

		assert.sameOrderedMembers(
			tmpDmgProps["STR#"]!.map(obj => obj.ID),
			expectedResourceIDs,
			"Incorrect STR# resource IDs in generated image"
		);

		const expectedLabelHashes = [
			"3d1882d8d5612f55624c87133417bef94904f9d2",
			"51501c2945ead42a196859248340f87448399f7e",
			"639d2570ee85a1cda3a9778f8301eb0afa1ea0cd",
			"b9c630dbe66b898c7b65aa08eb2b58d14a0e1a93",
			"70230efcc566aa38c6f70845ebbe766849689290"
		];

		for (const [index, rez] of tmpDmgProps["STR#"]!.entries()) {
			const data = rez.Data as Buffer;
			assert(Buffer.isBuffer(data));

			const sha1 = Crypto.createHash("sha1");
			sha1.update(data);
			assert.equalBytes(
				sha1.digest(),
				expectedLabelHashes[index],
				`STR# resource ${rez.ID} contains incorrect bytes`
			);
		}
	});
});
