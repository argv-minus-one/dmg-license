import IsMyJSONValid = require("is-my-json-valid");
import { VError } from "verror";
import { LicenseSpec } from ".";

const validator = IsMyJSONValid(
	// tslint:disable-next-line: no-var-requires
	require("../schema.json"),
	{
		greedy: true,
		verbose: true
	}
);

interface JSONLicenseSpec {
	license: LicenseSpec[];
}

export class BadJSONLicenseSpecError extends VError {}

export default function specFromJSON(
	spec: string | object
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

	try {
		if (!validator(spec)) {
			throw new BadJSONLicenseSpecError(
				"JSON license specification is not valid.\n%s", validator.errors
					.map(error => `· ${error.field} ${error.message}`)
					.join("\n")
			);
		}
	}
	finally {
		validator.errors = [];
	}

	return (spec as JSONLicenseSpec).license;
}
