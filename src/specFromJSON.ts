import Ajv = require("ajv");
import { VError } from "verror";
import { LicenseSpec, Options as MainOptions } from ".";

const ajv = new Ajv({
	allErrors: true,
	format: "full",
	jsonPointers: true
});

// tslint:disable-next-line: no-var-requires
const validator = ajv.compile(require("../schema.json"));

interface JSONLicenseSpec {
	license: LicenseSpec[];
}

export class BadJSONLicenseSpecError extends VError {}

function specFromJSON(
	spec: string | object,
	options?: specFromJSON.Options
): LicenseSpec[] {
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

	const dataVar = options && options.specSourceURL || "";

	try {
		if (!validator(spec, dataVar)) {
			throw new BadJSONLicenseSpecError(
				{
					info: {
						errors: validator.errors
					}
				},
				"JSON license specification is not valid:\n· %s",
				ajv.errorsText(validator.errors, { dataVar, separator: "\n· " })
			);
		}
	}
	finally {
		delete ajv.errors;
		delete validator.errors;
	}

	return (spec as JSONLicenseSpec).license;
}

namespace specFromJSON {
	export interface Options extends MainOptions {
		specSourceURL?: string;
	}
}

export default specFromJSON;
