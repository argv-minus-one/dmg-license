import * as Plist from "plist";
import { PlistObject } from "plist";
import assembleLicenses from "./assembleLicenses";
import BodySpec from "./BodySpec";
import Context from "./Context";
import { Labels, LabelsSpec, NoLabels } from "./Labels";
import { LangSpec, LangSpecs, Localization } from "./Language";
import makeLicensePlist from "./makeLicensePlist";
import specFromJSON, { FromJSONOptions } from "./specFromJSON";
import writePlistToDmg from "./writePlistToDmg";

export { Language } from "./Language";
export { BadJSONLicenseSpecError } from "./specFromJSON";
export { FromJSONOptions, Labels, NoLabels, BodySpec, LabelsSpec, LangSpec, LangSpecs, Localization };
export { LabelEncodingError, NoDefaultLabelsError } from "./Labels";

export interface LicenseSpec {
	body: BodySpec[];
	labels?: LabelsSpec.LabelsInline[];
	rawLabels?: LabelsSpec.LabelsRaw[];
	defaultLang?: LangSpec;
}

export interface Options {
	resolvePath?(path: string): string;
	onNonFatalError?(error: Error): void;
}

export async function dmgLicense(imagePath: string, spec: LicenseSpec, options: Options): Promise<void> {
	return await writePlistToDmg(imagePath, (await dmgLicensePlist(spec, options)).plist);
}
export default dmgLicense;

export async function dmgLicensePlist(spec: LicenseSpec, options: Options): Promise<{
	plist: PlistObject;
	plistText: string;
}> {
	const context = new Context(options);

	const plist = makeLicensePlist(
		await assembleLicenses(spec, context),
		context
	);

	return {
		plist,
		get plistText() {
			return Plist.build(plist);
		}
	};
}

export async function dmgLicenseFromJSON(imagePath: string, specJSON: string | object, options: FromJSONOptions) {
	return await dmgLicense(imagePath, specFromJSON(specJSON, options), options);
}

export async function dmgLicensePlistFromJSON(specJSON: string | object, options: FromJSONOptions) {
	return await dmgLicensePlist(specFromJSON(specJSON, options), options);
}
