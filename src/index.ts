import Context from "./Context";
import LicenseContent from "./LicenseContent";
import makeLicensePlist from "./makeLicensePlist";
import { LicenseSpec } from "./spec";
import writePlistToDmg from "./writePlistToDmg";

export { Labels, NoLabels } from "./Labels";
export { BodySpec, LabelsSpec, LicenseSpec } from "./spec";

export interface Options {
	resolvePath?(path: string): string;
	onNonFatalError?(error: Error): void;
}

export default async function dmgLicense(imagePath: string, specs: LicenseSpec[], options: Options): Promise<void> {
	const context = new Context(options);

	await writePlistToDmg(
		imagePath,
		makeLicensePlist(
			await LicenseContent.load(specs, context),
			context
		)
	);
}
