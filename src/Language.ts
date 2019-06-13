import { StringEncoding, UnrecognizedEncodingError } from "iconv-corefoundation";
import { Labels, LanguageInfoLabels } from "./Labels";
import { LabelsByName } from "./languages";

export class Language {
	langTags: string[];
	doubleByteCharset: boolean;
	charset: StringEncoding;
	englishName: string;
	localizedName: string;
	labels?: Labels;
	languageID: number;

	constructor(
		languageID: number,
		rawLanguage: RawLanguage,
		labelsByName: LabelsByName,
		charsetCache: Map<string, StringEncoding | UnrecognizedEncodingError>
	) {
		this.doubleByteCharset = rawLanguage.doubleByteCharset || false;
		this.englishName = rawLanguage.englishName;
		this.langTags = rawLanguage.langTags;
		this.localizedName = rawLanguage.localizedName;
		this.languageID = languageID;

		if (rawLanguage.labels)
			this.labels = labelsByName[rawLanguage.labels];

		{
			let charset = charsetCache.get(rawLanguage.charset);

			if (!charset) {
				try {
					charset = StringEncoding.byIANACharSetName(rawLanguage.charset);
				}
				catch (e) {
					if (e instanceof UnrecognizedEncodingError)
						charset = e;
					else
						throw e;
				}
				charsetCache.set(rawLanguage.charset, charset);
			}

			if (charset instanceof UnrecognizedEncodingError)
				throw charset;
			else
				this.charset = charset;
		}
	}

	toString() {
		return `${this.englishName} (language ${this.languageID}${this.langTags.length === 0 ? "" : `; ${this.langTags.join(", ")}`})`;
	}
}

export default Language;

export interface RawLanguage {
	charset: string;
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
