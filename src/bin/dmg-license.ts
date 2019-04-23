#!/usr/bin/env node

import { promises as FSP } from "fs";
import IsMyJSONValid = require("is-my-json-valid");
import minimist = require("minimist");
import * as Path from "path";
import { inspect } from "util";
import { VError } from "verror";
import { dmgLicense, LicenseSpec } from "..";
import { BadJSONLicenseSpecError } from "../specFromJSON";

const { stderr, stdout } = process;

// tslint:disable-next-line: no-var-requires
const pkg: { name: string, version: string } = require("../../package.json");

// tslint:disable-next-line: no-var-requires
const dmgLicenseSchema = require("../../schema.json");

let showedHelp = false;

function nop() {
	// Does nothing whatsoever.
}

function showNormalWarning(e: Error): void {
	stderr.write(`${e}\n`);
}

function showVerboseWarning(e: Error): void {
	stderr.write(`${inspect(e, undefined, undefined, true)}\n`);
}

function showHelp(onStderr: boolean = true) {
	showedHelp = true;
	(onStderr ? stderr : stdout).write(
`Add a license agreement to a Mac disk image.

Usage: dmg-license <json-path> <dmg-path>

json-path:  Path to a JSON license specification file.
dmg-path:   Path to a disk image (.dmg) file.

Options:

-v, --verbose
Show stack traces for warnings and errors.

-q, --quiet
Don't show warnings at all.

-h, -?, --help
Show this help, without doing anything else.

-V, --version
Show version.
`);
}

function showVersion(onStderr: boolean = true) {
	(onStderr ? stderr : stdout).write(`${pkg.name} ${pkg.version}\n`);
}

function wrongUsage() {
	if (!showedHelp)
		showHelp();
	return 64;
}

async function main() {
	let verbose = false;
	let showError = showVerboseWarning;
	let showWarning = showNormalWarning;

	try {
		const args = minimist(process.argv.slice(2), {
			alias: {
				["?"]: "help",
				V: "version",
				h: "help",
				q: "quiet",
				v: "verbose"
			},

			boolean: ["verbose", "quiet", "help", "version"],

			unknown(arg) {
				if (arg.startsWith("-")) {
					stderr.write(`Invalid option ‘${arg}’.\n`);
					throw wrongUsage();
				}
				else
					return true;
			}
		});

		verbose = args.verbose;

		if (args.quiet) {
			showWarning = nop;
			showError = showNormalWarning;
		}
		else if (args.verbose) {
			showWarning = showVerboseWarning;
			showError = showVerboseWarning;
		}

		if (args.help) {
			showHelp(false);

			if (args.version)
				showVersion(false);

			return;
		}

		if (args.version) {
			if (args._.length)
				showVersion();
			else {
				showVersion(false);
				return;
			}
		}

		if (args._.length !== 2) {
			stderr.write("Wrong number of parameters.\n");
			throw wrongUsage();
		}

		const jsonText = await FSP.readFile(
			args._[0],
			{ encoding: "utf8" }
		).catch(e => {
			stderr.write("Couldn't read JSON specification file: ");
			showError(e);
			throw 66;
		});

		const jsonDirName = Path.dirname(args._[0]);

		try {
			await dmgLicense.fromJSON(args._[1], jsonText, {
				resolvePath(path) {
					return Path.resolve(jsonDirName, path);
				},

				onNonFatalError: showWarning
			});
		}
		catch (e) {
			if (e instanceof BadJSONLicenseSpecError) {
				showError(e);
				throw 65;
			}
			else
				throw e;
		}
	}
	catch (e) {
		if (typeof e === "number")
			process.exit(e);
		else {
			showError(e);
			process.exit(70);
		}
	}
}
