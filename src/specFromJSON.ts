import Ajv = require("ajv");
import { LicenseSpec, Options as MainOptions } from ".";
import { PrettyVError as PrettyVError } from "./util/format-verror";

const ajv = new Ajv({
	allErrors: true,
	format: "full",
	jsonPointers: true
});

const validator = ajv.compile(require("../schema.json"));

export class BadJSONLicenseSpecError extends PrettyVError {}

export default function specFromJSON(
	spec: string | object,
	options?: FromJSONOptions
): LicenseSpec {
	if (typeof spec === "string") {
		try {
			spec = JSON.parse(spec);
		}
		catch (e) {
			if (!(e instanceof Error))
				e = new Error(e);

			throw new BadJSONLicenseSpecError(e, "JSON license specification is not well formed");
		}
	}

	const dataPath = options && options.specSourceURL || "";

	try {
		if (!validator(spec, dataPath)) {
			throw new BadJSONLicenseSpecError(
				{
					info: {
						errors: validator.errors
					}
				},
				"JSON license specification is not valid:\n· %s",
				ajv.errorsText(validator.errors, { dataVar: "", separator: "\n· " })
			);
		}
	}
	finally {
		delete ajv.errors;
		delete validator.errors;
	}

	return spec as LicenseSpec;
}

export interface FromJSONOptions extends MainOptions {
	specSourceURL?: string;
}
