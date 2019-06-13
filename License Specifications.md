# License Specifications

A <dfn>license specification</dfn> describes a license agreement to be attached to a disk image.

Disk image license agreements can be multilingual. A disk image can contain several license agreements, and macOS will show the one appropriate for the user's preferred language. Accordingly, a license specification can have more than one `body`, one for each language.

Here's the structure of a license specification. Click a property name to see more information about it.

<pre><code>{
	"$schema"?: "https://github.com/argv-minus-one/dmg-license/raw/master/schema.json" | "<var>path/to/</var>schema.json",
	<a href="#bodyn">"body"</a>: [
		{
			<a href="#bodynlang-labelsnlang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],
			<a href="#bodyntype">"type"</a>?: "text" | "rtf",

			<a href="#bodyntext">"text"</a>: "<var>license text</var>",
			<i>// --- or ---</i>
			<a href="#bodynfile">"file"</a>: "<var>path/to/file</var>",

			<a href="#charset">"charset"</a>?: "UTF-8" | "<var>charset</var>",
			<a href="#encoding">"encoding"</a>?: "base64"
		}
	],

	<a href="#labelsn">"labels"</a>: [
		{
			<a href="#bodynlang-labelsnlang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],
			<a href="#labelsntype">"type"</a>: "inline" | "one-per-file" | "json" | "raw" | "delimited", <i>// default: "inline"</i>
			<a href="#labelsnfile">"file"</a>: "<var>path-to-file</var>",
			<a href="#labelsndelimiters">"delimiters"</a>: [
				"tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | [<var>bytes…</var>]
			],

			<a href="#charset">"charset"</a>?: "native" | "UTF-8" | "<var>charset</var>",
			<a href="#encoding">"encoding"</a>?: "base64"

			<a href="#labelsnlanguagename">"languageName"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			<a href="#labelsnagree-disagree-print-save">"agree"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			<a href="#labelsnagree-disagree-print-save">"disagree"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			<a href="#labelsnagree-disagree-print-save">"print"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			<a href="#labelsnagree-disagree-print-save">"save"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			<a href="#labelsnmessage">"message"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
		}
	],

	<a href="#defaultlang">"defaultLang"</a>?: "<var>language tag</var>" | <var>language code</var>
}</code></pre>

## <code>body[<var>n</var>]</code>

Text of the license agreement. Text can be given in two ways: inline, in the [`text`] property, or in a separate file, named by the [`file`](#bodynfile) property.

The [`charset`] and [`encoding`] properties contain the character set and binary encoding of the text, respectively. The default is UTF-8 with no binary encoding.

If the text is given in JSON (that is, in the [`text`] property), and either [`charset`] or [`encoding`] is specified, then both of those properties must be specified. This is because JSON is always UTF-8, so the only way to represent non-UTF-8 text in JSON is with binary encoding.

## <code>body[<var>n</var>].type</code>

Which format the text is in: either `"plain"` (plain text) or `"rtf"` (RTF).

Default is `"plain"`, except when the [file path](#bodynfile) ends in `.rtf`, in which case the default is `"rtf"`.

## <code>body[<var>n</var>].text</code>

Text of the license agreement, specified directly in JSON.

Besides literal text, this can be base64 encoded. If it is, also specify <code><a href="#encoding">"encoding"</a>: "base64"</code>, and give the character set in the [`charset`] property.

## <code>body[<var>n</var>].file</code>

Path to the file containing the license text.

By default, the file is assumed to contain UTF-8 text with no binary encoding. To indicate otherwise, use the [`charset`] and/or [`encoding`] properties.

## <code>labels[<var>n</var>]</code>

Localized labels for the buttons on the license agreement window. There are six: [`languageName`] (optional), [`agree`], [`disagree`], [`print`], [`save`], and [`message`]. They may be given in the JSON configuration file, or from separate file(s).

The [`charset`] and [`encoding`] properties control the character set and binary encoding of the label strings or file(s). Their exact meaning depends on the `type` property.

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

## <code>labels[<var>n</var>].type</code>

How the label strings are structured.

* When `type` is absent or `"inline"`, label strings are given directly, in the [`languageName`], [`agree`], [`disagree`], [`print`], [`save`], and [`message`] properties.

* When `type` is `"one-per-file"`, the label properties ([`languageName`], [`agree`], [`disagree`], [`print`], [`save`], and [`message`] contain paths to single files, each of which contains only that label.

* When `type` is `"json"`, there must be a `file` property containing the path to an external JSON file. It must contain an object with [`languageName`] (optional), [`agree`], [`disagree`], [`print`], [`save`], and [`message`] properties. They are interpreted as though `type` were `"inline"`.

* When `type` is `"raw"`, there must be a `file` property containing the path to an external file containing a classic Mac OS `STR#` data structure, as DiskImageMounter expects. The file's contents are copied into the disk image as a `STR#` resource without any sort of conversion.

* When `type` is `"delimited"`, there must be a `file` and a `delimiter` property. `file` must be the path to an external file containing five or six strings (for [`languageName`] (optional), [`agree`], [`disagree`], [`print`], [`save`], and [`message`], in that order) separated by a delimiter. The `delimiter` property indicates what sequence of bytes will serve as the delimiter.

The meanings of the [`charset`] and [`encoding`] properties depend on the `type` property. The rules are:

* When `type` is absent, `"inline"`, or `"json"`, label strings are assumed to be in UTF-8, because JSON is always in UTF-8. If they are in any other character set (given with the [`charset`] property), they must be encoded (given with the [`encoding`] property).

* When `type` is `"raw"`, the [`charset`] and [`encoding`] properties must be absent.

* When `type` is `"one-per-file"` or `"delimited"`, the [`charset`] property indicates the character set of the label file(s), and defaults to UTF-8. In this case, any combination of [`charset`] and [`encoding`] (or neither) is valid.

## <code>labels[<var>n</var>].file</code>

Path to an external file containing the label strings.

Used when `type` is `"one-per-file"`, `"json"`, `"raw"`, or `"delimited"`.

## <code>labels[<var>n</var>].delimiters</code>

Sequences of bytes that will be interpreted as delimiter strings.

Each item in this array may be either an array of bytes (given as numbers between 0 and 255), or one of the following shorthands:

* `"tab"`: `[9]` (an ASCII tab character)
* `"lf"`: `[10]` (an ASCII line feed character)
* `"cr"`: `[13]` (an ASCII carriage return character)
* `"crlf"`: `[13, 10]` (an ASCII CR+LF pair)
* `"nul"`: `[0]` (a zero byte)
* `"eol"`: any line ending (LF, CR, or CR+LF)

If the [`encoding`] property is also specified, delimiters must not be encoded. They must occur literally in the file.

Used when `type` is `"delimited"`.

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

## <code>body[<var>n</var>].lang</code>, <code>labels[<var>n</var>].lang</code>

Which language(s) this `body` or `labels` is in. Can be an [IETF language tag](https://en.wikipedia.org/wiki/IETF_language_tag) like `"en-US"`, a classic Mac OS language code like `0`, or an array of language tags and/or language codes.

## `defaultLang`

Selects which language should be the default, if there is no license localization for the user's preferred language.

If this property is omitted, the first `lang` of the first `body` is used as the default.

## `charset`

An IANA character set name, as understood by the Core Foundation framework. Case insensitive.

## `encoding`

A binary encoding type. Only `"base64"` is supported.

[`body`]: #bodyn
[`text`]: #bodyntext
[`labels`]: #labelsn
[`delimiters`]: #labelsndelimiters
[`languageName`]: #labelsnlanguagename
[`agree`]: #labelsnagree-disagree-print-save
[`disagree`]: #labelsnagree-disagree-print-save
[`print`]: #labelsnagree-disagree-print-save
[`save`]: #labelsnagree-disagree-print-save
[`message`]: #labelsnmessage
[`lang`]: #bodynlang-labelsnlang
[`defaultLang`]: #defaultLang
[`charset`]: #charset
[`encoding`]: #encoding
