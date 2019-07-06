# License Specifications

A <dfn>license specification</dfn> describes a license agreement to be attached to a disk image.

Disk image license agreements can be multilingual. A disk image can contain several license agreements, and macOS will show the one appropriate for the user's preferred language. Accordingly, a license specification can have more than one `body`, one for each language.

Here's the structure of a license specification. Click a property name to see more information about it.

<pre><code>{
	"$schema"?: "https://github.com/argv-minus-one/dmg-license/raw/master/schema.json" | "<var>path/to/</var>schema.json",

	<a href="#bodyn">"body"</a>: [
		{
			<a href="#lang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],
			<a href="#bodyntype">"type"</a>?: "plain" | "rtf",

			<a href="#bodyntext">"text"</a>: "<var>license text</var>",
			<i>// --- or ---</i>
			<a href="#bodynfile">"file"</a>: "<var>path/to/file</var>",
			<a href="#charset">"charset"</a>?: "UTF-8" | "<var>charset</var>",
		}
	],

	<a href="#labelsn">"labels"</a>?: [
		{
			<a href="#lang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],
			<a href="#labelsnlanguagename">"languageName"</a>?: "<var>label text</var>",
			<a href="#labelsnagree-disagree-print-save">"agree"</a>: "<var>label text</var>",
			<a href="#labelsnagree-disagree-print-save">"disagree"</a>: "<var>label text</var>",
			<a href="#labelsnagree-disagree-print-save">"print"</a>: "<var>label text</var>",
			<a href="#labelsnagree-disagree-print-save">"save"</a>: "<var>label text</var>",
			<a href="#labelsnmessage">"message"</a>: "<var>label text</var>",
		}
	],

	<a href="#rawlabelsn">"rawLabels"</a>?: [
		{
			<a href="#lang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],
			<a href="#rawlabelsnfile">"file"</a>: "<var>path-to-file</var>"
		}
	],

	<a href="#defaultlang">"defaultLang"</a>?: "<var>language tag</var>" | <var>language code</var>
}</code></pre>

## <code>body[<var>n</var>]</code>

Text of the license agreement. Text can be given in two ways: inline, in the [`text`] property, or in a separate file, named by the [`file`](#bodynfile) property.

## <code>body[<var>n</var>].type</code>

Which format the text is in: either `"plain"` (plain text) or `"rtf"` (RTF).

Default is `"plain"`, except when the [file path](#bodynfile) (that is, the value of the `file` property) ends in `.rtf`, in which case the default is `"rtf"`.

## <code>body[<var>n</var>].text</code>

Text of the license agreement, specified directly in JSON.

Besides literal text, this can be base64 encoded. If it is, also specify <code><a href="#encoding">"encoding"</a>: "base64"</code>, and give the character set in the [`charset`] property.

## <code>body[<var>n</var>].file</code>

Path to the file containing the license text.

By default, the file is assumed to contain UTF-8 text with no binary encoding. To indicate otherwise, use the [`charset`] and/or [`encoding`] properties.

## <code>labels[<var>n</var>]</code>

Localized labels for the buttons on the license agreement window. There are six: [`languageName`] (optional), [`agree`], [`disagree`], [`print`], [`save`], and [`message`].

Some languages have a default set of labels that will be used if none are provided here, but for all other languages, a set of labels must be provided. Default label sets are available for:

* `en-US`
* `fr-FR`
* `en-GB`
* `de-DE`
* `it-IT`
* `nl-NL`
* `sv-SE`
* `es-ES`
* `da-DK`
* `fr-CA`
* `nb-NO`
* `ja-JP`
* `fi-FI`
* `ko-KR`
* `zh-CN`
* `zh-TW`
* `zh-Hans`
* `zh-Hant`
* `pt-BR`

## <code>labels[<var>n</var>].languageName</code>

Human-readable name of the language that this version of the license agreement is in, such as “English” or “Français”.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## <code>labels[<var>n</var>].agree</code>, `.disagree`, `.print`, `.save`

Label text for the “Agree” button, “Disagree” button, “Print” button, and “Save” button, respectively.

If `type` is `"one-per-file"`, this is instead the path to a file containing the label text.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## <code>labels[<var>n</var>].message</code>

Brief instructions for the user.

For example, the English default message is: “If you agree with the terms of this license, press [Agree][`agree`] to install the software.  If you do not agree, press [Disagree][`disagree`].”

If `type` is `"one-per-file"`, this is instead the path to a file containing the label text.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## <code>rawLabels[<var>n</var>]</code>

Localized labels for the buttons on the license agreement window, as with the [`labels`] property, but in raw format.

Instead of plain JSON strings, label sets provided this way are stored in binary files, whose contents (data fork) are copied into the disk image as a `STR#` resource with no parsing or character set conversion. They must be in [the format that DiskImageMounter expects](Raw%20labels%20format.md).

## <code>rawLabels[<var>n</var>].file</code>

Path to the file containing the label strings.

## `lang`

Which language(s) this `body`, `labels`, or `rawLabels` is in. Can be an [IETF language tag](https://en.wikipedia.org/wiki/IETF_language_tag) like `"en-US"`, a classic Mac OS language code like `0`, or an array of language tags and/or language codes.

Only a certain set of language tags are recognized. See [`Supported Language Tags.md`](Supported%20Language%20Tags.md) for the full list.

## `defaultLang`

Selects which language should be the default, if there is no license localization for the user's preferred language.

If this property is omitted, the first `lang` of the first `body` is used as the default.

## `charset`

An IANA character set name, as understood by the Core Foundation framework. Case insensitive.

[`body`]: #bodyn
[`text`]: #bodyntext
[`labels`]: #labelsn
[`rawLabels`]: #rawlabelsn
[`delimiters`]: #labelsndelimiters
[`languageName`]: #labelsnlanguagename
[`agree`]: #labelsnagree-disagree-print-save
[`disagree`]: #labelsnagree-disagree-print-save
[`print`]: #labelsnagree-disagree-print-save
[`save`]: #labelsnagree-disagree-print-save
[`message`]: #labelsnmessage
[`lang`]: #lang
[`defaultLang`]: #defaultLang
[`charset`]: #charset
