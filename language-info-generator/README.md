This stuff is used to generate `../language-info.json`. You don't need it in order to use dmg-license; it's only of use if you want to regenerate that JSON file.

## `SLAResources`

This program uses, as input, a file published by Apple and made available on their developer website. To obtain this file, you'll need an Apple developer account. Once you do:

1. Go to <https://developer.apple.com/downloads/>
2. Download the file entitled “Software Licensing for UDIF”.
3. It's a disk image; mount it. On my system, it mounts to `/Volumes/SLAs_for_UDIFs_1.0`.
4. You'll find the `SLAResources` file on the mounted volume.

The file is empty, but its resource fork contains a set of localized strings that appear on the license agreement window: “Agree”, “Disagree”, and so on. In order for a disk image created by node-appdmg to present a license agreement, it must contain these strings as well as the text of the license agreement.

## Java

Besides Node.js and npm, this program also requires a Java JDK, version 7 or later. See the section “GetLanguageNames.java” below for details.

## Usage

This program is invoked by the npm script `regenerate-language-info`. To run it:

```
npm run regenerate-language-info
```

This expects the `SLAResources` file to be located at `/Volumes/SLAs_for_UDIFs_1.0/SLAResources`. If it is located elsewhere, set the environment variable `SLAResources` to the correct path, like so:

```
SLAResources=/path/to/SLAResources npm run regenerate-language-info
```

## Files

### [language-info-generator.ts]

TypeScript program that generates the contents of `../language-info.json`, using data from:

* `Languages.tsv`
* `Language names.tsv`
* `SLAResources`

Output is written to `stdout`.

### [Languages.tsv]

Table of Classic Mac OS language IDs and associated information. Modern macOS (aka Mac OS X) does not use them directly, but the `DiskImageMounter` still uses them to look up the correct localized license text.

The first row is a header. Columns are as follows:

1. Mac OS language name, as it appears in [`Script.h` in `CarbonCore.framework`](https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.6.sdk/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/CarbonCore.framework/Versions/A/Headers/Script.h). Each localization of Classic Mac OS has one of these.

2. Numeric language ID corresponding to the language name. It also appears in `Script.h`. This is what `DiskImageMounter` looks up by.

3. Applicable languages: a comma-separated list of language tags that map to this Mac OS language ID. These mostly come from comments in `Script.h`, but some adjustments have been made by hand.

4. Display name language: a single language tag. [GetLanguageNames.java] looks up each language's display name from this.

5. Character sets: a comma-separated list of character set encodings. These are given to the [iconv](https://www.npmjs.com/package/iconv) module to transcode from UTF-8 (or any other character set encoding) to the native character set of this Mac OS localization.

6. Comment.

7. ID of the `STR#` resource in the `SLAResources` file.

   There are only `STR#` resources for a handful of languages, so this column is blank on most rows.

### [Language name overrides.tsv]

Table of display names for the languages in [Languages.tsv]. Display names are normally looked up using [GetLanguageNames.java]. This file allows the display names to be overridden.

The first row is a header. Columns are:

1. Mac OS language ID. Same as the second column of [Languages.tsv].

2. `englishName` for this language. If blank, the name will be looked up as normal.

3. `localizedName` for this language. If blank, the name will be looked up as normal.

### [GetLanguageNames.java]

A simple Java program that looks up display names for languages. It's written in Java because Java happens to have a good API for getting language display names, and Node.js seems not to. The TypeScript program will automatically compile and run this Java program in a subprocess.

You need at least JDK 7 to compile and run it, but more recent JDKs come with more recent locale information, so you should use the latest JDK.

As input, it takes language tags, one per line. The output is a table of languages and their display names, in TSV format. The first row is a header. Columns are:

1. Language tag. This corresponds to the fourth column (display name language) in [Languages.tsv].

2. English display name of the language.

3. Display name of the language in that language (e.g. “Deutsch” for German).

[language-info-generator.ts]: language-info-generator.ts
[Languages.tsv]: Languages.tsv
[GetLanguageNames.java]: GetLanguageNames.java
[OpenJDK]: https://jdk.java.net
[Language name overrides.tsv]: Language%20name%20overrides.tsv
