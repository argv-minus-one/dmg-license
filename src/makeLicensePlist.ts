import { PlistObject } from "plist";
import { SmartBuffer } from "smart-buffer";
import { AssembledLicenseSet } from "./assembleLicenses";
import Context from "./Context";
import Language from "./Language";

export default function makeLicensePlist(
	licenses: AssembledLicenseSet,
	context: Context
): PlistObject {
	const ret = {
		"LPic": [] as PlistObject[],
		"RTF ": [] as PlistObject[],
		"STR#": [] as PlistObject[],
		"TEXT": [] as PlistObject[]
	};

	// Assemble resources.
	for (const [index, item] of licenses.inOrder.entries()) {
		const ID = String(index + 5000);
		const Name = Language.byID[item.languageIDs[0]]!.englishName;

		ret["STR#"].push({
			Attributes: "0x0000",
			Data: item.labels,
			ID,
			Name
		});

		ret[item.body.type].push({
			Attributes: "0x0000",
			Data: item.body.data,
			ID,
			Name: `${Name} SLA`
		});
	}

	// Remove empty keys.
	for (const prop of ["RTF ", "TEXT"] as Array<keyof typeof ret>)
	if (!ret[prop].length)
		delete ret[prop];

	// Generate LPic.
	{
		const buf = SmartBuffer.fromSize(4 + (6 * licenses.inOrder.length));

		// LPic header
		// The first field is the default language ID.
		buf.writeInt16BE(licenses.defaultLanguageID);

		// The second field is the count of language ID to license resource mappings.
		buf.writeUInt16BE(licenses.byLanguageID.size);

		// Next is the list of resource ID mappings.
		for (const [languageID, item] of licenses.byLanguageID.entries()) {
			// Mapping field 1: system language ID
			buf.writeInt16BE(languageID);

			// Mapping field 2: local resource ID minus 5000
			buf.writeInt16BE(licenses.inOrder.indexOf(item));

			// Mapping field 3: 2-byte language?
			// TODO: Figure out how modern macOS interprets this flag.
			buf.writeInt16BE(Language.byID[languageID]!.doubleByteCharset ? 1 : 0);
		}

		ret.LPic.push({
			Attributes: "0x0000",
			Data: buf.toBuffer(),
			ID: "5000",
			Name: ""
		});
	}

	return ret;
}
