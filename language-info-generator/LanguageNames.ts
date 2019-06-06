import AwaitLock = require("await-lock");
import execa = require("execa");
import * as FS from "fs";
import * as Path from "path";
import { promisify } from "util";
import { ErrorBuffer } from "../src/util/errors";
import readTSV from "./readTSV";
import { VError } from "verror";
const FSP = FS.promises;

async function runJavac() {
	const sourceFileRel = "GetLanguageNames.java";
	const sourceFile = Path.join(__dirname, sourceFileRel);
	const classFile = sourceFile.replace(/\.java$/, ".class");

	const classFileStat = await FSP.stat(classFile).catch(e => {
		if (e.code === "ENOENT")
			return null;
		else
			throw e;
	});

	if (classFileStat !== null && classFileStat.mtime >= (await FSP.stat(sourceFile)).mtime)
		return;

	try {
		await execa(
			"javac",
			[
				"-source", "7",
				"-target", "7",
				sourceFileRel
			],
			{
				cwd: __dirname,
				stdio: "inherit"
			}
		);
	}
	catch (e) {
		if (e.code === "ENOENT")
			throw new Error("Java compiler not found. This program requires a Java JDK, version 7 or later.");
		else
			throw e;
	}
}

function runJavaProgram() {
	const subprocess = execa(
		"java",
		[
			"-classpath", __dirname,
			"GetLanguageNames"
		],
		{
			stderr: "inherit",
			stdin: "pipe",
			stdout: "pipe"
		}
	);

	const stdin = subprocess.stdin!;
	const stdout = subprocess.stdout!;
	let terminated = false;

	function shutdown(e?: Error) {
		try { stdin.destroy(e); } catch (e) {/* ignore */}
		try { stdout.destroy(e); } catch (e) {/* ignore */}
		if (!terminated)
			subprocess.kill();
	}

	{
		function cleanup() {
			terminated = true;
		}
		subprocess.then(
			() => {
				terminated = true;
			},
			e => {
				terminated = true;
				shutdown(e);
			}
		);
	}

	try {
		stdout.setEncoding("utf8");
		stdin.setDefaultEncoding("utf8");

		const j = {
			end: promisify(stdin.end).bind(stdin) as any as () => Promise<void>,
			shutdown,
			stdin,
			stdout,
			subprocess,
			get terminated() { return terminated; },
			write: promisify(stdin.write).bind(stdin)
		};

		return j;
	}
	catch (e) {
		shutdown(e);
		throw e;
	}
}

export interface LanguageName {
	languageTag: string;
	englishName: string;
	localizedName: string;
}

export default async function LanguageNames<T>(f: (query: (languageTag: string) => Promise<LanguageName>) => Promise<T>): Promise<T> {
	const errors = new ErrorBuffer();
	await runJavac();
	const j = runJavaProgram();

	const result = await errors.catchingAsync(async () => {
		const reader = readTSV(j.stdout, {skipCommentLines: true});
		const lock = new AwaitLock();

		async function query(languageTag: string): Promise<LanguageName> {
			// Make sure the language tag doesn't contain any control characters used by the protocol.
			if (/[\t\n]/.test(languageTag))
				throw new Error(`${languageTag}: Invalid language tag.`);

			await lock.acquireAsync();
			try {
				// Send the query, and wait for the reply.
				await j.write(`${languageTag}\n`);
				const reply = await reader.next();

				if (reply.done)
					throw new Error("Input from subprocess has been closed.");

				// Unpack the reply.
				const [replyLanguageTag, englishName, localizedName, errorMessage] = reply.value.cells;

				if (errorMessage)
					throw new Error(`${languageTag}: ${errorMessage}`);

				return {languageTag: replyLanguageTag, englishName, localizedName};
			}
			finally {
				lock.release();
			}
		}

		// tslint:disable-next-line: no-shadowed-variable // bogus warning
		const result = await f(query);
		await j.end();

		for await (const excess of reader)
			errors.add(new Error(`Excess output from subprocess: ${excess.cells.join("\t")}`));

		return result;
	});

	if (!errors.isEmpty)
		j.shutdown();

	await errors.catchingAsync(j.subprocess.then(() => void 0));

	errors.check();
	return result!;
}
