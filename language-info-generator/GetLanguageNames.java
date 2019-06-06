import java.util.Locale;
import static java.lang.System.err;
import static java.lang.System.exit;
import static java.lang.System.out;
import static java.util.Locale.ENGLISH;

public final class GetLanguageNames {
	public static void main(String[] args) throws Exception {
		if (args.length == 0) {
			err.println("This program should be passed, on the command line, a list of locales.");
			err.println("Example: java … GetLanguageNames en fr pt-br");
			exit(1);
		}

		out.println("# Language tag\tEnglish display name\tLocalized display name");

		boolean hadErrors = false;

		for (String arg : args) {
			Locale locale = Locale.forLanguageTag(arg);

			if (locale.equals(Locale.ROOT)) {
				err.println("Invalid language tag: " + arg);
				hadErrors = true;
				continue;
			}

			out.println(arg + '\t' + locale.getDisplayName(ENGLISH) + '\t' + locale.getDisplayName(locale));
		}

		if (hadErrors) {
			err.println("Warning: Some language tags were invalid. Output is incomplete.");
			exit(1);
		}
	}
}
