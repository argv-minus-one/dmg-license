import * as FS from "fs";
import { NotRepresentableError } from "iconv-corefoundation";
import * as Path from "path";
import { pipeline, Readable } from "stream";
import Language from "./lib/Language";

function escape(s: string | null | undefined): string {
	return s ? s.replace(/['"&<>]/g, ss => {
		switch (ss) {
			case "'": return "&apos;";
			case '"': return "&quot;";
			case "&": return "&amp;";
			case "<": return "&lt;";
			case ">": return "&gt;";
			default: return ss;
		}
	}) : "";
}

const charsetLinks: { [charset: string]: string | undefined } = {
	"macintosh": "https://en.wikipedia.org/wiki/Mac_OS_Roman",
	"us-ascii": "https://en.wikipedia.org/wiki/ASCII",
	"x-mac-arabic": "https://en.wikipedia.org/wiki/MacArabic_encoding",
	"x-mac-armenian": "https://en.wikipedia.org/wiki/Mac_OS_Armenian",
	"x-mac-celtic": "https://en.wikipedia.org/wiki/Mac_OS_Celtic",
	"x-mac-centraleurroman": "https://en.wikipedia.org/wiki/Macintosh_Central_European_encoding",
	"x-mac-croatian": "https://en.wikipedia.org/wiki/Mac_OS_Croatian_encoding",
	"x-mac-cyrillic": "https://en.wikipedia.org/wiki/Mac_OS_Cyrillic_encoding",
	"x-mac-devanagari": "https://en.wikipedia.org/wiki/Mac_OS_Devanagari_encoding",
	"x-mac-farsi": "https://en.wikipedia.org/wiki/MacFarsi_encoding",
	"x-mac-gaelic": "https://en.wikipedia.org/wiki/Mac_OS_Gaelic",
	"x-mac-georgian": "https://en.wikipedia.org/wiki/Mac_OS_Georgian",
	"x-mac-greek": "https://en.wikipedia.org/wiki/MacGreek_encoding",
	"x-mac-gujarati": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/GUJARATI.TXT",
	"x-mac-gurmukhi": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/GURMUKHI.TXT",
	"x-mac-hebrew": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/HEBREW.TXT",
	"x-mac-icelandic": "https://en.wikipedia.org/wiki/Mac_OS_Icelandic_encoding",
	"x-mac-inuit": "https://en.wikipedia.org/wiki/Mac_OS_Inuit",
	"x-mac-japanese": "https://en.wikipedia.org/wiki/Shift_JIS#MacJapanese",
	"x-mac-korean": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/KOREAN.TXT",
	"x-mac-romanian": "https://en.wikipedia.org/wiki/Mac_OS_Romanian_encoding",
	"x-mac-simp-chinese": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/CHINSIMP.TXT",
	"x-mac-thai": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/THAI.TXT",
	"x-mac-trad-chinese": "https://www.unicode.org/Public/MAPPINGS/VENDORS/APPLE/CHINTRAD.TXT",
	"x-mac-turkish": "https://en.wikipedia.org/wiki/Mac_OS_Turkish_encoding",
	"x-mac-ukrainian": "https://en.wikipedia.org/wiki/Mac_OS_Ukrainian_encoding"
};

function charsetLink(charset: string): string {
	const link = charsetLinks[charset];
	return link ?
		`<a href="${escape(link)}">${escape(charset)}</a>` :
		charset;
}

function canEncodeDefaultLocalizedName(lang: Language): boolean {
	try {
		lang.charset.encode(lang.localizedName);
		return true;
	}
	catch (e) {
		if (e instanceof NotRepresentableError)
			return false;
		else
			throw e;
	}
}

class ContentGenerator extends Readable {
	_read() {
		this.push(`<!-- Generated by ../generate-supported-language-list.ts – do not edit -->

# Supported Languages

This page lists all language tags supported by the \`dmg-license\` package. These are used <a href="License%20Specifications.md#lang">at <code>body[<var>n</var>].lang</code>, <code>labels[<var>n</var>].lang</code>, and <code>rawLabels[<var>n</var>].lang</code></a> in a [license specification](License%20Specifications.md).

The “predefined labels” column indicates whether a default set of [labels](License%20Specifications.md#labelsn) is available for that language. License specifications targeting other languages must provide their own label sets for those languages.

The “requires \`languageName\`” column indicates whether a \`languageName\` label is required for that language. Normally, the \`languageName\` label is optional, but in some cases it's required, because the default isn't representable in the language's native character set. For example, the default language name of Vietnamese is “Tiếng Việt”, but that is not representable in the \`x-mac-vietnamese\` character set, so a \`languageName\` label is required for that language.

<table>
<thead>
<tr>
<th>Language name
<th>Classic Mac&nbsp;OS<br><a href="https://github.com/phracker/MacOSX-SDKs/blob/aea47c83334af9c27dc57c49ca268723ef5e6349/MacOSX10.6.sdk/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/CarbonCore.framework/Versions/A/Headers/Script.h#L285">language code</a>
<th><a href="https://en.wikipedia.org/wiki/IETF_language_tag">Language tag</a>
<th>Native character set
<th>Predefined <a href="License%20Specifications.md#labelsn">labels</a>?
<th>Requires <code>languageName</code>?
<tbody>
`);

		for (const language of Language.byID)
		if (language) {
			const rs = language.langTags.length > 1 ? ` rowspan=${language.langTags.length}` : "";

			this.push(`<tr>
<td${rs}>${escape(language.englishName)}
<td${rs}>${language.languageID}
<td>${escape(language.langTags[0])}
<td${rs}>${charsetLink(language.charset.ianaCharSetName)}
<td${rs}>${language.labels ? "Yes" : ""}
<td${rs}>${language.labels || canEncodeDefaultLocalizedName(language) ? "" : "Yes"}
`);

			for (const langTag of language.langTags.slice(1))
				this.push(`<tr>
<td>${escape(langTag)}`);
		}

		this.push(`</table>

This page was generated by [\`generate-supported-language-list.ts\`](../generate-supported-language-list.ts). Run it (or \`npm run docs\`) to rebuild.`);
		this.push(null);
	}
}

pipeline(
	new ContentGenerator(),
	FS.createWriteStream(Path.join(__dirname, "docs", "Supported Language Tags.md"), { encoding: "UTF-8" }),
	error => {
		if (error)
			console.error("Failed to write output:", error);
	}
);
