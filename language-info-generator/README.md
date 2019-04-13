This stuff is used to generate `../language-info.json`. You don't need it in order to use dmg-license; it's only of use if you want to regenerate that JSON file.

## `SLAResources`

This program uses, as input, a file published by Apple and made available on their developer website. To obtain this file, you'll need an Apple developer account. Once you do:

1. Go to <https://developer.apple.com/downloads/>
2. Download the file entitled “Software Licensing for UDIF”.
3. It's a disk image; mount it. On my system, it mounts to `/Volumes/SLAs_for_UDIFs_1.0`.
4. You'll find the `SLAResources` file on the mounted volume.

The file is empty, but its resource fork contains a set of localized strings that appear on the license agreement window: “Agree”, “Disagree”, and so on. In order for a disk image created by node-appdmg to present a license agreement, it must contain these strings as well as the text of the license agreement.

## Usage

### Regenerate `Language names.tsv`

Install the latest [OpenJDK] (or some other JDK ≥ 7), if you haven't already. Then run:

```
./generate-language-names.sh
```

### Regenerate `license/languages.json`

As described above, you need to point the program to the `SLAResources` file. Then run:

```
npm install
npx ts-node gen-lang-json.ts /path/to/SLAResources >../lib/license/languages.json
```

Note that `npm install` has to be run separately for license-languages-generator, because its dependencies are different from those of the main node-appdmg project.

## Files

### [gen-lang-json.ts]

TypeScript program that generates the contents of `../lib/license-locales.json`, using data from:

* `Locales.tsv`
* `Language names.tsv`
* `SLAResources`

It takes one command-line parameter: the path to `SLAResources`.

Output is written to `stdout`.

### [Locales.tsv]

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

### [GetLanguageNames.java]

A simple Java program that looks up display names for languages. It's written in Java because Java happens to have a good API for getting language display names, and Node.js seems not to.

Output is as described under Languge names.tsv.

You need at least JDK 7 to compile and run it, but more recent JDKs come with more recent locale information, so you should use the latest JDK.

### [generate-language-names.sh]

A shell script that generates [Language names.tsv]. It extracts language tags from [Locales.tsv], feeds them to [GetLanguageNames.java], and writes the output to [Language names.tsv]. It compiles [GetLanguageNames.java] if necessary.

### [Language names.tsv]

Table of languages and their display names, in TSV format. The first row is a header. Columns are:

1. Language tag. This corresponds to the fourth column (display name language) in [Locales.tsv].

2. English display name of the language.

3. Display name of the language in that language (e.g. “Deutsch” for German).

[gen-lang-json.ts]: gen-lang-json.ts
[Locales.tsv]: Locales.tsv
[GetLanguageNames.java]: GetLanguageNames.java
[generate-language-names.sh]: generate-language-names.sh
[Language names.tsv]: Language%20names.tsv
[OpenJDK]: https://jdk.java.net
