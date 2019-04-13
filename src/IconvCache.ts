import { Iconv } from "iconv";
import { VError } from "verror";
import Language from "./Language";

const cacheStore = Symbol();

class IconvCache {
	private [cacheStore]: {
		[from: string]: undefined | {
			[to: string]: Iconv | Error | undefined;
		};
	} = {};

	get(from: string, to: string): Iconv | Error {
		let cacheFrom = this[cacheStore][from];
		if (cacheFrom === undefined)
			this[cacheStore][from] = cacheFrom = {};

		let iconv = cacheFrom[to];

		if (iconv === undefined) {
			try {
				iconv = new Iconv(from, to);
			}
			catch (e) {
				iconv = e instanceof Error ? e : new Error(e);
			}

			cacheFrom[to] = iconv;
		}

		return iconv;
	}

	/**
	 * Encodes `chars` into a character set supported by all of the `langs`.
	 *
	 * @param chars - The text to convert. Either a plain string, or a `Buffer` and the name of its character set.
	 * @param langs - Applicable classic Mac OS localizations. The `chars` will, if possible, be encoded such that all of them can correctly decode the `chars`.
	 * @return The encoded bytes.
	 * @throws {RangeError} If `langs` is empty.
	 * @throws {NoSuitableCharsetError} If there is no common character set that can completely represent the `chars`.
	 */
	tryCharEncode(
		chars: string | { data: Buffer, charset: string },
		langs: Language[]
	): Buffer {
		function langList() {
			return langs.map(lang => lang.englishName).join(", ");
		}

		if (langs.length < 1)
			throw new RangeError("tryCharEncode called with an empty array for langs.");

		const [stringOrBuffer, sourceCharset] =
			typeof chars === "string"
			? [chars, "UTF-8"]
			: [chars.data, chars.charset];

		const suitableTargetCharsets = new Set<string>();

		// Build up a set of all charsets supported by all of the Mac OS localizations.
		for (const lang of langs)
		for (const charset of lang.charsets)
			suitableTargetCharsets.add(charset);

		// Take away charsets that aren't supported by some of the Mac OS localizations. We need a *common* charset that *all* of them can decode.
		for (const charset of suitableTargetCharsets) {
			for (const lang of langs)
			if (!lang.charsets.includes(charset)) {
				suitableTargetCharsets.delete(charset);
				break;
			}
		}

		// If that leaves no charsets, we've got a problem.
		if (!suitableTargetCharsets.size) {
			throw new IconvCache.NoSuitableCharsetError(
				{
					info: {
						targetLanguage: langs
					}
				},
				"The language(s) %s have no character sets in common. It is impossible to encode text in a way that's valid for all of them.",
				langList()
			);
		}

		const errors: Error[] = [];

		for (const targetCharset of suitableTargetCharsets) {
			const iconv = this.get(sourceCharset, targetCharset);

			if (iconv instanceof Error) {
				errors.push(iconv);
				continue;
			}

			try {
				return iconv.convert(stringOrBuffer);
			}
			catch (e) {
				errors.push(e);
			}
		}

		throw new IconvCache.NoSuitableCharsetError(
			{
				cause: VError.errorFromList(errors),
				info: {
					suitableTargetCharsets: Array.from(suitableTargetCharsets),
					targetLanguage: langs
				}
			},
			"None of the character set(s) for the language(s) %s can fully represent the text to be encoded%s",
			langList(),
			errors.length ? "" : "."
		);
	}
}

namespace IconvCache {
	export class NoSuitableCharsetError extends VError {}
}

export default IconvCache;
