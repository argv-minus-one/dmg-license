import * as ChildProcesses from "child_process";
import * as Plist from "plist";
import * as ReadXML from "read-xml";
import { pipeline as pipelineCB, Writable } from "stream";
import { promisify } from "util";

const pipeline = promisify(pipelineCB);

export default async function UDIFDeRez(file: string): Promise<Plist.PlistValue> {
	const child = ChildProcesses.spawn(
		"hdiutil", ["udifderez", "-xml", file],
		{
			stdio: ["inherit", "pipe", "inherit"]
		}
	);

	const childPromise = new Promise<void>((resolve, reject) => {
		let exited = false;

		const timeout = setTimeout(() => {
			if (!exited && !child.killed) {
				child.kill();
				reject(new Error("Timed out waiting for child process."));
			}
		}, 10000);

		child.on("error", error => {
			exited = true;
			clearTimeout(timeout);
			child.unref();
			reject(error);
		});

		child.on("exit", code => {
			exited = true;
			clearTimeout(timeout);
			child.unref();

			if (code)
				reject(new Error(`Child process exited with code ${code}.`));
			else
				resolve();
		});
	});

	let xmlStr = "";

	await pipeline(
		child.stdout!,
		ReadXML.createStream(),
		new Writable({
			decodeStrings: false,
			write(chunk, encoding, cb) {
				xmlStr += chunk as string;
				cb();
			}
		})
	);

	const plist = Plist.parse(xmlStr);

	await childPromise;
	return plist;
}
