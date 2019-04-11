const { freeze } = Object;

export interface Labels<T = string> {
	agree: T;
	disagree: T;
	print: T;
	save: T;
	message: T;
}

export namespace Labels {
	export const keys = freeze(["agree", "disagree", "print", "save", "message"] as Array<keyof Labels>);

	export const descriptions = freeze({
		agree: "“Agree” button label",
		disagree: "“Disagree” button label",
		message: "License agreement instructions text",
		print: "“Print” button label",
		save: "“Save” button label"
	} as { [K in keyof Labels]: string });
}

export interface NoLabels extends Partial<Labels<undefined>> {}
