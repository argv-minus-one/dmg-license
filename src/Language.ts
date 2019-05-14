import { Labels, LanguageInfoLabels } from "./Labels";
import { LabelsByName } from "./languages";

export class Language {
	langTags: string[];
	doubleByteCharset: boolean;
	charsets: string[];
	englishName: string;
	localizedName: string;
	labels?: Labels<string | Buffer>;
	languageID: number;

	constructor(
		languageID: number,
		rawLanguage: RawLanguage,
		labelsByName: LabelsByName
	) {
		this.doubleByteCharset = rawLanguage.doubleByteCharset || false;
		this.charsets = rawLanguage.charsets;
		this.englishName = rawLanguage.englishName;
		this.langTags = rawLanguage.langTags;
		this.localizedName = rawLanguage.localizedName;
		this.languageID = languageID;

		if (rawLanguage.labels)
			this.labels = labelsByName[rawLanguage.labels];
	}

	toString() {
		return `${this.englishName} (language ${this.languageID}${this.langTags.length === 0 ? "" : `; ${this.langTags.join(", ")}`})`;
	}
}

export default Language;

export interface RawLanguage {
	charsets: string[];
	labels?: string;
	langTags: string[];
	englishName: string;
	localizedName: string;
	doubleByteCharset?: boolean;
}

export interface RawLanguageInfo {
	labels: {
		[name: string]: LanguageInfoLabels | undefined;
	};

	languages: {
		[id: string]: RawLanguage | undefined;
	};
}
