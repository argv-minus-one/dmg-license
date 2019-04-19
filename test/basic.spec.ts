import * as Chai from "chai";
import ChaiBytes = require("chai-bytes");
import * as Crypto from "crypto";
import * as FS from "fs";
import { Iconv } from "iconv";
import "mocha";
import * as Path from "path";
import { PlistObject } from "plist";
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
		assert.equalBytes(data, [0, 0, 0, 1, 0, 0, 0, 0, 0, 0], "LPic resource has correct content");
	});

	it("should have the correct license text", async () => {
		assert.isArray(tmpDmgProps.TEXT, "there are TEXT resources");
		assert.isAtLeast(tmpDmgProps.TEXT!.length, 1, "there are TEXT resources");

		const expectedText = new Iconv("UTF-8", "MacRoman").convert(
			await FSP.readFile(Path.resolve(__dirname, "basic-license.txt"))
		);

		const actualText = tmpDmgProps.TEXT![0].Data as Buffer;
		assert(Buffer.isBuffer(actualText));
		assert.equalBytes(actualText, expectedText, "TEXT resource has the expected bytes");
	});

	it("should have the correct labels", () => {
		assert.isArray(tmpDmgProps["STR#"], "there are STR# resources");
		assert.isAtLeast(tmpDmgProps["STR#"]!.length, 1, "there are STR# resources");

		const data = tmpDmgProps["STR#"]![0].Data as Buffer;
		assert(Buffer.isBuffer(data));

		const sha1 = Crypto.createHash("sha1");
		sha1.update(data);
		assert.equalBytes(
			sha1.digest(),
			"3d1882d8d5612f55624c87133417bef94904f9d2",
			"STR# resource contains correct bytes"
		);
	});
});
