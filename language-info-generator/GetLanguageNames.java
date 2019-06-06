import static java.lang.System.err;
import static java.lang.System.exit;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Locale.ENGLISH;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.Locale;

public final class GetLanguageNames {
	public static void main(String[] args) throws Exception {
		final BufferedReader in = new BufferedReader(new InputStreamReader(System.in, UTF_8));
		final Writer out = new OutputStreamWriter(System.out, UTF_8);
		boolean hadErrors = false;
		String localeName;

		out.write("# Language tag\tEnglish display name\tLocalized display name\tError message, if any\n");
		out.flush();

		while ((localeName = in.readLine()) != null) {
			final Locale locale = Locale.forLanguageTag(localeName);

			if (locale.equals(Locale.ROOT)) {
				err.println("Invalid language tag: " + localeName);
				hadErrors = true;
				out.write(localeName + "\t\tInvalid language tag.\n");
				continue;
			}

			out.write(localeName + '\t' + locale.getDisplayName(ENGLISH) + '\t' + locale.getDisplayName(locale) + "\t\n");
			out.flush();
		}

		if (hadErrors) {
			err.println("Warning: Some language tags were invalid. Output is incomplete.");
			exit(1);
		}
	}
}
