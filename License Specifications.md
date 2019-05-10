# License Specifications

A <dfn>license specification</dfn> describes a license agreement to be attached to a disk image. The `dmg-license` command-line tool requires a JSON license specification file. (The API expects [just the `license` array, without the wrapper object](License%20Specifications%20%28API%29.md).) This information describes the license agreement to be attached to the disk image.

Disk image license agreements can be multilingual. A disk image can contain several license agreements, and macOS will show the one appropriate for the user's preferred language. Accordingly, the [`license`] property's value is an array of objects, one for each localization of the license agreement.

Here's the structure of a JSON license specification. Click a property name to see more information about it.

<pre><code>{
	"$schema"?: "https://github.com/argv-minus-one/dmg-license/raw/master/schema.json" | "<var>path/to/</var>schema.json",
	<a href="#license">"license"</a>: [
		<i>// one or more of:</i>
		{
			<a href="#licensebody">"body"</a>: {
				<a href="#licensebodytype">"type"</a>?: "text" | "rtf",

				<a href="#licensebodytext">"text"</a>: "<var>license text</var>",
				<i>// --- or ---</i>
				<a href="#licensebodyfile">"file"</a>: "<var>path/to/file</var>",

				<a href="#charset">"charset"</a>?: "native" | "UTF-8" | "<var>charset</var>",
				<a href="#encoding">"encoding"</a>?: "base64"
			},

			<a href="#licenselabels">"labels"</a>: {
				<a href="#licenselabelstype">"type"</a>: "inline" | "one-per-file" | "json" | "raw" | "delimited", <i>// default: "inline"</i>
				<a href="#licenselabelsfile">"file"</a>: "<var>path-to-file</var>",
				<a href="#licenselabelsdelimiters">"delimiters"</a>: [
					"tab" | "lf" | "cr" | "crlf" | "nul" | "eol" | [<var>bytes…</var>]
				],

				<a href="#charset">"charset"</a>?: "native" | "UTF-8" | "<var>charset</var>",
				<a href="#encoding">"encoding"</a>?: "base64"

				<a href="#licenselabelslanguagename">"languageName"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
				<a href="#licenselabelsagree-disagree-print-save">"agree"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
				<a href="#licenselabelsagree-disagree-print-save">"disagree"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
				<a href="#licenselabelsagree-disagree-print-save">"print"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
				<a href="#licenselabelsagree-disagree-print-save">"save"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
				<a href="#licenselabelsmessage">"message"</a>: "<var>label text</var>" | "<var>path/to/file</var>",
			},

			<a href="#licenselang">"lang"</a>: "<var>language tag</var>" | <var>language code</var> | ["<var>language tag</var>" | <var>language code</var>],

			<a href="#licensedefault">"default"</a>?: true | false
		}
	]
}</code></pre>

## `/license`

The actual license specification. This is an array of objects, one for each localization of the license agreement.

## `/license/*/body`

Text of the license agreement. Text can be given in two ways: inline, in the [`text`] property, or in a separate file, named by the [`file`](#licensebodyfile) property.

The [`charset`] and [`encoding`] properties contain the character set and binary encoding of the text, respectively. The default is UTF-8 with no binary encoding.

If the text is given in JSON (that is, in the [`text`] property), and either [`charset`] or [`encoding`] is specified, then both of those properties must be specified. This is because JSON is always UTF-8, so the only way to represent non-UTF-8 text in JSON is with binary encoding.

## `/license/*/body/type`

Which format the text is in: either `"plain"` (plain text) or `"rtf"` (RTF).

Default is `"plain"`, except when the [file path](#licensebodyfile) ends in `.rtf`, in which case the default is `"rtf"`.

## `/license/*/body/text`

Text of the license agreement, specified directly in JSON.

Besides literal text, this can be base64 encoded. If it is, also specify <code><a href="#encoding">"encoding"</a>: "base64"</code>, and give the character set in the [`charset`] property.

## `/license/*/body/file`

Path to the file containing the license text.

By default, the file is assumed to contain UTF-8 text with no binary encoding. To indicate otherwise, use the [`charset`] and/or [`encoding`] properties.

## `/license/*/labels`

Localized labels for the buttons on the license agreement window. There are six: [`languageName`] (optional), [`agree`](#licenselabelsagree-disagree-print-save), [`disagree`](#licenselabelsagree-disagree-print-save), [`print`](#licenselabelsagree-disagree-print-save), [`save`](#licenselabelsagree-disagree-print-save), and [`message`](#licenselabelsmessage). They may be given in the JSON configuration file, or from separate file(s).

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

## `/license/*/labels/type`

How the label strings are structured.

* When `type` is absent or `"inline"`, label strings are given directly, in the [`languageName`](#licenselabelslanguagename), [`agree`](#licenselabelsagree-disagree-print-save), [`disagree`](#licenselabelsagree-disagree-print-save), [`print`](#licenselabelsagree-disagree-print-save), [`save`](#licenselabelsagree-disagree-print-save), and [`message`] properties.

* When `type` is `"one-per-file"`, the label properties (`languageName`, [`agree`](#licenselabelsagree-disagree-print-save), [`disagree`](#licenselabelsagree-disagree-print-save), [`print`](#licenselabelsagree-disagree-print-save), [`save`](#licenselabelsagree-disagree-print-save), and [`message`] contain paths to single files, each of which contains only that label.

* When `type` is `"json"`, there must be a `file` property containing the path to an external JSON file. It must contain an object with [`languageName`] (optional), [`agree`](#licenselabelsagree-disagree-print-save), [`disagree`](#licenselabelsagree-disagree-print-save), [`print`](#licenselabelsagree-disagree-print-save), [`save`](#licenselabelsagree-disagree-print-save), [`message`] properties. They are interpreted as though `type` were `"inline"`.

* When `type` is `"raw"`, there must be a `file` property containing the path to an external file containing a classic Mac OS `STR#` data structure, as DiskImageMounter expects. The file's contents are copied into the disk image as a `STR#` resource without any sort of conversion.

* When `type` is `"delimited"`, there must be a `file` and a `delimiter` property. `file` must be the path to an external file containing five or six strings (for [`languageName`] (optional), [`agree`](#licenselabelsagree-disagree-print-save), [`disagree`](#licenselabelsagree-disagree-print-save), [`print`](#licenselabelsagree-disagree-print-save), [`save`](#licenselabelsagree-disagree-print-save), and [`message`](#licenselabelsmessage), in that order) separated by a delimiter. The `delimiter` property indicates what sequence of bytes will serve as the delimiter.

The meanings of the [`charset`] and [`encoding`] properties depend on the `type` property. The rules are:

* When `type` is absent, `"inline"`, or `"json"`, label strings are assumed to be in UTF-8, because JSON is always in UTF-8. If they are in any other character set (given with the [`charset`] property), they must be encoded (given with the [`encoding`] property).

* When `type` is `"raw"`, the [`charset`] and [`encoding`] properties must be absent.

* When `type` is `"one-per-file"` or `"delimited"`, the [`charset`] property indicates the character set of the label file(s), and defaults to UTF-8. In this case, any combination of [`charset`] and [`encoding`] (or neither) is valid.

## `/license/*/labels/file`

Path to an external file containing the label strings.

Used when `type` is `"one-per-file"`, `"json"`, `"raw"`, or `"delimited"`.

## `/license/*/labels/delimiters`

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

## `/license/*/labels/languageName`

Human-readable name of the language that this version of the license agreement is in, such as “English” or “Français”.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## `/license/*/labels/{agree, disagree, print, save}`

Label text for the “Agree” button, “Disagree” button, “Print” button, and “Save” button, respectively.

If `type` is `"one-per-file"`, this is instead the path to a file containing the label text.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## `/license/*/labels/message`

Brief instructions for the user.

For example, the English default message is: “If you agree with the terms of this license, press [`Agree`] to install the software.  If you do not agree, press [`Disagree`](#licenselabelsagree-disagree-print-save).”

If `type` is `"one-per-file"`, this is instead the path to a file containing the label text.

Used when `type` is absent, `"inline"`, or `"one-per-file"`.

## `/license/*/lang`

Which language(s) this version of the license agreement is in. Can be a language tag like `"en-US"`, a classic Mac OS language code like `0`, or an array of language tags and/or language codes.

## `/license/*/default`

If set to `true`, marks this version of the license as the default. The default version is shown by `DiskImageMounter` when there is no other version of the license that better matches the user's language preferences.

If no version of the license is marked as default, the first one is used as the default.

## [`charset`]

A character set name, as understood by the [Node.js iconv module](https://github.com/bnoordhuis/node-iconv). Case insensitive.

The special value `"native"` means the text is already in the appropriate classic Mac OS character set, and no character set conversion should be done.

## [`encoding`]

A binary encoding type. Only `"base64"` is supported.

[`license`]: #license
[`body`]: #licensebody
[`text`]: #licensebodytext
[`labels`]: #licenselabels
[`delimiters`]: #licenselabelsdelimiters
[`languageName`]: #licenselabelslanguagename
[`agree`]: #licenselabelsagree-disagree-print-save
[`disagree`]: #licenselabelsagree-disagree-print-save
[`print`]: #licenselabelsagree-disagree-print-save
[`save`]: #licenselabelsagree-disagree-print-save
[`message`]: #licenselabelsmessage
[`lang`]: #licenselang
[`default`]: #licensedefault
[`charset`]: #charset
[`encoding`]: #encoding
