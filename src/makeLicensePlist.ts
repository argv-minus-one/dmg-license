import { PlistObject } from "plist";
import { SmartBuffer } from "smart-buffer";
import Context from "./Context";
import LicenseContent from "./LicenseContent";

export default function makeLicensePlist(
	content: LicenseContent,
	context: Context
): PlistObject {
	const ret = {
		"LPic": [] as PlistObject[],
		"RTF ": [] as PlistObject[],
		"STR#": [] as PlistObject[],
		"TEXT": [] as PlistObject[]
	};

	// Assemble resources.
	for (const [index, item] of content.inOrder.entries()) {
		const ID = String(index + 5000);
		const Name = item.langs[0].englishName;

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
		const buf = SmartBuffer.fromSize(4 + (6 * content.inOrder.length));

		// LPic header
		// The first field is the default language ID.
		buf.writeInt16BE(content.defaultRegionCode);

		// The second field is the count of language ID to license resource mappings.
		buf.writeUInt16BE(content.byRegionCode.size);

		// Next is the list of resource ID mappings.
		for (const [regionCode, item] of content.byRegionCode.entries()) {
			// Mapping field 1: system language ID
			buf.writeInt16BE(regionCode);

			// Mapping field 2: local resource ID minus 5000
			buf.writeInt16BE(content.inOrder.indexOf(item));

			// Mapping field 3: 2-byte language?
			// TODO: Figure out how modern macOS interprets this flag.
			buf.writeInt16BE(0);
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
